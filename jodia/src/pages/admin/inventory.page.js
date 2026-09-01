import { SeedsService } from '../../services/seeds.service.js';
import { ModalComponent } from '../../components/modal.component.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml, escapeAttr } from '../../../utils/formatters.js';

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const imageUploadField = ({ prefix, imageUrl = '' }) => `
  <div class="form-group seed-image-field">
    <label for="${prefix}-image-file">Seed Image <span class="field-optional">(optional)</span></label>
    <div class="seed-image-upload">
      <input type="file" id="${prefix}-image-file" accept="image/jpeg,image/png,image/webp" hidden />
      <label class="seed-image-dropzone" for="${prefix}-image-file">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3.5 3.5 2-2L20 19"/></svg>
        <span><strong>Upload seed image</strong><small>Select an image from your computer</small></span>
      </label>
      <div class="seed-image-preview ${imageUrl ? '' : 'hidden'}" id="${prefix}-image-preview">
        <img id="${prefix}-image-preview-img" src="${escapeAttr(imageUrl)}" alt="Selected seed preview" />
        <div class="seed-image-preview-copy">
          <strong id="${prefix}-image-name">${imageUrl ? 'Current seed image' : ''}</strong>
          <div class="seed-image-actions">
            <button type="button" class="seed-image-action" id="${prefix}-image-change">Change image</button>
            <button type="button" class="seed-image-action seed-image-remove" id="${prefix}-image-remove">Remove</button>
          </div>
        </div>
      </div>
    </div>
    <span class="seed-image-formats">PNG or JPG <span aria-hidden="true">•</span> Max 5MB</span>
  </div>
`;

const readImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Unable to read the selected image.'));
  reader.readAsDataURL(file);
});

