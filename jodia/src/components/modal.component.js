export const ModalComponent = {
  open({ title, bodyHtml, onConfirm, confirmText = 'Confirm' }) {
    const modalRoot = document.getElementById('modal-root');
    
    modalRoot.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button id="modal-close-x" style="background:none; border:none; font-size: 1.25rem; cursor:pointer;">&times;</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button id="modal-cancel" class="btn" style="background:#E2E8F0; color:#334155;">Cancel</button>
            <button id="modal-confirm" class="btn btn-primary">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };

    document.getElementById('modal-close-x').addEventListener('click', close);
    document.getElementById('modal-cancel').addEventListener('click', close);
    document.getElementById('modal-confirm').addEventListener('click', async () => {
      if (onConfirm) await onConfirm();
      close();
    });
  }
};