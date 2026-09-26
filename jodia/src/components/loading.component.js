/** Shared progress UI for route changes and page data loading. */
export const LoadingComponent = {
  show(message = 'Loading data…') {
    let overlay = document.getElementById('system-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'system-loading-overlay';
      overlay.className = 'system-loading-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = `
        <div class="system-loading-card">
          <span class="system-loader" aria-hidden="true"></span>
          <span class="system-loading-message"></span>
        </div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.system-loading-message').textContent = message;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  },

  hide() {
    const overlay = document.getElementById('system-loading-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    window.setTimeout(() => { if (!overlay.classList.contains('is-visible')) overlay.hidden = true; }, 80);
  },

  inline(message = 'Loading…') {
    return `<span class="inline-loading"><span class="inline-loader" aria-hidden="true"></span>${message}</span>`;
  }
};
