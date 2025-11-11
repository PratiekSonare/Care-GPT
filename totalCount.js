browser.storage.local.get('totalPromptCount').then((result) => {
  document.getElementById('count').textContent = (result.totalPromptCount) || 0;
});
