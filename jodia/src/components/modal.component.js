export const ModalComponent = {
  open({ title, bodyHtml, onConfirm, confirmText = 'Confirm' }) {
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
            <button id="modal-confirm" class="btn btn-primary">${confirmText}</button>
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
      document.removeEventListener('keydown', handleEscape);
      if (onConfirm) await onConfirm();
      close();
    });
  }
};