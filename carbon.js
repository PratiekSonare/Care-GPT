browser.storage.local.get('totalPromptCount').then((result) => {
  const count = result.totalPromptCount || 0;
  document.getElementById('carbonUsed').textContent = (count * 16.67).toFixed(2);
});
