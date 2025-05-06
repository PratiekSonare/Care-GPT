function countPrompt() {
  let lastCount = 0;

  const observer = new MutationObserver(() => {
    const prompts = document.querySelectorAll('.bg-token-message-surface');
    const currentCount = prompts.length;

    if (currentCount > lastCount) {
      const newPrompts = currentCount - lastCount;
      lastCount = currentCount;

      // Send new prompt count to background script with tab ID
      chrome.runtime.sendMessage({ type: 'PROMPT_ADDED', count: newPrompts, tabId: chrome.runtime.id });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

window.addEventListener('load', countPrompt);
