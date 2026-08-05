import { SeedsService } from '../../services/seeds.service.js';
import { ModalComponent } from '../../components/modal.component.js';
import { ToastComponent } from '../../components/toast.component.js';

export const AdminInventoryPage = {
  render() {
    return `
      <div class="admin-container">
        <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h1 style="font-size: 1.5rem; color: var(--denr-navy-primary);">Seed Inventory Management</h1>
            <p style="font-size: 0.875rem; color: var(--text-muted);">Manage stock quantities, categories, and reorder alerts</p>
          </div>
          <button id="btn-add-seed" class="btn btn-primary">+ Add New Seed Variety</button>
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
  },

  async loadInventory() {
    try {
      const seeds = await SeedsService.getAllSeeds();
      const tbody = document.getElementById('inventory-table-body');

      if (!seeds || seeds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No seed items recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = seeds.map(seed => {
        const isLowStock = seed.quantity <= seed.reorder_level;
        return `
          <tr>
            <td><strong>${seed.species_name}</strong></td>
            <td>${seed.category || 'Uncategorized'}</td>
            <td>
              ${seed.quantity} 
              ${isLowStock ? '<span class="badge badge-rejected" style="margin-left: 0.5rem;">Low Stock</span>' : ''}
            </td>
            <td>${seed.reorder_level || 10}</td>
            <td>
              <button class="btn btn-secondary btn-edit-seed" data-id="${seed.id}" data-name="${seed.species_name}" data-category="${seed.category || ''}" data-qty="${seed.quantity}" data-reorder="${seed.reorder_level || 10}" style="color: var(--denr-navy-primary); border-color: var(--border-color);">
                Update Stock
              </button>
            </td>
          </tr>
        `;
      }).join('');

      this.bindEditButtons();
    } catch (err) {
      ToastComponent.show('Failed to fetch seed inventory.', 'error');
    }
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
          title: `Update Stock: ${name}`,
          bodyHtml: `
            <div class="form-group">
              <label for="edit-category">Category</label>
              <input type="text" id="edit-category" class="form-input" value="${category}" />
            </div>
            <div class="form-group">
              <label for="edit-quantity">Current Quantity</label>
              <input type="number" id="edit-quantity" class="form-input" min="0" value="${qty}" required />
            </div>
            <div class="form-group">
              <label for="edit-reorder">Reorder Threshold Level</label>
              <input type="number" id="edit-reorder" class="form-input" min="1" value="${reorder}" required />
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