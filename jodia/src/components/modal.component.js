export const ModalComponent = {
  open({ title, bodyHtml, onConfirm, confirmText = 'Confirm', confirmClass = 'btn-primary' }) {
    const modalRoot = document.getElementById('modal-root');
    
    modalRoot.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button id="modal-close-x" class="modal-close" aria-label="Close modal">&times;</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button id="modal-cancel" class="btn btn-secondary">Cancel</button>
            <button id="modal-confirm" class="btn ${confirmClass}">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };

    // Close on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) close();
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEscape);

    document.getElementById('modal-close-x').addEventListener('click', () => {
      document.removeEventListener('keydown', handleEscape);
      close();
    });
    document.getElementById('modal-cancel').addEventListener('click', () => {
      document.removeEventListener('keydown', handleEscape);
      close();
    });
    document.getElementById('modal-confirm').addEventListener('click', async () => {
      const confirmButton = document.getElementById('modal-confirm');
      confirmButton.disabled = true;
      confirmButton.classList.add('is-loading');
      try {
        // Returning false lets forms show validation or database errors without
        // unexpectedly closing and losing the user's input.
        const shouldClose = onConfirm ? await onConfirm() : true;
        if (shouldClose !== false) {
          document.removeEventListener('keydown', handleEscape);
          close();
        }
      } finally {
        if (document.getElementById('modal-confirm')) {
          confirmButton.disabled = false;
          confirmButton.classList.remove('is-loading');
        }
      }
    });
  }
};
