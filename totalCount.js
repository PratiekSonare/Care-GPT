chrome.storage.local.get('totalPromptCount', (result) => {
  document.getElementById('count').textContent = result.totalPromptCount || 0;
});
