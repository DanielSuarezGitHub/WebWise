// ------------------- Inline Completion Logic -------------------
const REGEX_PATTERN = /\/.*?;/;

// Handles input events on editable elements
function handleInputEvent(element) {
  let newText;
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    newText = element.value;
  } else {
    newText = element.textContent;
  }
  console.log('Input Text:', newText);
  if (REGEX_PATTERN.test(newText)) {
    handleRegexMatch(newText, element);
  }
}

// Processes text matching the regex pattern
async function handleRegexMatch(newText, element) {
  const match = newText.match(REGEX_PATTERN)[0];
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value = newText.replace(REGEX_PATTERN, '');
  } else {
    element.textContent = newText.replace(REGEX_PATTERN, '');
  }

  let arr = match.split(' ');
  let promptType = arr[0].substring(1);
  let prompt = arr.slice(1).join(' ').slice(0, -1);

  const requestId = 'inlineCompletion-' + Date.now();

  function handleMessage(message) {
    if (
      message.action === 'inlineCompletionResponse' &&
      message.requestId === requestId
    ) {
      if (message.content) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.value += message.content;
        } else {
          element.textContent += message.content;
        }
      }
      if (message.isDone) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage);

  chrome.runtime.sendMessage({
    action: 'inlineCompletion',
    prompt: prompt,
    requestId: requestId,
  });
}

// Adds event listeners to text elements
function textListener(element) {
  console.log(`Adding event listener to ${element.tagName}`);
  element.addEventListener('input', (e) => handleInputEvent(element));
}

// Finds and attaches listeners to content-editable elements
function findContentEditableElements() {
  const contentEditableElements = document.querySelectorAll(
    '[contenteditable="true"], input, textarea'
  );
  contentEditableElements.forEach((element) => {
    if (!element.hasEventListener) {
      textListener(element);
      element.hasEventListener = true;
    }
  });
}

const observer = new MutationObserver((entries) => findContentEditableElements());
observer.observe(document.body, { childList: true, subtree: true });

// ------------------- Menu Logic -------------------

// Creates a tooltip element
function createTooltip() {
  const tooltip = document.createElement("div");
  tooltip.id = "tooltip";
  tooltip.style.position = "absolute";
  tooltip.style.display = "none";
  tooltip.style.backgroundColor = "black";
  tooltip.style.border = "2px solid white";
  tooltip.style.padding = "7px";
  tooltip.style.borderRadius = "0 50% 50% 50%";
  tooltip.style.zIndex = "9999";
  tooltip.style.cursor = "pointer";
  document.body.appendChild(tooltip);
  return tooltip;
}

const tooltip = createTooltip();

// Handles mouse up events to display tooltip
document.addEventListener('mouseup', function (event) {
  handleMouseUpEvent(event, tooltip);
});

// Processes mouse up events and shows tooltip if text is selected
function handleMouseUpEvent(event, tooltip) {
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) {
      handleTextSelection(selection, tooltip);
    } else {
      tooltip.style.display = 'none';
    }
  }, 0);
}

// Positions and displays the tooltip based on text selection
function handleTextSelection(selection, tooltip) {
  const rects = selection.getRangeAt(0).getClientRects();
  const rect = rects[rects.length - 1];
  if (!rect) {
    tooltip.style.display = 'none';
    return;
  }

  tooltip.style.left = `${rect.right + 10 + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + 10 + window.scrollY}px`;
  tooltip.style.display = 'block';

  tooltip.onmousedown = (e) => {
    e.preventDefault();
  };

  tooltip.onclick = (e) => {
    e.stopPropagation();
    createMenu(selection.toString().trim());
    tooltip.style.display = 'none';
  };
}

