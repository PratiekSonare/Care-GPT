browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_AUTH_TOKEN") {
    // browser.identity.getAuthToken returns a Promise in our shim
    browser.identity.getAuthToken({ interactive: true })
      .then(token => sendResponse({ success: true, token }))
      .catch(err => {
        console.error("Failed to get auth token:", err);
        sendResponse({ success: false, error: err });
      });

    return true; // indicate async response
  }
});
