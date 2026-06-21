/* =============================================
   JobMiw v1.0 – script.js
   ============================================= */

'use strict';

// ── Storage Helpers ──────────────────────────
const DB = {
  get: (k, def = null) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} }
};

// ── State ────────────────────────────────────
let applications = DB.get('jobmiw_apps', []);
let profile = DB.get('jobmiw_profile', {
  name: '', experience: '', skills: [],
  prefLocation: '', prefLoctype: '', prefEmptype: '', prefSchedule: '',
  salaryMin: '', salaryMax: '',
  weights: getDefaultWeights()
});
let currentEditId = null;
let currentDeleteId = null;
let interestValue = 5;

function getDefaultWeights() {
  return {
    status: 25,
    recency: 20,
    interest: 15,
    skills: 12,
    salary: 10,
    location: 8,
    loctype: 5,
    emptype: 3,
    schedule: 2
  };
}

function saveApps() { DB.set('jobmiw_apps', applications); }
function saveProfile() { DB.set('jobmiw_profile', profile); }

// ── ID Generator ─────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── Toast ────────────────────────────────────
function toast(msg, dur = 2800) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

// ── Modal helpers ─────────────────────────────
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
window.closeModal = closeModal;

// ── Tabs ─────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'list') renderList();
    if (tab === 'prep') renderPrep();
    if (tab === 'profile') loadProfileUI();
  });
});

// ── Interest Dots ─────────────────────────────
function initInterestDots() {
  const wrap = document.getElementById('interest-dots');
  wrap.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'interest-dot' + (i <= interestValue ? ' active' : '');
    d.textContent = i;
    d.addEventListener('click', () => {
      interestValue = i;
      document.querySelectorAll('.interest-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx < i);
      });
      document.getElementById('interest-val').textContent = i + '/10';
    });
    wrap.appendChild(d);
  }
  document.getElementById('interest-val').textContent = interestValue + '/10';
}

// ── Apply Form ───────────────────────────────
document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
initInterestDots();

document.getElementById('apply-form').addEventListener('submit', e => {
  e.preventDefault();
  const company = document.getElementById('f-company').value.trim();
  const position = document.getElementById('f-position').value.trim();
  if (!company || !position) { toast('🐱 Please fill in company and position!'); return; }

  const app = {
    id: genId(),
    company,
    position,
    date: document.getElementById('f-date').value,
    source: document.getElementById('f-source').value,
    location: document.getElementById('f-location').value,
    loctype: document.getElementById('f-loctype').value,
    emptype: document.getElementById('f-emptype').value,
    schedule: document.getElementById('f-schedule').value,
    salaryMin: document.getElementById('f-salary-min').value,
    salaryMax: document.getElementById('f-salary-max').value,
    experience: document.getElementById('f-experience').value.trim(),
    interest: interestValue,
    skills: document.getElementById('f-skills').value.trim(),
    contactPerson: document.getElementById('f-contact-person').value.trim(),
    contactEmail: document.getElementById('f-contact-email').value.trim(),
    contactNum: document.getElementById('f-contact-num').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    status: 'Applied',
    createdAt: Date.now()
  };

  applications.unshift(app);
  saveApps();
  updateHeaderStats();
  toast('🎉 Application saved! Good luck, ' + company + '~');
  e.target.reset();
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  interestValue = 5;
  initInterestDots();
});

document.getElementById('clear-form-btn').addEventListener('click', () => {
  document.getElementById('apply-form').reset();
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  interestValue = 5;
  initInterestDots();
  toast('✨ Form cleared!');
});

// ── Header Stats ─────────────────────────────
function updateHeaderStats() {
  document.getElementById('hdr-total').textContent = applications.length;
  document.getElementById('hdr-active').textContent = applications.filter(a =>
    !['Rejected'].includes(a.status)
  ).length;
  document.getElementById('hdr-interviews').textContent = applications.filter(a =>
    ['Interview', 'Shortlisted'].includes(a.status)
  ).length;
}

// ── Days Since ───────────────────────────────
function daysSince(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / 86400000);
}

