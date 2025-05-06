let totalPromptCount = 0;
const tabPromptCounts = {}; // Store counts per tab

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'PROMPT_ADDED') {
    const tabId = sender.tab.id;

    // Initialize count for this tab if it doesn't exist
    if (!tabPromptCounts[tabId]) {
      tabPromptCounts[tabId] = 0;
    }

    // Update the count for this tab
    tabPromptCounts[tabId] += message.count;
    totalPromptCount += message.count;

    console.log(`Total prompt count updated: ${totalPromptCount}`);

    chrome.storage.local.set({ totalPromptCount });

    // Optional: show it as badge text
    chrome.action.setBadgeText({ text: totalPromptCount.toString() });
  }
});

// Initialize badge on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get('totalPromptCount', (result) => {
    totalPromptCount = result.totalPromptCount || 0;
    chrome.action.setBadgeText({ text: totalPromptCount.toString() });
  });
});
