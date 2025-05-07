chrome.storage.local.get('totalPromptCount', (result) => {
  document.getElementById('waterUsed').textContent = (result.totalPromptCount * 1.5).toFixed(2) || 0;
});
