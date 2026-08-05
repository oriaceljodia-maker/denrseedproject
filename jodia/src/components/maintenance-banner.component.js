export const MaintenanceBannerComponent = {
  getConfig() {
    try {
      return JSON.parse(localStorage.getItem('denrMaintenanceConfig') || '{}');
    } catch (err) {
      return { enabled: false, message: '' };
    }
  },

  render() {
    const config = this.getConfig();
    if (!config.enabled) return '';

    return `
      <div class="maintenance-banner">
        <div>
          <strong>Maintenance mode is active.</strong>
          <p>${config.message || 'Some features may be restricted until maintenance is complete.'}</p>
        </div>
      </div>
    `;
  }
};
