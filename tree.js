browser.storage.local.get('totalPromptCount').then((result) => {
  const count = result.totalPromptCount || 0;
  document.getElementById('treeUsed').textContent = (count * 0.00075).toFixed(4);
});
