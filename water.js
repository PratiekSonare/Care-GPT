browser.storage.local.get('totalPromptCount').then((result) => {
  const count = result.totalPromptCount || 0;
  document.getElementById('waterUsed').textContent = (count * 1.5).toFixed(2);
});
