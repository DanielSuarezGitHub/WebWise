/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/popup.css":
/*!***********************!*\
  !*** ./src/popup.css ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/popup.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _popup_css__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./popup.css */ "./src/popup.css");
// popup.js





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

})();

/******/ })()
;
//# sourceMappingURL=popup.js.map