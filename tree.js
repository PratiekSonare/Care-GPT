chrome.storage.local.get('totalPromptCount', (result) => {
  document.getElementById('treeUsed').textContent = (result.totalPromptCount * 0.00075) || 0;
});
