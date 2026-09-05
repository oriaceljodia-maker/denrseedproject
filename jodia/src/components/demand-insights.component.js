import { escapeAttr, escapeHtml } from '../../utils/formatters.js';
import { SeedsService } from '../services/seeds.service.js';

export const DemandInsightsComponent = {
  render() {
    return `
      <section class="demand-insights-grid" aria-label="Seed demand insights">
        <article class="card demand-insight-card">
          <h2 class="demand-insight-title">Top Requested Seed</h2>
          <div id="top-requested-seed" class="top-requested-content">Loading demand data...</div>
        </article>
        <article class="card demand-insight-card">
          <h2 class="demand-insight-title">Top Demanded Seeds</h2>
          <div id="top-demanded-seeds" class="demand-donut-wrap">Loading demand data...</div>
          <p class="demand-insight-note">Share of submitted requests across all seed varieties.</p>
        </article>
      </section>`;
  },

  renderData(requests) {
    const rankings = this.buildRankings(requests);
    const featured = document.getElementById('top-requested-seed');
    const donut = document.getElementById('top-demanded-seeds');
    if (!featured || !donut) return;
    if (!rankings.length) {
      featured.innerHTML = '<p class="demand-empty">No seed requests yet.</p>';
      donut.innerHTML = '<p class="demand-empty">Demand analytics will appear after requests are submitted.</p>';
      return;
    }

    const topRequested = [...rankings].sort((a, b) => b.requestCount - a.requestCount || b.quantity - a.quantity)[0];
    featured.innerHTML = `<img class="top-requested-image" src="${escapeAttr(SeedsService.getImageUrl(topRequested))}" alt="" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1501004318641-b39e6451afbe?auto=format&fit=crop&w=160&q=80';" /><strong>${escapeHtml(topRequested.name)}</strong><span>${topRequested.requestCount} request${topRequested.requestCount === 1 ? '' : 's'} · ${topRequested.quantity} ${escapeHtml(topRequested.unit)} requested</span>`;

    // Seeds can use grams, kilograms, pieces, or packs. Request counts are
    // unit-neutral, while adding their quantities together would be misleading.
    const total = rankings.reduce((sum, seed) => sum + seed.requestCount, 0);
    const seeds = rankings.slice(0, 4);
    const colors = ['#0f7a38', '#287cc0', '#f59e0b', '#8b5cf6'];
    let current = 0;
    const segments = seeds.map((seed, index) => {
      const share = Math.round((seed.requestCount / total) * 100);
      const segment = `${colors[index]} ${current}% ${current + share}%`;
      current += share;
      return segment;
    });
    donut.innerHTML = `<div class="demand-donut" style="background:conic-gradient(${segments.join(', ')})"><span>${total}<small>requests</small></span></div><div class="demand-legend">${seeds.map((seed, index) => `<div><i style="background:${colors[index]}"></i><span>${escapeHtml(seed.name)}</span><strong>${Math.round((seed.requestCount / total) * 100)}%</strong></div>`).join('')}</div>`;
  },

  buildRankings(requests) {
    const bySeed = new Map();
    requests.forEach(request => {
      const id = request.seed_id;
      const current = bySeed.get(id) || { name: request.seeds?.species_name || 'Unknown seed', image_url: request.seeds?.image_url, unit: request.seeds?.unit || 'units', quantity: 0, requestCount: 0 };
      current.quantity += Number(request.quantity) || 0;
      current.requestCount += 1;
      bySeed.set(id, current);
    });
    return [...bySeed.values()].sort((a, b) => b.quantity - a.quantity || b.requestCount - a.requestCount);
  }
};
