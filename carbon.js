chrome.storage.local.get('totalPromptCount', (result) => {
  document.getElementById('carbonUsed').textContent = (result.totalPromptCount * 16.67).toFixed(2) || 0;
});
