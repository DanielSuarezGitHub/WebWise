// popup.js

'use strict';

import './popup.css';

(function () {
  // Elements
  const modelSelect = document.getElementById('modelSelect');
  const openaiApiKeyInput = document.getElementById('openaiApiKey');
  const includeContextCheckbox = document.getElementById('includeContext');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const statusMessage = document.getElementById('statusMessage');

  // Model options for OpenAI
  const modelOptions = [
    { value: 'gpt-4o-mini', text: 'GPT-4o Mini' },
    { value: 'gpt-4o', text: 'GPT-4o' },

  ];

  // Initialize the popup
  function init() {
    // Populate model select
    modelSelect.innerHTML = '';
    modelOptions.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.value;
      option.text = model.text;
      modelSelect.appendChild(option);
    });

    // Load settings from storage
    chrome.storage.local.get(['openaiApiKey', 'openaiModel', 'includeContext'], (result) => {
      openaiApiKeyInput.value = result.openaiApiKey || '';
      includeContextCheckbox.checked = result.includeContext || false;
      modelSelect.value = result.openaiModel || modelOptions[0].value;
    });
  }

  // Handle save settings
  saveSettingsBtn.addEventListener('click', () => {
    const model = modelSelect.value;
    const openaiApiKey = openaiApiKeyInput.value.trim();
    const includeContext = includeContextCheckbox.checked;

    const settings = {
      openaiModel: modelOptions.find((m) => m.value === model)?.value || '',
      openaiApiKey: openaiApiKey,
      includeContext: includeContext,
    };

    chrome.storage.local.set(settings, () => {
      statusMessage.textContent = 'Settings saved successfully!';
      setTimeout(() => {
        statusMessage.textContent = '';
      }, 3000);
    });
  });

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);
})();
