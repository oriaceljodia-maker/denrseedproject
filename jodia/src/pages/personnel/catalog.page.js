import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { ModalComponent } from '../../components/modal.component.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml, escapeAttr } from '../../../utils/formatters.js';

export const PersonnelCatalogPage = {
  render() {
    return `
      <div class="catalog-container">
        <div class="catalog-hero">
          <div class="eyebrow">Seed catalog</div>
          <h1>Available Seed Catalog</h1>
          <p>Browse nursery-ready species and request the materials your restoration or planting activity needs.</p>
          <div class="catalog-indicator">• Curated for field operations and reforestation planning</div>
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
            <div class="seed-title">${escapeHtml(seed.species_name)}</div>
            <div class="seed-badge">${escapeHtml(seed.category) || 'General'}</div>
            <div class="seed-stock">Available Quantity: <strong>${seed.quantity} packs</strong><br/>Ideal for restoration, nursery propagation, and field planting programs.</div>
          </div>
          <button class="btn btn-primary btn-request" data-id="${escapeAttr(seed.id)}" data-name="${escapeAttr(seed.species_name)}" ${seed.quantity <= 0 ? 'disabled' : ''}>
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