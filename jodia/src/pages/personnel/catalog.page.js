import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ROUTES } from '../../config/constants.js';
import { ModalComponent } from '../../components/modal.component.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml, escapeAttr } from '../../../utils/formatters.js';

export const PersonnelCatalogPage = {
  allSeeds: [],

  render() {
    return `
      <div class="catalog-container">
        <div class="page-header">
          <div>
            <div class="eyebrow">Personnel portal</div>
            <h1 class="page-title">Available Seed Catalog</h1>
            <p class="page-subtitle">Browse nursery-ready species and request the materials your restoration or planting activity needs.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="view-requests-button">View My Requests</button>
          </div>
        </div>

        <div class="banner-card">
          <div>
            <h2>Inventory snapshot</h2>
            <p>Live stock details for your field operations, with low-stock alerts and quick access to request forms.</p>
          </div>
          <div class="catalog-overview-grid" id="catalog-overview-grid"></div>
        </div>

        <div class="catalog-toolbar">
          <div class="search-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="catalog-search" class="form-input" placeholder="Search seed species..." />
          </div>
          <select id="catalog-category-filter" class="form-input">
            <option value="">All Categories</option>
          </select>
        </div>

        <div id="category-chips" class="category-chips"></div>

        <div id="catalog-grid" class="catalog-grid">
          <p>Loading seed catalog...</p>
        </div>
      </div>
    `;
  },

  async init() {
    try {
      this.allSeeds = await SeedsService.getAllSeeds();
      this.populateCategoryFilter();
      this.renderOverview(this.allSeeds);
      this.renderCatalog(this.allSeeds);
      this.bindSearchAndFilter();
      this.bindGlobalActions();
    } catch (err) {
      ToastComponent.show('Failed to fetch catalog.', 'error');
    }
  },

  renderOverview(seeds) {
    const totalSeeds = seeds.length;
    const categories = new Set(seeds.map(s => s.category).filter(Boolean)).size;
    const lowStock = seeds.filter(s => s.quantity <= s.reorder_level).length;
    const totalAvailable = seeds.reduce((sum, seed) => sum + (seed.quantity || 0), 0);

    const container = document.getElementById('catalog-overview-grid');
    if (!container) return;

    container.innerHTML = `
      <div class="overview-card">
        <span>Total varieties</span>
        <strong>${totalSeeds}</strong>
      </div>
      <div class="overview-card">
        <span>Available packs</span>
        <strong>${totalAvailable}</strong>
      </div>
      <div class="overview-card">
        <span>Low stock alerts</span>
        <strong>${lowStock}</strong>
      </div>
      <div class="overview-card">
        <span>Seed categories</span>
        <strong>${categories}</strong>
      </div>
    `;
  },

  bindGlobalActions() {
    document.getElementById('view-requests-button')?.addEventListener('click', async () => {
      const currentUser = await AuthService.getCurrentUser();
      await Router.navigate(currentUser, ROUTES.PERSONNEL_REQUESTS);
    });
  },

  populateCategoryFilter() {
    const categories = [...new Set(this.allSeeds.map(s => s.category).filter(Boolean))];
    const select = document.getElementById('catalog-category-filter');
    const chipsContainer = document.getElementById('category-chips');

    if (categories.length > 0) {
      select.innerHTML = `<option value="">All Categories</option>` + categories.map(c => 
        `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`
      ).join('');

      chipsContainer.innerHTML = `
        <button class="category-chip active" data-category="">All</button>
        ${categories.map(c => 
          `<button class="category-chip" data-category="${escapeAttr(c)}">${escapeHtml(c)}</button>`
        ).join('')}
      `;
    }
  },

  renderCatalog(seeds) {
    const container = document.getElementById('catalog-grid');

    if (seeds.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <h3>No seeds found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = seeds.map(seed => {
      const isOutOfStock = seed.quantity <= 0;
      const isLowStock = seed.quantity > 0 && seed.quantity <= seed.reorder_level;
      const stockClass = isOutOfStock ? 'out-of-stock' : (isLowStock ? 'low-stock' : 'in-stock');
      const stockLabel = isOutOfStock ? 'Out of Stock' : (isLowStock ? 'Low Stock' : 'In Stock');

      return `
        <div class="seed-card ${isOutOfStock ? 'out-of-stock' : ''}">
          <div>
            <div class="seed-title">${escapeHtml(seed.species_name)}</div>
            <div class="seed-badge">${escapeHtml(seed.category) || 'General'}</div>
            <div class="seed-stock">Available Quantity: <strong>${seed.quantity} packs</strong><br/>Ideal for restoration, nursery propagation, and field planting programs.</div>
            <div class="stock-indicator">
              <span class="stock-dot ${stockClass}"></span>
              ${stockLabel}
            </div>
          </div>
          <button class="btn btn-primary btn-request" data-id="${escapeAttr(seed.id)}" data-name="${escapeAttr(seed.species_name)}" ${isOutOfStock ? 'disabled' : ''}>
            ${isOutOfStock ? 'Out of Stock' : 'Request Seeds'}
          </button>
        </div>
      `;
    }).join('');

    this.bindRequestButtons();
  },

  bindSearchAndFilter() {
    const searchInput = document.getElementById('catalog-search');
    const categorySelect = document.getElementById('catalog-category-filter');
    const chipsContainer = document.getElementById('category-chips');

    const applyFilters = () => {
      const query = (searchInput?.value || '').toLowerCase().trim();
      const category = categorySelect?.value || '';

      const filtered = this.allSeeds.filter(seed => {
        const matchesQuery = !query || 
          (seed.species_name || '').toLowerCase().includes(query) ||
          (seed.category || '').toLowerCase().includes(query);
        const matchesCategory = !category || seed.category === category;
        return matchesQuery && matchesCategory;
      });

      this.renderCatalog(filtered);
    };

    searchInput?.addEventListener('input', applyFilters);
    categorySelect?.addEventListener('change', applyFilters);

    chipsContainer?.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chipsContainer.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const category = chip.getAttribute('data-category');
        if (categorySelect) categorySelect.value = category;
        applyFilters();
      });
    });
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