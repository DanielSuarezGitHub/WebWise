/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/*!***************************!*\
  !*** ./src/background.js ***!
  \***************************/
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Send request to AI API
async function sendAIRequest(messages, onProgress) {
  const settings = await getSettings();
  const apiKey = settings.openaiApiKey;
  const apiUrl = OPENAI_API_URL;
  const model = settings.openaiModel || 'gpt-4o-mini';

  if (!apiKey) throw new Error('API key for OpenAI is not set.');

  return sendOpenAIRequest(apiUrl, apiKey, model, messages, onProgress);
}

// Get settings from storage
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['openaiApiKey', 'openaiModel', 'includeContext'],
      (result) => resolve(result)
    );
  });
}

// Send request to OpenAI API
async function sendOpenAIRequest(apiUrl, apiKey, model, messages, onProgress) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API request failed: ${response.statusText}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let result = '';
  let done = false;

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0].delta.content;
            if (content) {
              result += content;
              onProgress(content, false);
            }
          } catch (err) {
            console.error('Error parsing OpenAI stream data:', err);
          }
        }
      }
    }
  }

  onProgress(null, true);
  return result;
}

// Store chat history
function storeChatHistory(chatId, messages, chatTitle) {
  chrome.storage.local.set({ [chatId]: messages }, () => {
    console.log('Chat history stored');

    chrome.storage.local.get({ chatList: [] }, (result) => {
      const chatList = result.chatList;
      const chatIndex = chatList.findIndex((chat) => chat.chatId === chatId);
      if (chatIndex === -1) {
        chatList.push({ chatId: chatId, title: chatTitle });
      } else {
        chatList[chatIndex].title = chatTitle;
      }
      chrome.storage.local.set({ chatList: chatList }, () => console.log('Chat list updated'));
    });
  });
}

// Retrieve chat history
function getChatHistory(chatId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(chatId, (result) => resolve(result[chatId] || []));
  });
}

// Retrieve chat list
function getChatList() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ chatList: [] }, (result) => resolve(result.chatList));
  });
}

// Rename chat
function renameChat(chatId, newTitle) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ chatList: [] }, (result) => {
      const chatList = result.chatList;
      const chatIndex = chatList.findIndex((chat) => chat.chatId === chatId);
      if (chatIndex !== -1) {
        chatList[chatIndex].title = newTitle;
        chrome.storage.local.set({ chatList: chatList }, () => resolve());
      } else {
        reject(new Error('Chat not found'));
      }
    });
  });
}

// Delete chat
function deleteChat(chatId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(chatId, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      chrome.storage.local.get({ chatList: [] }, (result) => {
        const chatList = result.chatList.filter((chat) => chat.chatId !== chatId);
        chrome.storage.local.set({ chatList: chatList }, () => resolve());
      });
    });
  });
}

// Continue a previous chat
async function continueChat(chatId, newMessage, onProgress, context) {
  const chatHistory = await getChatHistory(chatId);

  if (context) chatHistory.unshift(context);

  chatHistory.push({ role: 'user', content: newMessage });

  let responseContent = '';
  await sendAIRequest(chatHistory, (partialResponse, isDone) => {
    if (partialResponse) {
      responseContent += partialResponse;
      onProgress(partialResponse, false);
    }
    if (isDone) onProgress(null, true);
  });
  chatHistory.push({ role: 'assistant', content: responseContent });

  let chatTitle = 'Chat';
  if (chatHistory.length === 2 || (context && chatHistory.length === 3)) {
    chatTitle = generateChatTitle(newMessage);
  }

  if (context) chatHistory.shift();

  storeChatHistory(chatId, chatHistory, chatTitle);
  return responseContent;
}

// Generate chat title based on first message
function generateChatTitle(message) {
  return message.length > 30 ? message.substring(0, 30) + '...' : message;
}

// Handle inline completions
async function handleInlineCompletion(prompt, requestId, sender) {
  const messages = [{ role: 'user', content: prompt }];
  const tabId = sender.tab ? sender.tab.id : null;
  if (!tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: 'inlineCompletionResponse',
      requestId: requestId,
      error: 'Tab ID not available',
    });
    return;
  }

  try {
    await sendAIRequest(messages, (partialResponse, isDone) => {
      if (partialResponse) {
        chrome.tabs.sendMessage(tabId, {
          action: 'inlineCompletionResponse',
          requestId: requestId,
          content: partialResponse,
          isDone: false,
        });
      }
      if (isDone) {
        chrome.tabs.sendMessage(tabId, {
          action: 'inlineCompletionResponse',
          requestId: requestId,
          isDone: true,
        });
      }
    });
  } catch (error) {
    console.error('Error handling inline completion:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'inlineCompletionResponse',
      requestId: requestId,
      error: error.message,
      isDone: true,
    });
  }
}

// Handle question with context
async function handleQuestionWithContext(question, context, requestId, sender) {
  let messages = [];

  if (context) {
    messages.push({
      role: 'system',
      content: 'The following is the text selected by the user:\n' + context,
    });
  }

  messages.push({ role: 'user', content: question });

  const tabId = sender.tab ? sender.tab.id : null;
  if (!tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: 'questionResponse',
      requestId: requestId,
      error: 'Tab ID not available',
      isDone: true,
    });
    return;
  }

  try {
    await sendAIRequest(messages, (partialResponse, isDone) => {
      if (partialResponse) {
        chrome.tabs.sendMessage(tabId, {
          action: 'questionResponse',
          requestId: requestId,
          content: partialResponse,
          isDone: false,
        });
      }
      if (isDone) {
        chrome.tabs.sendMessage(tabId, {
          action: 'questionResponse',
          requestId: requestId,
          isDone: true,
        });
      }
    });
  } catch (error) {
    console.error('Error handling question with context:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'questionResponse',
      requestId: requestId,
      error: error.message,
      isDone: true,
    });
  }
}

// Listen for messages from content scripts or extension parts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'continueChat') {
    const { chatId, message, context } = request;
    continueChat(
      chatId,
      message,
      (partialResponse, isDone) => {
        if (partialResponse) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'partialResponse',
            chatId: chatId,
            content: partialResponse,
          });
        }
        if (isDone) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'responseComplete',
            chatId: chatId,
          });
        }
      },
      context
    )
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getChatHistory') {
    getChatHistory(request.chatId)
      .then((history) => sendResponse({ success: true, history: history }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getChatList') {
    getChatList()
      .then((chatList) => sendResponse({ success: true, chatList: chatList }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'renameChat') {
    const { chatId, newTitle } = request;
    renameChat(chatId, newTitle)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'deleteChat') {
    const { chatId } = request;
    deleteChat(chatId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'inlineCompletion') {
    const { prompt, requestId } = request;
    handleInlineCompletion(prompt, requestId, sender);
    return true;
  }

  if (request.action === 'askQuestionWithContext') {
    const { question, context, requestId } = request;
    handleQuestionWithContext(question, context, requestId, sender);
    return true;
  }
});

/******/ })()
;
//# sourceMappingURL=background.js.map