function daysBadge(days) {
  let cls = '';
  if (days <= 7) cls = 'recent';
  else if (days >= 21) cls = 'old';
  return `<span class="days-badge ${cls}">${days}d ago</span>`;
}

// ── Status Classes ────────────────────────────
function statusClass(s) {
  const map = { Applied:'applied', Viewed:'viewed', Shortlisted:'shortlisted', Interview:'interview', Offered:'offered', Rejected:'rejected' };
  return 'status-' + (map[s] || 'applied');
}

// ── Render List ───────────────────────────────
let listFilter = '';
let listSearch = '';
let listSource = '';

function renderList() {
  const grid = document.getElementById('list-grid');
  let apps = [...applications];

  const search = (document.getElementById('list-search').value || '').toLowerCase();
  const source = document.getElementById('list-source-filter').value;

  if (listFilter) apps = apps.filter(a => a.status === listFilter);
  if (search) apps = apps.filter(a =>
    a.company.toLowerCase().includes(search) || a.position.toLowerCase().includes(search)
  );
  if (source) apps = apps.filter(a => a.source === source);

  if (!apps.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🐱</div><p><strong>No applications found!</strong><br/>Try adjusting your filters.</p></div>`;
    return;
  }

  grid.innerHTML = apps.map(app => {
    const days = daysSince(app.date);
    const sc = statusClass(app.status);
    const salary = (app.salaryMin || app.salaryMax) ? `₱${app.salaryMin || '?'}–${app.salaryMax || '?'}` : '';
    return `
    <div class="app-card" style="--status-color:var(--status-${app.status.toLowerCase().replace(' ','-')}, var(--primary-light))">
      <div class="app-card-header">
        <div>
          <div class="app-card-title">${esc(app.company)}</div>
          <div class="app-card-sub">📌 ${esc(app.position)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <span class="status-badge ${sc}">${app.status}</span>
          ${daysBadge(days)}
        </div>
      </div>
      <div class="app-card-meta">
        ${app.location ? `<span class="meta-tag">📍 ${esc(app.location)}</span>` : ''}
        ${app.loctype ? `<span class="meta-tag">${loctypeIcon(app.loctype)} ${esc(app.loctype)}</span>` : ''}
        ${app.emptype ? `<span class="meta-tag">💼 ${esc(app.emptype)}</span>` : ''}
        ${salary ? `<span class="meta-tag">💰 ${salary}</span>` : ''}
        ${app.source ? `<span class="meta-tag">🔗 ${esc(app.source)}</span>` : ''}
        ${app.interest ? `<span class="meta-tag">❤️ ${app.interest}/10</span>` : ''}
      </div>
      <div class="app-card-actions">
        <select class="status-select ${sc}" onchange="updateStatus('${app.id}', this.value)" style="background:var(--bg2);">
          ${['Applied','Viewed','Shortlisted','Interview','Offered','Rejected'].map(s => `<option${s===app.status?' selected':''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${app.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${app.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function loctypeIcon(t) {
  if (t === 'Remote') return '🏠';
  if (t === 'Hybrid') return '🔄';
  return '🏢';
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updateStatus(id, status) {
  const app = applications.find(a => a.id === id);
  if (app) {
    app.status = status;
    saveApps();
    updateHeaderStats();
    toast(`Status updated to "${status}" 🐱`);
    renderList();
  }
}

// Filter chips
document.getElementById('list-status-chips').addEventListener('click', e => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('#list-status-chips .filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  listFilter = chip.dataset.status;
  renderList();
});

document.getElementById('list-search').addEventListener('input', () => renderList());
document.getElementById('list-source-filter').addEventListener('change', () => renderList());

// ── Edit Modal ────────────────────────────────
function openEditModal(id) {
  const app = applications.find(a => a.id === id);
  if (!app) return;
  currentEditId = id;
  const container = document.getElementById('edit-form-inner');
  container.innerHTML = `
    <div class="form-group"><label>Company</label><input id="e-company" value="${esc(app.company)}" /></div>
    <div class="form-group"><label>Position</label><input id="e-position" value="${esc(app.position)}" /></div>
    <div class="form-group"><label>Date Applied</label><input type="date" id="e-date" value="${app.date}" /></div>
    <div class="form-group"><label>Status</label>
      <select id="e-status">${['Applied','Viewed','Shortlisted','Interview','Offered','Rejected'].map(s=>`<option${s===app.status?' selected':''}>${s}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Source</label>
      <select id="e-source">${['','LinkedIn','JobStreet','BossJob','Indeed','Referral','Walk-in'].map(s=>`<option${s===app.source?' selected':''}>${s||'Select source…'}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Location</label>
      <select id="e-location">${['','Manila','Makati','Quezon City','Pasig City','Mandaluyong','Pasay City'].map(s=>`<option${s===app.location?' selected':''}>${s||'Select city…'}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Location Type</label>
      <select id="e-loctype">${['','On-site','Hybrid','Remote'].map(s=>`<option${s===app.loctype?' selected':''}>${s||'Select type…'}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Employment Type</label>
      <select id="e-emptype">${['','Regular','Contractual','Seasonal','Part-time','Freelance'].map(s=>`<option${s===app.emptype?' selected':''}>${s||'Select type…'}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Salary Min ₱</label><input type="number" id="e-sal-min" value="${app.salaryMin||''}" /></div>
    <div class="form-group"><label>Salary Max ₱</label><input type="number" id="e-sal-max" value="${app.salaryMax||''}" /></div>
    <div class="form-group"><label>Interest (1–10)</label><input type="number" id="e-interest" min="1" max="10" value="${app.interest||5}" /></div>
    <div class="form-group full-width"><label>Skills</label><input id="e-skills" value="${esc(app.skills)}" /></div>
    <div class="form-group full-width"><label>Notes</label><textarea id="e-notes">${esc(app.notes)}</textarea></div>
  `;
  openModal('edit-modal');
}
window.openEditModal = openEditModal;

document.getElementById('save-edit-btn').addEventListener('click', () => {
  const app = applications.find(a => a.id === currentEditId);
  if (!app) return;
  app.company = document.getElementById('e-company').value.trim();
  app.position = document.getElementById('e-position').value.trim();
  app.date = document.getElementById('e-date').value;
  app.status = document.getElementById('e-status').value;
  app.source = document.getElementById('e-source').value;
  app.location = document.getElementById('e-location').value;
  app.loctype = document.getElementById('e-loctype').value;
  app.emptype = document.getElementById('e-emptype').value;
  app.salaryMin = document.getElementById('e-sal-min').value;
  app.salaryMax = document.getElementById('e-sal-max').value;
  app.interest = parseInt(document.getElementById('e-interest').value) || 5;
  app.skills = document.getElementById('e-skills').value.trim();
  app.notes = document.getElementById('e-notes').value.trim();
  saveApps();
  updateHeaderStats();
  closeModal('edit-modal');
  renderList();
  toast('✏️ Application updated!');
});

// ── Delete Modal ──────────────────────────────
function openDeleteModal(id) {
  const app = applications.find(a => a.id === id);
  if (!app) return;
  currentDeleteId = id;
  document.getElementById('delete-app-name').textContent = app.company + ' – ' + app.position;
  openModal('delete-modal');
}
window.openDeleteModal = openDeleteModal;

document.getElementById('confirm-delete-btn').addEventListener('click', () => {
  applications = applications.filter(a => a.id !== currentDeleteId);
  saveApps();
  updateHeaderStats();
  closeModal('delete-modal');
  renderList();
  if (document.getElementById('tab-prep').classList.contains('active')) renderPrep();
  toast('🗑️ Application deleted.');
});

// ── Scoring Engine ────────────────────────────
function scoreApplication(app) {
  const w = profile.weights;
  const totalW = Object.values(w).reduce((a, b) => a + b, 0) || 100;
  let score = 0;
  const factors = [];
  const days = daysSince(app.date);

  // Status score
  const statusScores = { Applied: 0.15, Viewed: 0.4, Shortlisted: 0.65, Interview: 0.85, Offered: 1.0, Rejected: 0 };
  const ss = statusScores[app.status] ?? 0.15;
  score += (ss * w.status);
  factors.push({ label: '📊 Status', match: ss >= 0.65 ? 'match' : ss >= 0.35 ? 'partial' : 'miss' });

  // Recency (28 days = archive)
  const rec = Math.max(0, 1 - days / 28);
  score += (rec * w.recency);
  factors.push({ label: `📅 ${days}d ago`, match: days <= 7 ? 'match' : days <= 18 ? 'partial' : 'miss' });

  // Interest
  const interestScore = (app.interest || 5) / 10;
  score += (interestScore * w.interest);
  factors.push({ label: `❤️ Interest ${app.interest}/10`, match: app.interest >= 7 ? 'match' : app.interest >= 4 ? 'partial' : 'miss' });

  // Skills
  if (profile.skills && profile.skills.length && app.skills) {
    const mySkills = profile.skills.map(s => s.toLowerCase());
    const jobSkills = app.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (jobSkills.length) {
      const matched = jobSkills.filter(js => mySkills.some(ms => ms.includes(js) || js.includes(ms)));
      const ratio = matched.length / jobSkills.length;
      score += (ratio * w.skills);
      factors.push({ label: `🔧 Skills ${matched.length}/${jobSkills.length}`, match: ratio >= 0.7 ? 'match' : ratio >= 0.4 ? 'partial' : 'miss' });
    } else {
      score += (0.5 * w.skills);
      factors.push({ label: '🔧 Skills N/A', match: 'partial' });
    }
  } else {
    score += (0.5 * w.skills);
    factors.push({ label: '🔧 Skills N/A', match: 'partial' });
  }

  // Salary
  if (profile.salaryMin && app.salaryMax) {
    const myMin = parseFloat(profile.salaryMin);
    const jobMax = parseFloat(app.salaryMax);
    const jobMin = parseFloat(app.salaryMin) || 0;
    let salScore = 0;
    if (jobMax >= myMin) salScore = jobMax > (myMin * 1.2) ? 1 : 0.8;
    else if (jobMin > 0 && jobMin >= myMin * 0.8) salScore = 0.5;
    score += (salScore * w.salary);
    factors.push({ label: `💰 Salary`, match: salScore >= 0.8 ? 'match' : salScore >= 0.5 ? 'partial' : 'miss' });
  } else {
    score += (0.5 * w.salary);
    factors.push({ label: '💰 Salary N/A', match: 'partial' });
  }

  // Location
  if (profile.prefLocation && app.location) {
    const locMatch = profile.prefLocation === app.location;
    score += (locMatch ? 1 : 0.3) * w.location;
    factors.push({ label: `📍 ${app.location}`, match: locMatch ? 'match' : 'miss' });
  } else {
    score += (0.5 * w.location);
    factors.push({ label: '📍 Location N/A', match: 'partial' });
  }

  // Location type
  if (profile.prefLoctype && app.loctype) {
    const lMatch = profile.prefLoctype === app.loctype;
    score += (lMatch ? 1 : 0.3) * w.loctype;
    factors.push({ label: `${loctypeIcon(app.loctype)} ${app.loctype}`, match: lMatch ? 'match' : 'miss' });
  } else {
    score += (0.5 * w.loctype);
  }

  // Employment type
  if (profile.prefEmptype && app.emptype) {
    const eMatch = profile.prefEmptype === app.emptype;
    score += (eMatch ? 1 : 0.3) * w.emptype;
    factors.push({ label: `💼 ${app.emptype}`, match: eMatch ? 'match' : 'miss' });
  } else {
    score += (0.5 * w.emptype);
  }

  // Schedule
  if (profile.prefSchedule && app.schedule) {
    const sMatch = profile.prefSchedule === app.schedule;
    score += (sMatch ? 1 : 0.3) * w.schedule;
    factors.push({ label: `🕐 ${app.schedule}`, match: sMatch ? 'match' : 'miss' });
  } else {
    score += (0.5 * w.schedule);
  }

  const pct = Math.min(100, Math.round((score / totalW) * 100));

  let chance = 'Low';
  if (app.status === 'Rejected' || days >= 28) chance = 'Archived';
  else if (pct >= 65) chance = 'High';
  else if (pct >= 40) chance = 'Medium';

  return { pct, chance, factors, days };
}

// ── Render Prep ───────────────────────────────
let prepFilter = '';

function renderPrep() {
  const apps = applications.map(app => ({ app, ...scoreApplication(app) }))
    .sort((a, b) => b.pct - a.pct);

  renderPieChart(apps);

  const groups = { High: [], Medium: [], Low: [], Archived: [] };
  apps.forEach(item => {
    if (prepFilter && item.chance !== prepFilter) return;
    groups[item.chance].push(item);
  });

  const grid = document.getElementById('prep-grid');
  const order = prepFilter ? [prepFilter] : ['High', 'Medium', 'Low', 'Archived'];
  const colors = { High: 'high', Medium: 'medium', Low: 'low', Archived: 'archived' };
  const icons = { High: '🟢', Medium: '🟡', Low: '🔴', Archived: '📦' };

  grid.innerHTML = order.map(chance => {
    const items = groups[chance] || [];
    if (!items.length && prepFilter) return `<div class="empty-state"><div class="empty-icon">🐱</div><p>No ${chance} chance applications.</p></div>`;
    if (!items.length) return '';
    return `
    <div class="chance-section">
      <div class="chance-header">
        <span class="chance-dot dot-${colors[chance]}"></span>
        <span class="chance-label">${icons[chance]} ${chance} Chances</span>
        <span class="chance-count">${items.length}</span>
      </div>
      ${items.map(item => renderJobChanceCard(item, colors[chance])).join('')}
    </div>`;
  }).join('') || `<div class="empty-state"><div class="empty-icon">🐱</div><p>No applications yet! Go add some from the Apply tab.</p></div>`;
}

function renderJobChanceCard({ app, pct, chance, factors, days }, colorClass) {
  return `
  <div class="job-chance-card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div>
        <div class="app-card-title">${esc(app.company)}</div>
        <div class="app-card-sub">📌 ${esc(app.position)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:1.2rem;font-weight:700;color:var(--primary);">${pct}%</div>
        <div style="font-size:0.75rem;color:var(--text2);">match score</div>
      </div>
    </div>
    <div class="score-bar-wrap">
      <div class="score-bar ${colorClass}" style="width:${pct}%"></div>
    </div>
    <div class="score-factors">
      ${factors.map(f => `<span class="factor-chip ${f.match}">${f.label}</span>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center;">
      <span class="status-badge ${statusClass(app.status)}">${app.status}</span>
      ${days >= 28 ? '<span class="days-badge old">⚠️ Archived</span>' : ''}
    </div>
  </div>`;
}

// Filter chips – prep
document.getElementById('prep-filter-chips').addEventListener('click', e => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('#prep-filter-chips .filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  prepFilter = chip.dataset.chance;
  renderPrep();
});

// ── Pie Chart ─────────────────────────────────
function renderPieChart(apps) {
  const counts = { High: 0, Medium: 0, Low: 0, Archived: 0 };
  apps.forEach(({ chance }) => counts[chance]++);
  const total = apps.length;

  const svg = document.getElementById('pie-svg');
  const legend = document.getElementById('pie-legend');

  if (!total) {
    svg.innerHTML = `<circle cx="70" cy="70" r="55" fill="var(--border)" />`;
    legend.innerHTML = `<div class="legend-item" style="color:var(--text3)">No data yet</div>`;
    return;
  }

  const colors = { High: '#82c9a0', Medium: '#f5c97a', Low: '#f5a0a0', Archived: '#c0b8d0' };
  const order = ['High', 'Medium', 'Low', 'Archived'];
  let startAngle = -Math.PI / 2;
  let slices = '';

  order.forEach(key => {
    const n = counts[key];
    if (!n) return;
    const angle = (n / total) * 2 * Math.PI;
    const x1 = 70 + 55 * Math.cos(startAngle);
    const y1 = 70 + 55 * Math.sin(startAngle);
    const x2 = 70 + 55 * Math.cos(startAngle + angle);
    const y2 = 70 + 55 * Math.sin(startAngle + angle);
    const large = angle > Math.PI ? 1 : 0;
    slices += `<path d="M70,70 L${x1},${y1} A55,55 0 ${large},1 ${x2},${y2} Z" fill="${colors[key]}" opacity="0.9" />`;
    startAngle += angle;
  });

  svg.innerHTML = slices + `<circle cx="70" cy="70" r="28" fill="var(--card)" /><text x="70" y="75" text-anchor="middle" font-size="14" font-weight="700" font-family="Fredoka" fill="var(--text)">${total}</text>`;

  legend.innerHTML = order.map(key => {
    if (!counts[key]) return '';
    return `<div class="legend-item">
      <span class="legend-dot" style="background:${colors[key]}"></span>
      ${key}: <strong>${counts[key]}</strong> (${Math.round(counts[key]/total*100)}%)
    </div>`;
  }).join('');
}

// ── AI Interview Trainer ──────────────────────
document.getElementById('ai-interview-btn').addEventListener('click', () => {
  const highApps = applications.filter(a => {
    const { chance } = scoreApplication(a);
    return chance === 'High' || a.status === 'Interview' || a.status === 'Shortlisted';
  });

  const list = document.getElementById('ai-job-list');
  if (!highApps.length) {
    list.innerHTML = `<div class="empty-state" style="padding:20px;"><p>No high-chance applications yet! Keep applying 🐱</p></div>`;
  } else {
    list.innerHTML = highApps.map(app => `
      <div class="ai-job-item" onclick="openChatGPT('${app.id}')">
        <div class="job-name">${esc(app.position)}</div>
        <div class="job-company">🏢 ${esc(app.company)} ${app.location ? '· 📍 ' + esc(app.location) : ''}</div>
      </div>`).join('');
  }
  openModal('ai-modal');
});

function openChatGPT(appId) {
  const app = applications.find(a => a.id === appId);
  if (!app) return;
  const prompt = `I am preparing for an HR interview at ${app.company} for the position of ${app.position}. ${app.skills ? 'The role requires these skills: ' + app.skills + '.' : ''} Please research ${app.company} company and ask me 7 interview questions one at a time — a mix of general HR questions and questions specific to ${app.company} and the ${app.position} role. Start with the first question only, and wait for my answer before asking the next one. Do not give all questions at once.`;
  const url = 'https://chat.openai.com/?q=' + encodeURIComponent(prompt);
  window.open(url, '_blank', 'noopener');
  closeModal('ai-modal');
  toast('🤖 Opening ChatGPT for mock interview...');
}
window.openChatGPT = openChatGPT;

// ── Profile ───────────────────────────────────
function loadProfileUI() {
  document.getElementById('p-name').value = profile.name || '';
  document.getElementById('p-exp').value = profile.experience || '';
  document.getElementById('pref-location').value = profile.prefLocation || '';
  document.getElementById('pref-loctype').value = profile.prefLoctype || '';
  document.getElementById('pref-emptype').value = profile.prefEmptype || '';
  document.getElementById('pref-schedule').value = profile.prefSchedule || '';
  document.getElementById('pref-salary-min').value = profile.salaryMin || '';
  document.getElementById('pref-salary-max').value = profile.salaryMax || '';
  renderSkillTags();
  renderWeightSliders();
  updateAppearanceUI();
}

function renderSkillTags() {
  const wrap = document.getElementById('profile-skills-tags');
  wrap.innerHTML = (profile.skills || []).map((s, i) => `
    <span class="skill-tag">
      ${esc(s)}
      <button class="remove-skill" onclick="removeSkill(${i})">×</button>
    </span>`).join('');
}

function removeSkill(i) {
  profile.skills.splice(i, 1);
  saveProfile();
  renderSkillTags();
}
window.removeSkill = removeSkill;

document.getElementById('add-skill-btn').addEventListener('click', () => {
  const inp = document.getElementById('add-skill-input');
  const val = inp.value.trim();
  if (!val) return;
  if (!profile.skills) profile.skills = [];
  profile.skills.push(val);
  saveProfile();
  renderSkillTags();
  inp.value = '';
  toast('🔧 Skill added!');
});

document.getElementById('add-skill-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('add-skill-btn').click(); }
});

document.getElementById('save-prefs-btn').addEventListener('click', () => {
  profile.name = document.getElementById('p-name').value.trim();
  profile.experience = document.getElementById('p-exp').value.trim();
  profile.prefLocation = document.getElementById('pref-location').value;
  profile.prefLoctype = document.getElementById('pref-loctype').value;
  profile.prefEmptype = document.getElementById('pref-emptype').value;
  profile.prefSchedule = document.getElementById('pref-schedule').value;
  profile.salaryMin = document.getElementById('pref-salary-min').value;
  profile.salaryMax = document.getElementById('pref-salary-max').value;
  saveProfile();
  toast('💾 Preferences saved!');
});

// ── Resume Upload ─────────────────────────────
const resumeFile = document.getElementById('resume-file');
const dropZone = document.getElementById('resume-drop-zone');

dropZone.addEventListener('click', () => resumeFile.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') processResume(f);
});

resumeFile.addEventListener('change', () => {
  const f = resumeFile.files[0];
  if (f) processResume(f);
});

document.getElementById('remove-resume-btn').addEventListener('click', () => {
  document.getElementById('resume-info').style.display = 'none';
  document.getElementById('extracted-section').style.display = 'none';
  document.getElementById('resume-drop-zone').style.display = 'block';
  resumeFile.value = '';
  toast('📄 Resume removed.');
});

function processResume(file) {
  const info = document.getElementById('resume-info');
  document.getElementById('resume-name').textContent = file.name;
  document.getElementById('resume-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
  info.style.display = 'flex';
  dropZone.style.display = 'none';
  document.getElementById('extracted-section').style.display = 'block';
  toast('📄 Resume uploaded! Edit the extracted info below.');
  // Basic text extraction hint (real extraction needs a library)
  const reader = new FileReader();
  reader.onload = () => {
    // Store PDF as base64 for reference
    profile.resumeFileName = file.name;
    saveProfile();
  };
  reader.readAsDataURL(file);
}

// ── Weights Sliders ───────────────────────────
const WEIGHT_LABELS = {
  status: '📊 Application Status',
  recency: '📅 Recency (days since applied)',
  interest: '❤️ Personal Interest',
  skills: '🔧 Skills Match',
  salary: '💰 Salary Alignment',
  location: '📍 Location Match',
  loctype: '🏠 Location Type Match',
  emptype: '💼 Employment Type Match',
  schedule: '🕐 Work Schedule Match'
};

function renderWeightSliders() {
  const wrap = document.getElementById('weights-sliders');
  wrap.innerHTML = Object.entries(profile.weights || getDefaultWeights()).map(([k, v]) => `
    <div class="weight-item">
      <span class="weight-label">${WEIGHT_LABELS[k] || k}</span>
      <input type="range" class="weight-slider" min="0" max="50" value="${v}" id="w-${k}" oninput="updateWeight('${k}', this.value)" />
      <span class="weight-value" id="wv-${k}">${v}</span>
    </div>`).join('');
}

function updateWeight(k, v) {
  profile.weights[k] = parseInt(v);
  document.getElementById('wv-' + k).textContent = v;
  saveProfile();
}
window.updateWeight = updateWeight;

document.getElementById('reset-weights-btn').addEventListener('click', () => {
  profile.weights = getDefaultWeights();
  saveProfile();
  renderWeightSliders();
  toast('↺ Weights reset to default!');
});

// Collapsible
document.getElementById('weights-toggle').addEventListener('click', function() {
  const body = document.getElementById('weights-body');
  const isOpen = !body.classList.contains('collapsed');
  if (isOpen) {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => {
      body.style.maxHeight = '0';
      body.classList.add('collapsed');
    });
    this.classList.remove('open');
  } else {
    body.classList.remove('collapsed');
    body.style.maxHeight = body.scrollHeight + 'px';
    setTimeout(() => body.style.maxHeight = 'none', 350);
    this.classList.add('open');
  }
});

// ── Themes ────────────────────────────────────
function updateAppearanceUI() {
  const currentTheme = DB.get('jobmiw_theme', '');
  const currentFont = DB.get('jobmiw_font', 'Fredoka');
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === currentTheme));
  document.querySelectorAll('.font-btn').forEach(b => b.classList.toggle('active', b.dataset.font === currentFont));
}

document.getElementById('theme-swatches').addEventListener('click', e => {
  const swatch = e.target.closest('.theme-swatch');
  if (!swatch) return;
  const theme = swatch.dataset.theme;
  document.documentElement.setAttribute('data-theme', theme);
  DB.set('jobmiw_theme', theme);
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s === swatch));
  toast('🎨 Theme changed!');
});

document.getElementById('font-picker').addEventListener('click', e => {
  const btn = e.target.closest('.font-btn');
  if (!btn) return;
  const font = btn.dataset.font;
  applyFont(font);
  DB.set('jobmiw_font', font);
  document.querySelectorAll('.font-btn').forEach(b => b.classList.toggle('active', b === btn));
  toast('🔤 Font changed!');
});

function applyFont(font) {
  document.documentElement.style.setProperty('--font', `'${font}', sans-serif`);
}

// ── Export / Import CSV ───────────────────────
document.getElementById('export-csv-btn').addEventListener('click', () => {
  if (!applications.length) { toast('No applications to export!'); return; }
  const headers = ['id','company','position','date','source','location','loctype','emptype','schedule','salaryMin','salaryMax','experience','interest','skills','status','contactPerson','contactEmail','contactNum','notes','createdAt'];
  const rows = applications.map(a => headers.map(h => `"${String(a[h]||'').replace(/"/g,'""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `jobmiw_export_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('⬇️ Exported ' + applications.length + ' applications!');
});

document.getElementById('import-csv-file').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(Boolean);
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
    const imported = lines.slice(1).map(line => {
      const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i]||'').replace(/^"|"$/g,'').replace(/""/g,'"').trim(); });
      if (!obj.id) obj.id = genId();
      if (!obj.interest) obj.interest = 5; else obj.interest = parseInt(obj.interest);
      if (!obj.status) obj.status = 'Applied';
      return obj;
    }).filter(a => a.company && a.position);

    const newCount = imported.filter(imp => !applications.find(a => a.id === imp.id)).length;
    imported.forEach(imp => {
      if (!applications.find(a => a.id === imp.id)) applications.push(imp);
    });
    saveApps();
    updateHeaderStats();
    toast(`⬆️ Imported ${newCount} new applications!`);
    this.value = '';
  };
  reader.readAsText(file);
});

// ── Delete All ────────────────────────────────
document.getElementById('delete-all-btn').addEventListener('click', () => {
  document.getElementById('delete-all-confirm-input').value = '';
  openModal('delete-all-modal');
});

document.getElementById('confirm-delete-all-btn').addEventListener('click', () => {
  const val = document.getElementById('delete-all-confirm-input').value.trim();
  if (val !== 'DELETE') { toast('⚠️ Please type DELETE to confirm.'); return; }
  applications = [];
  profile = { name:'', experience:'', skills:[], prefLocation:'', prefLoctype:'', prefEmptype:'', prefSchedule:'', salaryMin:'', salaryMax:'', weights: getDefaultWeights() };
  saveApps();
  saveProfile();
  updateHeaderStats();
  closeModal('delete-all-modal');
  toast('🗑️ All data deleted.');
  loadProfileUI();
});

// ── Close modals on overlay click ──────────────
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// ── Apply saved theme/font on load ───────────
(function init() {
  const theme = DB.get('jobmiw_theme', '');
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  const font = DB.get('jobmiw_font', 'Fredoka');
  applyFont(font);
  updateHeaderStats();
})();

// ── PWA Register ──────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