const bindImageUploadField = ({ prefix, initialImageUrl = '', onChange }) => {
  const input = document.getElementById(`${prefix}-image-file`);
  const preview = document.getElementById(`${prefix}-image-preview`);
  const previewImage = document.getElementById(`${prefix}-image-preview-img`);
  const name = document.getElementById(`${prefix}-image-name`);
  let selectedFile = null;
  let imageUrl = initialImageUrl;

  const updatePreview = (url, label) => {
    previewImage.src = url || '';
    name.textContent = label || '';
    preview.classList.toggle('hidden', !url);
  };

  const notify = () => onChange({ file: selectedFile, imageUrl });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      input.value = '';
      ToastComponent.show('Choose a JPG or PNG image smaller than 5MB.', 'error');
      return;
    }

    selectedFile = file;
    imageUrl = URL.createObjectURL(file);
    updatePreview(imageUrl, file.name);
    notify();
  });

  document.getElementById(`${prefix}-image-change`).addEventListener('click', () => input.click());
  document.getElementById(`${prefix}-image-remove`).addEventListener('click', () => {
    selectedFile = null;
    imageUrl = '';
    input.value = '';
    updatePreview('', '');
    notify();
  });

  notify();
};

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
          <button id="btn-add-seed" class="btn btn-primary">+ Add Seed</button>
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
                  <th>Seed</th>
                  <th>Category</th>
                  <th>Current Stock</th>
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
          <td class="inventory-seed-cell"><img class="inventory-seed-image" src="${escapeAttr(SeedsService.getImageUrl(seed))}" alt="" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1501004318641-b39e6451afbe?auto=format&fit=crop&w=160&q=80';" /><strong>${escapeHtml(seed.species_name)}</strong></td>
          <td>${escapeHtml(seed.category) || 'Uncategorized'}</td>
          <td>
            ${seed.quantity} ${escapeHtml(seed.unit || 'packs')}
            ${isOutOfStock ? '<span class="badge badge-rejected" style="margin-left: 0.5rem;">Out of Stock</span>' : (isLowStock ? '<span class="badge badge-pending" style="margin-left: 0.5rem;">Low Stock</span>' : '')}
          </td>
          <td>${seed.reorder_level || 10}</td>
          <td>
            <button class="btn btn-secondary inventory-action-button btn-edit-seed" data-id="${escapeAttr(seed.id)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
              Edit
            </button>
            <button class="btn btn-danger inventory-action-button btn-delete-seed" data-id="${escapeAttr(seed.id)}" data-name="${escapeAttr(seed.species_name)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
              Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.bindEditButtons();
    this.bindDeleteButtons();
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
      let selectedImage = { file: null, imageUrl: '' };
      ModalComponent.open({
        title: 'Add Seed',
        bodyHtml: `
          <div class="seed-entry-form">
            ${imageUploadField({ prefix: 'new' })}
            <div class="seed-form-grid">
              <div class="form-group"><label for="new-species">Common Name</label><input type="text" id="new-species" class="form-input" required placeholder="e.g. Narra" /></div>
              <div class="form-group"><label for="new-scientific-name">Scientific Name</label><input type="text" id="new-scientific-name" class="form-input" placeholder="e.g. Pterocarpus indicus" /></div>
              <div class="form-group"><label for="new-category">Category</label><select id="new-category" class="form-input"><option value="Timber">Timber</option><option value="Fruit-bearing">Fruit-bearing</option><option value="Native">Native</option><option value="Ornamental">Ornamental</option><option value="Other">Other</option></select></div>
              <div class="form-group"><label for="new-source-location">Source / Location</label><input type="text" id="new-source-location" class="form-input" placeholder="e.g. Pagbilao Nursery" /></div>
              <div class="form-group"><label for="new-quantity">Stock Quantity</label><input type="number" id="new-quantity" class="form-input" min="0" placeholder="e.g. 120" required /></div>
              <div class="form-group"><label for="new-unit">Unit</label><select id="new-unit" class="form-input"><option value="g">g</option><option value="kg">kg</option><option value="pcs">pcs</option><option value="packs" selected>packs</option></select></div>
              <div class="form-group"><label for="new-processing-status">Lab / Processing Status</label><select id="new-processing-status" class="form-input"><option>Newly collected</option><option>Moisture content</option><option>For Germination Test</option><option>Germinating</option><option>Ready for Distribution</option></select></div>
              <div class="form-group"><label for="new-reorder">Reorder Level</label><input type="number" id="new-reorder" class="form-input" min="1" value="10" required /></div>
            </div>
            <div class="form-group"><label for="new-notes">Notes <span class="field-optional">(optional)</span></label><textarea id="new-notes" class="form-input" rows="3" placeholder="Optional notes about this accession"></textarea></div>
          </div>
        `,
        confirmText: 'Save Seed',
        onConfirm: async () => {
          const species_name = document.getElementById('new-species').value.trim();
          const category = document.getElementById('new-category').value.trim();
          const image_url = selectedImage.file ? await readImageFile(selectedImage.file) : null;
          const quantity = parseInt(document.getElementById('new-quantity').value, 10);
          const reorder_level = parseInt(document.getElementById('new-reorder').value, 10);
          const scientific_name = document.getElementById('new-scientific-name').value.trim() || null;
          const source_location = document.getElementById('new-source-location').value.trim() || null;
          const unit = document.getElementById('new-unit').value;
          const processing_status = document.getElementById('new-processing-status').value;
          const notes = document.getElementById('new-notes').value.trim() || null;

          if (!species_name) {
            ToastComponent.show('Species name is required.', 'error');
            return;
          }

          try {
            await SeedsService.addSeed({ species_name, scientific_name, category, source_location, image_url, quantity, unit, processing_status, notes, reorder_level });
            ToastComponent.show('New seed entry created.', 'success');
            await this.loadInventory();
          } catch (err) {
            ToastComponent.show(err.message || 'Failed to add seed.', 'error');
          }
        }
      });
      bindImageUploadField({ prefix: 'new', onChange: (image) => { selectedImage = image; } });
    });
  },

  bindEditButtons() {
    document.querySelectorAll('.btn-edit-seed').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const id = target.getAttribute('data-id');
        const seed = this.allSeeds.find(item => item.id === id);
        if (!seed) return;
        const name = seed.species_name;
        const imageUrl = seed.image_url || '';
        let selectedImage = { file: null, imageUrl };

        ModalComponent.open({
          title: `Update Stock: ${escapeHtml(name)}`,
          bodyHtml: `
            ${imageUploadField({ prefix: 'edit', imageUrl })}
            <div class="seed-form-grid">
              <div class="form-group"><label for="edit-species">Common Name</label><input id="edit-species" class="form-input" value="${escapeAttr(seed.species_name)}" required /></div>
              <div class="form-group"><label for="edit-scientific-name">Scientific Name</label><input id="edit-scientific-name" class="form-input" value="${escapeAttr(seed.scientific_name || '')}" /></div>
              <div class="form-group"><label for="edit-category">Category</label><input id="edit-category" class="form-input" value="${escapeAttr(seed.category || '')}" /></div>
              <div class="form-group"><label for="edit-source-location">Source / Location</label><input id="edit-source-location" class="form-input" value="${escapeAttr(seed.source_location || '')}" /></div>
              <div class="form-group"><label for="edit-quantity">Stock Quantity</label><input type="number" id="edit-quantity" class="form-input" min="0" value="${escapeAttr(seed.quantity)}" required /></div>
              <div class="form-group"><label for="edit-unit">Unit</label><select id="edit-unit" class="form-input">${['g', 'kg', 'pcs', 'packs'].map(unit => `<option ${seed.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}</select></div>
              <div class="form-group"><label for="edit-processing-status">Lab / Processing Status</label><input id="edit-processing-status" class="form-input" value="${escapeAttr(seed.processing_status || '')}" /></div>
              <div class="form-group"><label for="edit-reorder">Reorder Level</label><input type="number" id="edit-reorder" class="form-input" min="1" value="${escapeAttr(seed.reorder_level || 10)}" required /></div>
            </div>
            <div class="form-group">
              <label for="edit-notes">Notes <span class="field-optional">(optional)</span></label>
              <textarea id="edit-notes" class="form-input" rows="4" placeholder="Add notes or details about this seed variety">${escapeHtml(seed.notes || seed.description || '')}</textarea>
            </div>
          `,
          confirmText: 'Update Inventory',
          onConfirm: async () => {
            const updatedCategory = document.getElementById('edit-category').value.trim();
            const updatedImageUrl = selectedImage.file
              ? await readImageFile(selectedImage.file)
              : (selectedImage.imageUrl || null);
            const updatedQty = parseInt(document.getElementById('edit-quantity').value, 10);
            const updatedReorder = parseInt(document.getElementById('edit-reorder').value, 10);
            const updatedNotes = document.getElementById('edit-notes').value.trim();

            try {
              await SeedsService.updateSeed(id, {
                species_name: document.getElementById('edit-species').value.trim(),
                scientific_name: document.getElementById('edit-scientific-name').value.trim() || null,
                category: updatedCategory,
                source_location: document.getElementById('edit-source-location').value.trim() || null,
                image_url: updatedImageUrl,
                quantity: updatedQty,
                unit: document.getElementById('edit-unit').value,
                processing_status: document.getElementById('edit-processing-status').value.trim() || null,
                reorder_level: updatedReorder,
                notes: updatedNotes || null
              });
              ToastComponent.show('Inventory updated successfully.', 'success');
              await this.loadInventory();
            } catch (err) {
              ToastComponent.show(err.message || 'Failed to update item.', 'error');
            }
          }
        });
        bindImageUploadField({ prefix: 'edit', initialImageUrl: imageUrl, onChange: (image) => { selectedImage = image; } });
      });
    });
  },

  bindDeleteButtons() {
    document.querySelectorAll('.btn-delete-seed').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget;
        const id = target.getAttribute('data-id');
        const name = target.getAttribute('data-name');

        let requestCount;
        try {
          requestCount = await SeedsService.getRequestCount(id);
        } catch (err) {
          ToastComponent.show(err.message || 'Unable to check linked requests.', 'error');
          return;
        }

        const linkedRequestsWarning = requestCount > 0
          ? `<p><strong>${requestCount} linked ${requestCount === 1 ? 'request will' : 'requests will'} also be permanently removed.</strong></p>`
          : '';

        ModalComponent.open({
          title: 'Delete Seed?',
          bodyHtml: `<p>Are you sure you want to delete <strong>${escapeHtml(name)}</strong>? This action cannot be undone.</p>${linkedRequestsWarning}`,
          confirmText: 'Delete',
          confirmClass: 'btn-danger',
          onConfirm: async () => {
            try {
              await SeedsService.deleteSeed(id);
              ToastComponent.show('Seed entry deleted.', 'success');
              await this.loadInventory();
            } catch (err) {
              ToastComponent.show(err.message || 'Failed to delete seed entry.', 'error');
            }
          }
        });
      });
    });
  }
};
