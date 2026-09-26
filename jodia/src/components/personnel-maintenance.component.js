import { escapeHtml } from '../../utils/formatters.js';

/** Full-screen personnel lock screen shown while an admin enables maintenance. */
export const PersonnelMaintenanceComponent = {
  render(config = {}) {
    const note = config.announcement_message?.trim()
      || 'The seed request service is temporarily unavailable while the system is being maintained.';

    return `
      <main class="personnel-maintenance-screen" aria-labelledby="maintenance-title">
        <section class="personnel-maintenance-card" role="status" aria-live="polite">
          <div class="maintenance-illustration" aria-hidden="true">
            <svg viewBox="0 0 180 128" fill="none">
              <rect x="52" y="15" width="76" height="54" rx="8" fill="#E6F5EA" stroke="#0F7A38" stroke-width="3"/>
              <path d="M64 31h51M64 42h38M64 53h28" stroke="#63B77A" stroke-width="4" stroke-linecap="round"/>
              <path d="m42 51 18-31 18 31H42Z" fill="#E8B136"/>
              <path d="M60 33v12m0 8h.01" stroke="white" stroke-width="4" stroke-linecap="round"/>
              <circle cx="119" cy="72" r="20" fill="#0F7A38"/>
              <path d="M119 59v26M106 72h26M110 63l18 18m0-18-18 18" stroke="white" stroke-width="3" stroke-linecap="round"/>
              <path d="M87 85h56l-8 14H95l-8-14Z" fill="#0B2745" opacity=".9"/>
              <path d="M90 101h48" stroke="#0F7A38" stroke-width="5" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="maintenance-kicker">System notice</span>
          <h1 id="maintenance-title">Under Maintenance</h1>
          <div class="maintenance-divider"><span>◦</span></div>
          <p class="maintenance-admin-note">${escapeHtml(note)}</p>
          <p class="maintenance-wait-copy"><span class="maintenance-wait-loader" aria-hidden="true"></span>This page will reopen automatically when maintenance is complete.</p>
        </section>
      </main>`;
  }
};
