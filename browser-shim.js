/* Lightweight browser shim for cross-browser compatibility.
   Provides a `browser` global on Chrome by delegating to `chrome` and
   promisifying storage/identity/sendMessage where convenient.
   This is intentionally small and only implements what's used by this project.
*/
(function () {
  if (typeof browser !== 'undefined') return; // Firefox already has browser

  if (typeof chrome === 'undefined') {
    // No chrome or browser available; create a minimal stub to avoid errors.
    window.browser = {};
    return;
  }

  const wrapAsync = (fn, ctx) => (...args) => {
    return new Promise((resolve, reject) => {
      try {
        // If last arg is a callback in chrome API style, call and resolve
        fn.call(ctx, ...args, (res) => {
          // Some chrome APIs set runtime.lastError on failure
          if (chrome.runtime && chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve(res);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  const browserShim = {};

  // runtime: keep event listeners but provide a promise sendMessage
  browserShim.runtime = Object.create(null);
  browserShim.runtime.onMessage = chrome.runtime.onMessage;
  browserShim.runtime.getURL = chrome.runtime.getURL.bind(chrome.runtime);
  browserShim.runtime.sendMessage = (message) => {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (resp) => resolve(resp));
      } catch (e) {
        resolve(undefined);
      }
    });
  };

  // identity: promisify getAuthToken
  browserShim.identity = Object.create(null);
  if (chrome.identity && chrome.identity.getAuthToken) {
    browserShim.identity.getAuthToken = (opts) => {
      return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(opts || {}, (token) => {
          if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(token);
        });
      });
    };
  }

  // storage: promisify local and sync get/set
  browserShim.storage = {
    local: {
      get: (keys) => wrapAsync(chrome.storage.local.get, chrome.storage.local)(keys),
      set: (items) => wrapAsync(chrome.storage.local.set, chrome.storage.local)(items),
      remove: (keys) => wrapAsync(chrome.storage.local.remove, chrome.storage.local)(keys)
    },
    sync: {
      get: (keys) => wrapAsync(chrome.storage.sync.get, chrome.storage.sync)(keys),
      set: (items) => wrapAsync(chrome.storage.sync.set, chrome.storage.sync)(items),
      remove: (keys) => wrapAsync(chrome.storage.sync.remove, chrome.storage.sync)(keys)
    }
  };

  // tabs helper (minimal) - pass-through where available
  browserShim.tabs = {};
  if (chrome.tabs) {
    browserShim.tabs.query = (q) => new Promise((resolve) => chrome.tabs.query(q, resolve));
    browserShim.tabs.sendMessage = (tabId, msg) => new Promise((resolve) => chrome.tabs.sendMessage(tabId, msg, resolve));
  }

  // Expose on global
  try {
    window.browser = browserShim;
  } catch (e) {
    // In worker contexts use self
    self.browser = browserShim;
  }

})();
