export const MaintenanceBannerComponent = {
  render(config = {}) {
    if (!config.maintenance_enabled) return '';

    return `
      <div class="maintenance-banner">
        <div>
          <strong>Maintenance mode is active.</strong>
          <p>${config.announcement_message || 'Some features are temporarily unavailable until maintenance is complete.'}</p>
        </div>
      </div>
    `;
  }
};
