import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { DemandInsightsComponent } from '../../components/demand-insights.component.js';
import { AuditTrailService } from '../../services/audit-trail.service.js';
import { Router } from '../../router/router.js';
import { AuthService } from '../../services/auth.service.js';
import { ROUTES } from '../../config/constants.js';
import { escapeHtml } from '../../../utils/formatters.js';

export const AdminDashboardPage = {
  render() {
    return `
      <div class="admin-container">
        <section class="dashboard-hero">
          <div class="hero-copy">
            <span class="eyebrow">Operational dashboard</span>
            <h1 class="hero-title">DENR Seed Control Center</h1>
            <p class="hero-text">Monitor inventory, pending requests, and low-stock alerts through a field-focused operations hub for reforestation and conservation teams.</p>
            <div class="hero-badges">
              <span class="hero-badge">Reforestation focused</span>
              <span class="hero-badge">Quick approvals</span>
              <span class="hero-badge">Field-ready insights</span>
            </div>
          </div>
          <div class="hero-card">
            <div class="hero-card-top">
              <div>
                <h2>System health</h2>
                <p>Live metrics powered by inventory and request activity.</p>
              </div>
              <div class="hero-chip">Live</div>
            </div>
            <div class="hero-stats-grid">
              <div>
                <span>Total seed varieties</span>
                <strong id="stat-total-seeds">-</strong>
              </div>
              <div>
                <span>Pending requests</span>
                <strong id="stat-pending-requests">-</strong>
              </div>
              <div>
                <span>Low stock items</span>
                <strong id="stat-low-stock">-</strong>
              </div>
            </div>
            <div class="hero-graph">
              <div class="graph-label">
                <span>Request trend</span>
                <strong id="stat-request-trend">-</strong>
              </div>
              <div id="request-trend-chart" class="request-trend-chart"></div>
            </div>
          </div>
        </section>

        <section class="stats-grid">
          <div class="stat-card" style="--stat-icon-color: var(--denr-green-primary);">
            <div class="stat-card-content">
              <div><div class="stat-title">Total Inventory</div><div class="stat-value" id="stat-total-packs">-</div></div>
              <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="m4 8 8 4 8-4M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/></svg></span>
            </div>
          </div>
          <div class="stat-card" style="border-left-color: var(--status-warning); --stat-icon-color: var(--status-warning);">
            <div class="stat-card-content">
              <div><div class="stat-title">Approved Requests</div><div class="stat-value" id="stat-approved">-</div></div>
              <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4.5h6v3H9zM8.5 13l2.1 2.1 4.5-4.5"/></svg></span>
            </div>
          </div>
          <div class="stat-card" style="border-left-color: var(--status-info); --stat-icon-color: var(--status-info);">
            <div class="stat-card-content">
              <div><div class="stat-title">Total Requests</div><div class="stat-value" id="stat-total-requests">-</div></div>
              <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3.5h7l3 3V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"/><path d="M14 3.5V7h3M9 11h6M9 15h4"/></svg></span>
            </div>
          </div>
          <div class="stat-card" style="border-left-color: var(--status-danger); --stat-icon-color: var(--status-danger);">
            <div class="stat-card-content">
              <div><div class="stat-title">Rejected Requests</div><div class="stat-value" id="stat-rejected">-</div></div>
              <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6m0-6-6 6"/></svg></span>
            </div>
          </div>
        </section>

        ${DemandInsightsComponent.render()}

        <section class="analytics-section" aria-label="Planning analytics">
          <div class="analytics-section-heading"><span class="eyebrow">Planning analytics</span><h2>Demand patterns and field purpose</h2><p>Use monthly request volume and purpose categories to plan collection and distribution activities.</p></div>
          <div class="analytics-controls" role="group" aria-label="Analytics period"><button type="button" class="analytics-range active" data-range="6">Last 6 Months</button><button type="button" class="analytics-range" data-range="12">Last 12 Months</button><button type="button" class="analytics-range" data-range="0">All Time</button></div>
          <div class="analytics-grid"><article class="card analytics-card"><h3>Monthly Request Volume</h3><div id="monthly-request-chart" class="monthly-request-chart">Loading monthly data...</div></article><article class="card analytics-card"><h3>Requests by Purpose</h3><div id="purpose-category-chart" class="purpose-category-chart">Loading purpose data...</div></article></div>
        </section>

        <section class="card low-stock-alerts-card" aria-label="Low stock alerts">
          <div class="low-stock-alerts-header"><h2 class="section-title">Low Stock Alerts</h2><button type="button" id="btn-view-low-stock" class="btn btn-secondary low-stock-view-all">View All</button></div>
          <div id="dashboard-low-stock-alerts" class="low-stock-alerts-list"><p class="audit-trail-empty">Loading low stock alerts...</p></div>
        </section>

        <section class="dashboard-main-grid">
          <div class="card audit-trail-card">
            <div class="audit-trail-header">
              <div class="section-title audit-trail-title"><span aria-hidden="true">▣</span>Recent Audit Trail</div>
              <button type="button" id="btn-view-all-audit" class="audit-trail-link">View All</button>
            </div>
            <p class="audit-trail-subtitle">Last 10 actions</p>
            <div id="dashboard-audit-trail" class="dashboard-audit-trail" aria-live="polite">
              <p class="audit-trail-empty">Loading audit trail...</p>
            </div>
          </div>

          <div class="card">
            <div class="section-title">Recent requests</div>
            <div class="table-container">
              <table class="data-table modern-table">
                <thead>
                  <tr>
                    <th>Requested By</th>
                    <th>Seed Variety</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody id="dashboard-requests-body">
                  <tr><td colspan="5" style="text-align:center;">Loading requests...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    `;
  },

  async init() {
    await this.loadMetrics();
    this.bindAuditTrailLink();
    this.bindLowStockLink();
    this.startLiveSync();
    this.bindAnalyticsControls();
  },

  bindAuditTrailLink() {
    document.getElementById('btn-view-all-audit')?.addEventListener('click', async () => {
      const user = await AuthService.getCurrentUser();
      await Router.navigate(user, ROUTES.ADMIN_LOGIN_TRAILS);
    });
  },

  bindLowStockLink() {
    document.getElementById('btn-view-low-stock')?.addEventListener('click', async () => {
      const user = await AuthService.getCurrentUser();
      await Router.navigate(user, ROUTES.ADMIN_INVENTORY);
    });
  },

  bindAnalyticsControls() {
    document.querySelectorAll('.analytics-range').forEach(button => button.addEventListener('click', event => {
      document.querySelectorAll('.analytics-range').forEach(item => item.classList.remove('active'));
      event.currentTarget.classList.add('active');
      this.analyticsRange = Number(event.currentTarget.dataset.range);
      this.renderPlanningAnalytics(this.latestRequests || []);
    }));
  },

  startLiveSync() {
    if (this.liveSyncStarted) return;
    const refreshIfVisible = () => {
      if (window.location.pathname === '/admin/dashboard') this.loadMetrics();
    };
    this.seedChannel = SeedsService.subscribeToSeeds(refreshIfVisible);
    this.requestChannel = RequestsService.subscribeToRequests(refreshIfVisible);
    this.liveSyncStarted = true;
  },

  async loadMetrics() {
    try {
      const [seeds, requests, auditResult] = await Promise.all([
        SeedsService.getAllSeeds(),
        RequestsService.getRequests(),
        AuditTrailService.getActivity(10)
      ]);

      const pendingCount = requests.filter(r => r.status === 'PENDING').length;
      const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
      const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;
      const lowStockSeeds = seeds.filter(seed => SeedsService.getStockStatus(seed).key !== 'in-stock');
      const lowStockCount = lowStockSeeds.length;
      const totalPacks = seeds.reduce((sum, s) => sum + (s.quantity || 0), 0);

      document.getElementById('stat-total-seeds').textContent = seeds.length;
      document.getElementById('stat-pending-requests').textContent = pendingCount;
      document.getElementById('stat-low-stock').textContent = lowStockCount;
      document.getElementById('stat-total-packs').textContent = totalPacks;
      document.getElementById('stat-approved').textContent = approvedCount;
      document.getElementById('stat-total-requests').textContent = requests.length;
      document.getElementById('stat-rejected').textContent = rejectedCount;
      DemandInsightsComponent.renderData(requests);
      this.latestRequests = requests;
      this.renderPlanningAnalytics(requests);
      this.renderLowStockAlerts(lowStockSeeds);

      // Calculate request trend percentage
      const trendEl = document.getElementById('stat-request-trend');
      if (requests.length > 0) {
        const approvedPct = Math.round((approvedCount / requests.length) * 100);
        trendEl.textContent = `${approvedPct}% approved`;
      } else {
        trendEl.textContent = 'No data';
      }

      this.renderTrendChart(requests);
      this.renderAuditTrail(auditResult.activity, auditResult.auditTrailAvailable);

      const tbody = document.getElementById('dashboard-requests-body');
      if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No recent requests found.</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.slice(0, 5).map(req => `
        <tr>
          <td>${escapeHtml(req.profiles?.full_name) || 'Personnel'}</td>
          <td>${escapeHtml(req.seeds?.species_name) || 'N/A'}</td>
          <td>${req.quantity ?? '—'}</td>
          <td><span class="badge badge-${escapeHtml((req.status || 'Unknown').toLowerCase())}">${escapeHtml(req.status || 'Unknown')}</span></td>
          <td>${req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Unknown'}</td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Dashboard load error:', err);
      ToastComponent.show('Failed to load dashboard metrics.', 'error');
    }
  },

  renderLowStockAlerts(seeds) {
    const container = document.getElementById('dashboard-low-stock-alerts');
    if (!container) return;
    if (!seeds.length) {
      container.innerHTML = '<p class="audit-trail-empty">All seed inventory is above its low-stock alert level.</p>';
      return;
    }
    container.innerHTML = seeds.slice(0, 5).map(seed => {
      const status = SeedsService.getStockStatus(seed);
      return `<article class="low-stock-alert ${status.key}">
        <span class="low-stock-alert-icon" aria-hidden="true">◌</span>
        <div><strong>${escapeHtml(seed.species_name)}</strong><small>Stock: ${escapeHtml(SeedsService.formatQuantity(seed))} remaining</small></div>
        <span class="stock-status-badge ${status.key}">${status.label}</span>
      </article>`;
    }).join('');
  },

  renderPlanningAnalytics(requests) {
    const range = this.analyticsRange ?? 6;
    const now = new Date();
    const months = range ? Array.from({ length: range }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (range - 1 - index), 1);
      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString(undefined, { month: 'short' }) };
    }) : [];
    const filtered = range ? requests.filter(request => new Date(request.created_at) >= new Date(now.getFullYear(), now.getMonth() - (range - 1), 1)) : requests;
    const monthly = months.map(month => ({ ...month, value: filtered.filter(request => {
      const date = new Date(request.created_at);
      return `${date.getFullYear()}-${date.getMonth()}` === month.key;
    }).length }));
    const monthlyContainer = document.getElementById('monthly-request-chart');
    if (monthlyContainer) {
      const max = Math.max(...monthly.map(item => item.value), 1);
      monthlyContainer.innerHTML = monthly.length ? `<div class="month-bars">${monthly.map(item => `<div class="month-bar-item"><span class="month-bar-value">${item.value}</span><div class="month-bar-track"><i style="height:${Math.max(8, (item.value / max) * 100)}%"></i></div><span>${escapeHtml(item.label)}</span></div>`).join('')}</div>` : '<p class="analytics-empty">Select a period to view monthly request volume.</p>';
    }
    const byPurpose = new Map();
    filtered.forEach(request => {
      const key = request.purpose_category || 'Uncategorized';
      byPurpose.set(key, (byPurpose.get(key) || 0) + 1);
    });
    const purposes = [...byPurpose.entries()].sort((a, b) => b[1] - a[1]);
    const purposeContainer = document.getElementById('purpose-category-chart');
    if (purposeContainer) {
      const max = Math.max(...purposes.map(([, value]) => value), 1);
      purposeContainer.innerHTML = purposes.length ? `<div class="purpose-bars">${purposes.slice(0, 5).map(([label, value]) => `<div><div class="purpose-label"><span>${escapeHtml(label)}</span><strong>${value}</strong></div><div class="purpose-track"><i style="width:${(value / max) * 100}%"></i></div></div>`).join('')}</div>` : '<p class="analytics-empty">Purpose analytics will appear after requests are submitted.</p>';
    }
  },

  renderAuditTrail(activity, auditTrailAvailable) {
    const container = document.getElementById('dashboard-audit-trail');
    if (!container) return;

    if (!activity?.length) {
      container.innerHTML = `<p class="audit-trail-empty">${auditTrailAvailable ? 'No audit activity recorded yet.' : 'Run the audit-trail Supabase migration to record inventory and request actions.'}</p>`;
      return;
    }

    container.innerHTML = activity.map(entry => {
      const date = new Date(entry.createdAt);
      const timestamp = Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
      const indicatorClass = entry.kind === 'login' ? 'audit-indicator-login' : 'audit-indicator-change';
      return `<article class="audit-trail-item">
        <span class="audit-trail-indicator ${indicatorClass}" aria-hidden="true"></span>
        <div><strong>${escapeHtml(entry.action)}</strong><p>${escapeHtml(entry.actorName)}${entry.actorRole ? ` · ${escapeHtml(entry.actorRole)}` : ''} · ${escapeHtml(timestamp)}</p>${entry.details ? `<small>${escapeHtml(entry.details)}</small>` : ''}</div>
      </article>`;
    }).join('');
  },

  renderTrendChart(requests) {
    const chart = document.getElementById('request-trend-chart');
    if (!chart) return;
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const values = days.map(day => requests.filter(request => new Date(request.created_at).toDateString() === day.toDateString()).length);
    const max = Math.max(...values, 1);
    const points = values.map((value, index) => `${(index / 6) * 100},${92 - ((value / max) * 70)}`).join(' ');
    chart.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Request activity over the last seven days"><polyline points="0,92 100,92" class="trend-baseline"/><polyline points="${points}" class="trend-line"/></svg><div class="trend-labels">${days.map(day => `<span>${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>`).join('')}</div>`;
  }
};
