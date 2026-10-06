import { RequestLetterService, REQUEST_LETTER_ACCEPT } from '../services/request-letter.service.js';
import { ModalComponent } from './modal.component.js';
import { ToastComponent } from './toast.component.js';
import { escapeHtml, escapeAttr } from '../../utils/formatters.js';

export const RequestLetterComponent = {
  input(id) {
    return `<div class="form-group request-letter-input">
      <label for="${escapeAttr(id)}">Request Letter / Form (Optional)</label>
      <input type="file" id="${escapeAttr(id)}" class="form-input" accept="${REQUEST_LETTER_ACCEPT}" />
      <small class="form-hint">One PDF, JPG, PNG, DOC, or DOCX file. Maximum 10 MB.</small>
    </div>`;
  },

  body(request, links = null) {
    let content = `<div class="request-letter-empty"><span aria-hidden="true">📎</span><strong>No attachment submitted</strong><p>The personnel did not attach a request letter (it is optional).</p></div>`;
    if (links) {
      const type = request.request_letter_type;
      const preview = type === 'application/pdf'
        ? `<iframe class="request-letter-preview" src="${escapeAttr(links.preview)}" title="Request letter PDF"></iframe>`
        : ['image/jpeg', 'image/png'].includes(type)
          ? `<img class="request-letter-preview" src="${escapeAttr(links.preview)}" alt="Request letter" />`
          : '<div class="request-letter-empty"><span aria-hidden="true">📄</span><strong>Word document attached</strong><p>Download this file to view it in Word or another document app.</p></div>';
      content = `<p class="request-letter-filename">${escapeHtml(request.request_letter_name || 'Request letter')}</p>${preview}
        <div class="request-letter-links"><a class="btn btn-primary" href="${escapeAttr(links.download)}" target="_blank" rel="noopener noreferrer">Download File</a><a class="btn btn-secondary" href="${escapeAttr(links.preview)}" target="_blank" rel="noopener noreferrer">Open File</a></div>
        <small class="form-hint">If the link expires, close and reopen the request letter.</small>`;
    }
    return `<section class="request-letter-panel"><h4>Personnel Attachment</h4><div class="request-letter-card"><strong>Request letter / form</strong><small class="form-hint">${links ? 'Attached file' : 'Optional — none attached'}</small>${content}</div></section>`;
  },

  async open(request) {
    try {
      const links = request.request_letter_path ? await RequestLetterService.getLinks(request) : null;
      ModalComponent.open({ title: 'Request Letter', bodyHtml: this.body(request, links), confirmText: 'Close' });
    } catch (error) {
      ToastComponent.show(error.message || 'Unable to open the request letter.', 'error');
    }
  }
};
