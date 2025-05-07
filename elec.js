chrome.storage.local.get('totalPromptCount', (result) => {
  document.getElementById('elecUsed').textContent = (result.totalPromptCount * 0.05).toFixed(2) || 0;
});
