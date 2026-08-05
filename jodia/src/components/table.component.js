import { TableComponent } from '../components/table.component.js';

const html = TableComponent.render({
  headers: ['Species Name', 'Category', 'Stock Quantity', 'Status'],
  data: seedsList,
  emptyMessage: 'No seeds available in the inventory.',
  renderRow: (seed) => `
    <tr>
      <td><strong>${seed.species_name}</strong></td>
      <td>${seed.category || 'N/A'}</td>
      <td>${seed.quantity} packs</td>
      <td>
        <span class="badge ${seed.quantity > 10 ? 'badge-approved' : 'badge-rejected'}">
          ${seed.quantity > 10 ? 'In Stock' : 'Low Stock'}
        </span>
      </td>
    </tr>
  `
});