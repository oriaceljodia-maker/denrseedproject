import { SeedsService } from '../../services/seeds.service.js';
import { ModalComponent } from '../../components/modal.component.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml, escapeAttr } from '../../../utils/formatters.js';

export const AdminInventoryPage = {
  allSeeds: [],

  render() {
    return `
      <div class="admin-container">
        <div class="catalog-hero" style="display:flex; justify-content: space-between; align-items: center; gap:1rem; flex-wrap:wrap;">
          <div>
            <div class="eyebrow">Inventory stewardship</div>
            <h1>Seed Inventory Management</h1>
            <p>Track stock health, maintain nursery readiness, and ensure restoration programs have the right materials at the right time.</p>
            <div class="catalog-indicator">• Supports reforestation and biodiversity programs</div>
          </div>
          <button id="btn-add-seed" class="btn btn-primary">+ Add New Seed Variety</button>
        </div>

        <div class="filter-bar" style="margin-bottom: 1rem;">
          <div class="search-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="inventory-search" class="form-input" placeholder="Search inventory..." />
          </div>
          <select id="inventory-stock-filter" class="form-input">
            <option value="">All Stock Levels</option>
            <option value="low">Low Stock Only</option>
            <option value="in-stock">In Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Species / Variety</th>
                  <th>Category</th>
                  <th>Current Stock (Packs)</th>
                  <th>Reorder Level</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="inventory-table-body">
                <tr><td colspan="5" style="text-align:center;">Loading inventory...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.loadInventory();
    this.bindAddButton();
    this.bindSearchAndFilter();
  },

  async loadInventory() {
    try {
      this.allSeeds = await SeedsService.getAllSeeds();
      this.renderInventory(this.allSeeds);
    } catch (err) {
      ToastComponent.show('Failed to fetch seed inventory.', 'error');
    }
  },

  renderInventory(seeds) {
    const tbody = document.getElementById('inventory-table-body');

    if (!seeds || seeds.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No seed items recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = seeds.map(seed => {
      const isLowStock = seed.quantity <= seed.reorder_level;
      const isOutOfStock = seed.quantity <= 0;
      return `
        <tr>
          <td><strong>${escapeHtml(seed.species_name)}</strong></td>
          <td>${escapeHtml(seed.category) || 'Uncategorized'}</td>
          <td>
            ${seed.quantity} 
            ${isOutOfStock ? '<span class="badge badge-rejected" style="margin-left: 0.5rem;">Out of Stock</span>' : (isLowStock ? '<span class="badge badge-pending" style="margin-left: 0.5rem;">Low Stock</span>' : '')}
          </td>
          <td>${seed.reorder_level || 10}</td>
          <td>
            <button class="btn btn-secondary btn-edit-seed" data-id="${escapeAttr(seed.id)}" data-name="${escapeAttr(seed.species_name)}" data-category="${escapeAttr(seed.category)}" data-qty="${escapeAttr(seed.quantity)}" data-reorder="${escapeAttr(seed.reorder_level || 10)}" style="color: var(--denr-navy-primary); border-color: var(--border-color);">
              Update Stock
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.bindEditButtons();
  },

  bindSearchAndFilter() {
    const searchInput = document.getElementById('inventory-search');
    const stockFilter = document.getElementById('inventory-stock-filter');

    const applyFilters = () => {
      const query = (searchInput?.value || '').toLowerCase().trim();
      const stockLevel = stockFilter?.value || '';

      const filtered = this.allSeeds.filter(seed => {
        const matchesQuery = !query || 
          (seed.species_name || '').toLowerCase().includes(query) ||
          (seed.category || '').toLowerCase().includes(query);
        
        let matchesStock = true;
        if (stockLevel === 'low') matchesStock = seed.quantity > 0 && seed.quantity <= seed.reorder_level;
        else if (stockLevel === 'in-stock') matchesStock = seed.quantity > seed.reorder_level;
        else if (stockLevel === 'out') matchesStock = seed.quantity <= 0;

        return matchesQuery && matchesStock;
      });

      this.renderInventory(filtered);
    };

    searchInput?.addEventListener('input', applyFilters);
    stockFilter?.addEventListener('change', applyFilters);
  },

  bindAddButton() {
    document.getElementById('btn-add-seed')?.addEventListener('click', () => {
      ModalComponent.open({
        title: 'Add New Seed Variety',
        bodyHtml: `
          <div class="form-group">
            <label for="new-species">Species / Variety Name</label>
            <input type="text" id="new-species" class="form-input" required placeholder="e.g. Narra (Pterocarpus indicus)" />
          </div>
          <div class="form-group">
            <label for="new-category">Category</label>
            <input type="text" id="new-category" class="form-input" placeholder="e.g. Indigenous Tree, Fruit Tree" />
          </div>
          <div class="form-group">
            <label for="new-quantity">Initial Stock Quantity</label>
            <input type="number" id="new-quantity" class="form-input" min="0" value="100" required />
          </div>
          <div class="form-group">
            <label for="new-reorder">Reorder Threshold Level</label>
            <input type="number" id="new-reorder" class="form-input" min="1" value="10" required />
          </div>
        `,
        confirmText: 'Save Seed Entry',
        onConfirm: async () => {
          const species_name = document.getElementById('new-species').value.trim();
          const category = document.getElementById('new-category').value.trim();
          const quantity = parseInt(document.getElementById('new-quantity').value, 10);
          const reorder_level = parseInt(document.getElementById('new-reorder').value, 10);

          if (!species_name) {
            ToastComponent.show('Species name is required.', 'error');
            return;
          }

          try {
            await SeedsService.addSeed({ species_name, category, quantity, reorder_level });
            ToastComponent.show('New seed entry created.', 'success');
            await this.loadInventory();
          } catch (err) {
            ToastComponent.show(err.message || 'Failed to add seed.', 'error');
          }
        }
      });
    });
  },

  bindEditButtons() {
    document.querySelectorAll('.btn-edit-seed').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const id = target.getAttribute('data-id');
        const name = target.getAttribute('data-name');
        const category = target.getAttribute('data-category');
        const qty = target.getAttribute('data-qty');
        const reorder = target.getAttribute('data-reorder');

        ModalComponent.open({
          title: `Update Stock: ${escapeHtml(name)}`,
          bodyHtml: `
            <div class="form-group">
              <label for="edit-category">Category</label>
              <input type="text" id="edit-category" class="form-input" value="${escapeAttr(category)}" />
            </div>
            <div class="form-group">
              <label for="edit-quantity">Current Quantity</label>
              <input type="number" id="edit-quantity" class="form-input" min="0" value="${escapeAttr(qty)}" required />
            </div>
            <div class="form-group">
              <label for="edit-reorder">Reorder Threshold Level</label>
              <input type="number" id="edit-reorder" class="form-input" min="1" value="${escapeAttr(reorder)}" required />
            </div>
          `,
          confirmText: 'Update Inventory',
          onConfirm: async () => {
            const updatedCategory = document.getElementById('edit-category').value.trim();
            const updatedQty = parseInt(document.getElementById('edit-quantity').value, 10);
            const updatedReorder = parseInt(document.getElementById('edit-reorder').value, 10);

            try {
              await SeedsService.updateSeed(id, {
                category: updatedCategory,
                quantity: updatedQty,
                reorder_level: updatedReorder
              });
              ToastComponent.show('Inventory updated successfully.', 'success');
              await this.loadInventory();
            } catch (err) {
              ToastComponent.show(err.message || 'Failed to update item.', 'error');
            }
          }
        });
      });
    });
  }
};