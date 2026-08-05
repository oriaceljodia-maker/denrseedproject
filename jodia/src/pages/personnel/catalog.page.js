import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { ModalComponent } from '../../components/modal.component.js';
import { ToastComponent } from '../../components/toast.component.js';

export const PersonnelCatalogPage = {
  render() {
    return `
      <div class="catalog-container">
        <div style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.5rem; color: var(--denr-navy-primary);">Available Seed Catalog</h1>
          <p style="font-size: 0.875rem; color: var(--text-muted);">Browse available tree and plant seeds for official distribution</p>
        </div>

        <div id="catalog-grid" class="catalog-grid">
          <p>Loading seed catalog...</p>
        </div>
      </div>
    `;
  },

  async init() {
    try {
      const seeds = await SeedsService.getAllSeeds();
      const container = document.getElementById('catalog-grid');

      if (seeds.length === 0) {
        container.innerHTML = `<p>No seeds currently available in inventory.</p>`;
        return;
      }

      container.innerHTML = seeds.map(seed => `
        <div class="seed-card">
          <div>
            <div class="seed-title">${seed.species_name}</div>
            <div style="font-size:0.75rem; color:var(--denr-green-primary); font-weight:600; margin-top:0.25rem;">${seed.category || 'General'}</div>
            <div class="seed-stock">Available Quantity: <strong>${seed.quantity} packs</strong></div>
          </div>
          <button class="btn btn-primary btn-request" data-id="${seed.id}" data-name="${seed.species_name}" ${seed.quantity <= 0 ? 'disabled' : ''}>
            ${seed.quantity <= 0 ? 'Out of Stock' : 'Request Seeds'}
          </button>
        </div>
      `).join('');

      this.bindRequestButtons();
    } catch (err) {
      ToastComponent.show('Failed to fetch catalog.', 'error');
    }
  },

  bindRequestButtons() {
    document.querySelectorAll('.btn-request').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const seedId = e.currentTarget.getAttribute('data-id');
        const seedName = e.currentTarget.getAttribute('data-name');

        ModalComponent.open({
          title: `Request ${seedName}`,
          bodyHtml: `
            <div class="form-group">
              <label for="req-quantity">Quantity (Packs)</label>
              <input type="number" id="req-quantity" class="form-input" min="1" value="1" required />
            </div>
            <div class="form-group">
              <label for="req-purpose">Purpose of Request</label>
              <textarea id="req-purpose" class="form-input" rows="3" placeholder="Specify planting site / project..." required></textarea>
            </div>
          `,
          confirmText: 'Submit Request',
          onConfirm: async () => {
            const qty = document.getElementById('req-quantity').value;
            const purpose = document.getElementById('req-purpose').value;

            if (!qty || !purpose) {
              ToastComponent.show('Please complete all fields.', 'error');
              return;
            }

            try {
              await RequestsService.createRequest(seedId, parseInt(qty, 10), purpose);
              ToastComponent.show('Request submitted for approval.', 'success');
            } catch (err) {
              ToastComponent.show(err.message || 'Failed to submit request.', 'error');
            }
          }
        });
      });
    });
  }
};