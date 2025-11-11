browser.storage.local.get('totalPromptCount').then((result) => {
  const count = result.totalPromptCount || 0;
  document.getElementById('elecUsed').textContent = (count * 0.05).toFixed(2);
});
