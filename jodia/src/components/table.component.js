import { escapeHtml } from '../../utils/formatters.js';

export const TableComponent = {
  render({ headers = [], data = [], emptyMessage = 'No records found.', renderRow }) {
    if (!Array.isArray(data) || data.length === 0) {
      return `
        <div class="table-empty-message">
          ${escapeHtml(emptyMessage)}
        </div>
      `;
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(item => renderRow(item)).join('')}
        </tbody>
      </table>
    `;
  }
};