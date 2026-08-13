export const HeaderComponent = {
  render(user) {
    const headerEl = document.getElementById('app-header');

    if (!user) {
      headerEl.classList.add('hidden');
      headerEl.innerHTML = '';
      return;
    }

    console.debug('Rendering header for user:', user?.email);

    const portalLabel = user.role === 'admin' ? 'Administration Console' : 'Personnel Portal';

    headerEl.classList.remove('hidden');
    headerEl.innerHTML = `
      <div class="header-brand">
        <div class="header-logo-wrap">
          <img src="/assets/images/logs.jpg" alt="DENR logo" class="header-logo" />
        </div>
        <div class="header-brand-copy">
          <div class="header-title">DENR Talipan</div>
          <div class="header-subtitle">${portalLabel} — seed inventory management</div>
        </div>
      </div>
    `;
  }
};