// Creates and manages the menu interface
function createMenu(selectedText) {
  const menuContainer = document.createElement('div');
  menuContainer.id = 'menu-container';
  const shadowRoot = menuContainer.attachShadow({ mode: 'closed' });

  const styles = `
    :host {
      all: initial;
    }
    .menu {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      background-color: #1e1e1e;
      color: #ffffff;
      border: 1px solid #3c3c3c;
      border-radius: 10px;
      padding: 20px;
      z-index: 10000;
      width: 400px;
      max-width: 90%;
      box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      align-items: stretch;
      font-family: 'Arial', sans-serif;
      animation: scaleUp 0.3s forwards ease;
    }
    @keyframes scaleUp {
      to {
        transform: translate(-50%, -50%) scale(1);
      }
    }
    @keyframes scaleDown {
      to {
        transform: translate(-50%, -50%) scale(0);
      }
    }
    .menu.closing {
      animation: scaleDown 0.3s forwards ease;
    }
    .input-wrapper {
      display: flex;
      align-items: center;
      background-color: #2c2c2c;
      border-radius: 5px;
      padding: 5px;
    }
    textarea {
      flex-grow: 1;
      background-color: transparent;
      border: none;
      color: #ffffff;
      padding: 10px;
      font-size: 14px;
      resize: none;
      outline: none;
      height: 50px;
      font-family: inherit;
    }
    button.send-button {
      background-color: transparent;
      border: none;
      cursor: pointer;
      padding: 10px;
      margin-left: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    button.send-button svg {
      fill: #007bff;
      width: 24px;
      height: 24px;
      transition: transform 0.2s;
    }
    button.send-button:hover svg {
      transform: scale(1.1);
    }
    .response-container {
      background-color: #2c2c2c;
      padding: 15px;
      border-radius: 5px;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 15px;
      display: none;
      flex-direction: column;
      gap: 10px;
      font-family: inherit;
    }
    .response-text {
      color: #ffffff;
      white-space: pre-wrap;
    }
    .copy-button {
      align-self: flex-end;
      padding: 5px 10px;
      background-color: #4a90e2;
      border: none;
      border-radius: 5px;
      color: #ffffff;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    }
    .copy-button:hover {
      background-color: #357ab8;
    }
  `;

  const menuHTML = `
    <style>${styles}</style>
    <div class="menu" id="menu">
      <div class="input-wrapper">
        <textarea id="questionInput" placeholder="Type your question..."></textarea>
        <button class="send-button" id="submitQuestion">
          <svg viewBox="0 0 24 24">
            <path d="M4 12L20 12M20 12L14 6M20 12L14 18" stroke="#007bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="response-container" id="responseContainer">
        <div class="response-text" id="responseText"></div>
        <button class="copy-button" id="copyButton">Copy</button>
      </div>
    </div>
  `;

  shadowRoot.innerHTML = menuHTML;
  document.body.appendChild(menuContainer);

  const submitButton = shadowRoot.getElementById('submitQuestion');
  const questionInput = shadowRoot.getElementById('questionInput');
  const responseContainer = shadowRoot.getElementById('responseContainer');
  const responseText = shadowRoot.getElementById('responseText');
  const copyButton = shadowRoot.getElementById('copyButton');
  const menu = shadowRoot.getElementById('menu');

  questionInput.focus({ preventScroll: true });

  const requestId = 'menuRequest-' + Date.now();

  submitButton.addEventListener('click', sendMessage);

  questionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  // Sends the user question to the background script
  function sendMessage() {
    const question = questionInput.value.trim();
    if (question === '') {
      alert('Please enter a question.');
      return;
    }
    questionInput.disabled = true;
    submitButton.disabled = true;
    submitButton.innerHTML = '<svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" stroke="#007bff" stroke-width="5" fill="none" stroke-linecap="round"></circle></svg>';

    const spinnerStyle = document.createElement('style');
    spinnerStyle.textContent = `
      .spinner {
        animation: spin 1s linear infinite;
        width: 24px;
        height: 24px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    shadowRoot.appendChild(spinnerStyle);

    chrome.runtime.sendMessage(
      {
        action: 'askQuestionWithContext',
        question: question,
        context: selectedText,
        requestId: requestId,
      },
      (response) => {
        if (response && response.success) {
          responseContainer.style.display = 'flex';
          responseText.textContent = '';
          copyButton.disabled = false;
        } else {
          alert(
            'Error: ' +
              (response ? response.error : 'No response from background script.')
          );
          questionInput.disabled = false;
          submitButton.disabled = false;
          restoreSendButton();
          shadowRoot.removeChild(spinnerStyle);
        }
      }
    );
  }

  // Restores the send button icon after sending
  function restoreSendButton() {
    submitButton.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M4 12L20 12M20 12L14 6M20 12L14 18" stroke="#007bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  // Copies the response text to clipboard
  copyButton.addEventListener('click', () => {
    const textToCopy = responseText.textContent;
    navigator.clipboard.writeText(textToCopy).then(
      () => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  });

  // Closes the menu when clicking outside
  document.addEventListener('click', onDocumentClick);
  function onDocumentClick(event) {
    if (!menuContainer.contains(event.target) && !tooltip.contains(event.target)) {
      closeMenu();
    }
  }

  // Handles keyboard events for menu
  document.addEventListener('keydown', onKeyDown);
  function onKeyDown(event) {
    if (event.key === 'Escape') {
      closeMenu();
    }
  }

  // Closes the menu with animation
  function closeMenu() {
    menu.classList.add('closing');
    menu.addEventListener('animationend', function onAnimationEnd() {
      menu.removeEventListener('animationend', onAnimationEnd);
      menuContainer.remove();
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    });
  }

  // Listens for responses from the background script
  chrome.runtime.onMessage.addListener(function messageListener(message) {
    if (
      message.action === 'questionResponse' &&
      message.requestId === requestId
    ) {
      if (message.content) {
        responseContainer.style.display = 'flex';
        responseText.textContent += message.content;
      }
      if (message.isDone) {
        chrome.runtime.onMessage.removeListener(messageListener);
        questionInput.disabled = false;
        submitButton.disabled = false;
        restoreSendButton();
        const spinnerStyle = shadowRoot.querySelector('style:last-of-type');
        if (spinnerStyle) shadowRoot.removeChild(spinnerStyle);
      }
      if (message.error) {
        responseText.textContent = 'Error: ' + message.error;
        chrome.runtime.onMessage.removeListener(messageListener);
        questionInput.disabled = false;
        submitButton.disabled = false;
        restoreSendButton();
        const spinnerStyle = shadowRoot.querySelector('style:last-of-type');
        if (spinnerStyle) shadowRoot.removeChild(spinnerStyle);
      }
    }
  });

  return menuContainer;
}

// Initialize tooltip listeners
findContentEditableElements();

// ------------------- Sidebar Logic -------------------

// Creates the chat sidebar interface
function createChatSidebarAlpha() {
  if (document.getElementById('chat-sidebar-container')) {
    return;
  }

  const styles = `
    :host {
      all: initial;
    }
    .chat-wrapper {
      font-family: Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      position: fixed;
      right: 0;
      top: 0;
      width: 350px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: #1e1e1e;
      box-shadow: -5px 0px 15px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      transition: transform 0.3s ease;
      transform: translateX(100%);
    }
    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0;
      background-color: #1e1e1e;
      border-bottom: 3px solid black;
    }
    .header-button {
      flex: 1;
      background-color: transparent;
      border: none;
      cursor: pointer;
      padding: 15px 0;
      transition: background-color 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-button:hover {
      background-color: #3c3c3c;
    }
    .btnimg {
      height: 20px;
      width: 20px;
    }
    .chat-container {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: white;
    }
    .messages-container {
      flex-grow: 1;
      flex-shrink: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 10px 20px;
    }
    .input-wrapper {
      flex-shrink: 0;
      display: flex;
      background-color: #2c2c2c;
      border-radius: 20px;
      margin: 0 10px 10px;
      padding: 8px;
    }
    .input-field {
      flex-grow: 1;
      border: none;
      padding: 8px 12px;
      color: white;
      background-color: transparent;
      font-size: 14px;
      outline: none;
      resize: none;
      min-height: 20px;
      max-height: 100px;
      overflow-y: auto;
    }
    .send-button {
      width: 36px;
      height: 36px;
      padding: 6px;
      background-color: #4a4a4a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.3s ease;
      border: none;
      cursor: pointer;
    }
    .send-button:hover {
      background-color: #5a5a5a;
    }
    .send-button svg {
      width: 20px;
      height: 20px;
    }
    .reopen-button {
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: #4a4a4a;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      transition: background-color 0.3s ease;
      z-index: 9998;
    }
    .reopen-button:hover {
      background-color: #5a5a5a;
    }
    .reopen-button svg {
      width: 24px;
      height: 24px;
    }
    .chats-view {
      display: none;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      padding: 20px;
      color: white;
    }
    .chat-item {
      padding: 10px;
      margin-bottom: 10px;
      background-color: #2c2c2c;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .chat-item:hover {
      background-color: #3c3c3c;
    }
    .message {
      margin-bottom: 10px;
      padding: 8px 12px;
      border-radius: 10px;
      max-width: 80%;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .user-message {
      align-self: flex-end;
      background-color: #4a4a4a;
    }
    .bot-message {
      align-self: flex-start;
      background-color: #2c2c2c;
    }
    .chat-title {
      flex-grow: 1;
    }
    .edit-button,
    .delete-button {
      background-color: transparent;
      border: none;
      cursor: pointer;
      padding: 5px;
      color: #ccc;
    }
    .edit-button:hover,
    .delete-button:hover {
      color: white;
    }
  `;

  const template = `
    <div class="chat-wrapper">
      <div class="chat-header">
        <button class="header-button" id="newChatBtn">
          <img class="btnimg" src="${chrome.runtime.getURL('images/plus-icon.svg')}" alt="New Chat">
        </button>
        <button class="header-button" id="viewChatsBtn">
          <img class="btnimg" src="${chrome.runtime.getURL('images/history.svg')}" alt="View Chats">
        </button>
        <button class="header-button" id="closeBtn">
          <img class="btnimg" src="${chrome.runtime.getURL('images/close.svg')}" alt="Close">
        </button>
      </div>
      <div class="chat-container" id="chatContainer">
        <div class="messages-container" id="messagesContainer"></div>
        <div class="input-wrapper">
          <textarea class="input-field" id="inputField" placeholder="Message Webwise..." rows="1"></textarea>
          <button class="send-button" id="sendButton">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M7 11L12 6L17 11M12 18V7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="chats-view" id="chatsView"></div>
    </div>
    <div class="reopen-button" id="reopenButton">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  const shadow = document.createElement('div');
  shadow.id = 'chat-sidebar-container';
  const shadowRoot = shadow.attachShadow({ mode: 'open' });

  shadowRoot.innerHTML = `<style>${styles}</style>${template}`;
  document.body.appendChild(shadow);

  const elements = {
    chatWrapper: shadowRoot.querySelector('.chat-wrapper'),
    chatContainer: shadowRoot.getElementById('chatContainer'),
    messagesContainer: shadowRoot.getElementById('messagesContainer'),
    inputField: shadowRoot.getElementById('inputField'),
    sendButton: shadowRoot.getElementById('sendButton'),
    newChatBtn: shadowRoot.getElementById('newChatBtn'),
    viewChatsBtn: shadowRoot.getElementById('viewChatsBtn'),
    closeBtn: shadowRoot.getElementById('closeBtn'),
    reopenButton: shadowRoot.getElementById('reopenButton'),
    chatsView: shadowRoot.getElementById('chatsView'),
    inputWrapper: shadowRoot.querySelector('.input-wrapper'),
  };

  elements.chatWrapper.style.transform = 'translateX(100%)';
  elements.reopenButton.style.display = 'flex';

  let currentChatId = null;

  let currentProvider = 'OpenAI';
  let includeContext = false;
  chrome.storage.local.get(['defaultProvider', 'includeContext'], (result) => {
    if (result.defaultProvider) {
      currentProvider = result.defaultProvider;
    }
    includeContext = result.includeContext || false;
  });

  // Sends user messages to the background script
  const handleSend = () => {
    const message = elements.inputField.value.trim();
    if (message) {
      handleResponseComplete();

      const userMessageElement = document.createElement('div');
      userMessageElement.className = 'message user-message';
      userMessageElement.textContent = message;
      elements.messagesContainer.appendChild(userMessageElement);
      elements.inputField.value = '';
      updateInputField();
      elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;

      if (includeContext) {
        let pageContent = document.body.innerText;
        pageContent = pageContent.substring(0, 10000);
        var contextMessage = {
          role: 'system',
          content: 'The following is the content of the webpage the user is currently viewing:\n' + pageContent,
        };
      }

      chrome.runtime.sendMessage(
        {
          action: 'continueChat',
          provider: currentProvider,
          chatId: currentChatId,
          message: message,
          context: includeContext ? contextMessage : null,
        },
        (response) => {
          if (response.success) {
          } else {
            console.error('Error from background script:', response.error);
            const errorMessageElement = document.createElement('div');
            errorMessageElement.className = 'message bot-message';
            errorMessageElement.textContent = 'An error occurred: ' + response.error;
            elements.messagesContainer.appendChild(errorMessageElement);
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
          }
        }
      );
    }
  };

  // Handles partial responses from the background script
  const handlePartialResponse = (content) => {
    let botMessageElement = elements.messagesContainer.querySelector('.message.bot-message.pending');
    if (!botMessageElement) {
      botMessageElement = document.createElement('div');
      botMessageElement.className = 'message bot-message pending';
      botMessageElement.textContent = '';
      elements.messagesContainer.appendChild(botMessageElement);
    }
    botMessageElement.textContent += content;
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
  };

  // Finalizes the bot's response
  const handleResponseComplete = () => {
    const botMessageElement = elements.messagesContainer.querySelector('.message.bot-message.pending');
    if (botMessageElement) {
      botMessageElement.classList.remove('pending');
    }
  };

  // Updates the send button based on input field content
  const updateInputField = () => {
    const isEmpty = elements.inputField.value.trim() === '';
    elements.sendButton.style.opacity = isEmpty ? '0.5' : '1';
    elements.sendButton.style.cursor = isEmpty ? 'default' : 'pointer';
  };

  // Deletes a chat and updates the UI
  const deleteChat = (chatId, chatItem) => {
    chrome.runtime.sendMessage({ action: 'deleteChat', chatId: chatId }, (response) => {
      if (response.success) {
        console.log('Chat deleted successfully');
        chatItem.remove();
        if (elements.chatsView.children.length === 0) {
          const noChatsMessage = document.createElement('div');
          noChatsMessage.textContent = 'No chats available.';
          noChatsMessage.style.color = '#aaa';
          elements.chatsView.appendChild(noChatsMessage);
        }
      } else {
        console.error('Error deleting chat:', response.error);
      }
    });
  };

  // Closes the chat sidebar
  const closeSidebar = () => {
    elements.chatWrapper.style.transform = 'translateX(100%)';
    elements.reopenButton.style.display = 'flex';
  };

  // Opens the chat sidebar
  const openSidebar = () => {
    elements.chatWrapper.style.transform = 'translateX(0)';
    elements.reopenButton.style.display = 'none';
    elements.inputField.focus();
  };

  // Displays the list of available chats
  const showChatsView = () => {
    elements.chatContainer.style.display = 'none';
    elements.chatsView.style.display = 'flex';
    elements.chatsView.innerHTML = '';

    chrome.runtime.sendMessage({ action: 'getChatList' }, (response) => {
      if (response.success) {
        const chatList = response.chatList;
        if (chatList.length === 0) {
          const noChatsMessage = document.createElement('div');
          noChatsMessage.textContent = 'No chats available.';
          noChatsMessage.style.color = '#aaa';
          elements.chatsView.appendChild(noChatsMessage);
        } else {
          chatList.forEach((chatObj) => {
            const { chatId, title } = chatObj;
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';

            const chatTitle = document.createElement('span');
            chatTitle.className = 'chat-title';
            chatTitle.textContent = title;
            chatItem.appendChild(chatTitle);

            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';

            const editButton = document.createElement('button');
            editButton.className = 'edit-button';
            editButton.textContent = '✏️';
            editButton.addEventListener('click', (e) => {
              e.stopPropagation();
              const newTitle = prompt('Enter new chat title:', title);
              if (newTitle) {
                renameChat(chatId, newTitle);
                chatTitle.textContent = newTitle;
              }
            });
            buttonContainer.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = '🗑️';
            deleteButton.addEventListener('click', (e) => {
              e.stopPropagation();
              if (confirm('Are you sure you want to delete this chat?')) {
                deleteChat(chatId, chatItem);
              }
            });
            buttonContainer.appendChild(deleteButton);

            chatItem.appendChild(buttonContainer);

            chatItem.addEventListener('click', () => loadChat(chatId));
            elements.chatsView.appendChild(chatItem);
          });
        }
      } else {
        console.error('Error getting chat list:', response.error);
      }
    });
  };

  // Renames a chat with a new title
  const renameChat = (chatId, newTitle) => {
    chrome.runtime.sendMessage({ action: 'renameChat', chatId: chatId, newTitle: newTitle }, (response) => {
      if (response.success) {
        console.log('Chat renamed successfully');
      } else {
        console.error('Error renaming chat:', response.error);
      }
    });
  };

  // Shows the main chat view
  const showChatView = () => {
    elements.chatsView.style.display = 'none';
    elements.chatContainer.style.display = 'flex';
  };

  // Loads a specific chat by its ID
  const loadChat = (chatId) => {
    currentChatId = chatId;
    chrome.runtime.sendMessage({ action: 'getChatHistory', chatId: chatId }, (response) => {
      if (response.success) {
        const history = response.history;
        elements.messagesContainer.innerHTML = '';
        history.forEach((messageObj) => {
          const messageElement = document.createElement('div');
          messageElement.className =
            'message ' + (messageObj.role === 'user' ? 'user-message' : 'bot-message');
          messageElement.textContent = messageObj.content;
          elements.messagesContainer.appendChild(messageElement);
        });
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        showChatView();
      } else {
        console.error('Error getting chat history:', response.error);
      }
    });
  };

  // Event listeners for input and buttons
  elements.inputField.addEventListener('input', updateInputField);
  elements.sendButton.addEventListener('click', handleSend);
  elements.inputField.addEventListener('keypress', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  ['keydown', 'keyup', 'keypress', 'input'].forEach((eventType) => {
    elements.inputField.addEventListener(eventType, (e) => {
      e.stopPropagation();
    });
  });

  elements.closeBtn.addEventListener('click', closeSidebar);
  elements.reopenButton.addEventListener('click', openSidebar);
  elements.viewChatsBtn.addEventListener('click', showChatsView);
  elements.newChatBtn.addEventListener('click', () => {
    currentChatId = 'chat-' + Date.now();
    elements.messagesContainer.innerHTML = '';
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    showChatView();
    elements.inputField.focus();
  });

  updateInputField();

  // Listens for responses related to the current chat
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'partialResponse' && request.chatId === currentChatId) {
      handlePartialResponse(request.content);
    } else if (request.action === 'responseComplete' && request.chatId === currentChatId) {
      handleResponseComplete();
    }
  });

  return elements;
}

// Initializes the chat sidebar when the script loads
createChatSidebarAlpha();
