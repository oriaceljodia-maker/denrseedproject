export const FooterComponent = {
  render() {
    const year = new Date().getFullYear();
    return `
      <footer class="app-footer">
        <div class="footer-inner">
          <div class="footer-brand">
            <img src="/assets/images/denr-logo-icon.svg" alt="DENR logo" class="footer-logo" onerror="this.style.display='none'" />
            <div>
              <div class="footer-title">DENR Seed Inventory</div>
              <div class="footer-subtitle">Forestry seed stewardship for conservation and restoration</div>
            </div>
          </div>
          <div class="footer-links">
            <span>Department of Environment and Natural Resources</span>
            <span class="footer-sep">•</span>
            <span>© ${year} All rights reserved</span>
          </div>
        </div>
      </footer>
    `;
  }
};