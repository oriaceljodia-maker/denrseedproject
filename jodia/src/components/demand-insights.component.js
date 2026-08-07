import { escapeHtml } from '../../utils/formatters.js';

export const DemandInsightsComponent = {
  render() {
    return `
      <section class="demand-insights-grid" aria-label="Seed demand insights">
        <article class="card demand-insight-card">
          <h2 class="demand-insight-title"><span aria-hidden="true">★</span> Top Requested Seed</h2>
          <div id="top-requested-seed" class="top-requested-content">Loading demand data...</div>
        </article>
        <article class="card demand-insight-card">
          <h2 class="demand-insight-title"><span aria-hidden="true">▤</span> Top Demanded Seeds</h2>
          <div id="top-demanded-seeds" class="demand-bars">Loading demand data...</div>
          <p class="demand-insight-note">Ranked by total quantity requested across all requests.</p>
        </article>
      </section>`;
  },

  renderData(requests) {
    const rankings = this.buildRankings(requests);
    const featured = document.getElementById('top-requested-seed');
    const bars = document.getElementById('top-demanded-seeds');
    if (!featured || !bars) return;

    if (!rankings.length) {
      featured.innerHTML = '<p class="demand-empty">No seed requests yet.</p>';
      bars.innerHTML = '<p class="demand-empty">Demand rankings will appear after requests are submitted.</p>';
      return;
    }

    const topRequested = [...rankings].sort((a, b) => b.requestCount - a.requestCount || b.quantity - a.quantity)[0];
    const topDemanded = rankings[0];

    featured.innerHTML = `
      <div class="top-requested-mark" aria-hidden="true">🌱</div>
      <strong>${escapeHtml(topRequested.name)}</strong>
      <span>${topRequested.requestCount} request${topRequested.requestCount === 1 ? '' : 's'} · ${topRequested.quantity} packs requested</span>`;

    bars.innerHTML = rankings.slice(0, 5).map(seed => {
      const percentage = Math.max(8, Math.round((seed.quantity / topDemanded.quantity) * 100));
      return `
        <div class="demand-bar-row">
          <div class="demand-bar-label"><span>${escapeHtml(seed.name)}</span><span>${seed.quantity} packs</span></div>
          <div class="demand-bar-track"><div class="demand-bar-fill" style="width:${percentage}%"></div></div>
        </div>`;
    }).join('');
  },

  buildRankings(requests) {
    const bySeed = new Map();
    requests.forEach(request => {
      const id = request.seed_id;
      const name = request.seeds?.species_name || 'Unknown seed';
      const quantity = Number(request.quantity) || 0;
      const current = bySeed.get(id) || { name, quantity: 0, requestCount: 0 };
      current.quantity += quantity;
      current.requestCount += 1;
      bySeed.set(id, current);
    });

    return [...bySeed.values()].sort((a, b) => b.quantity - a.quantity || b.requestCount - a.requestCount);
  }
};
