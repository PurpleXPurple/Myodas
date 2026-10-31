const SKILL_ICONS = {
  'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  'file-text': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
  'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'code': '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'heart': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  'bookmark': '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  'terminal': '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  'cpu': '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  'globe': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'mail': '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  'lock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'key': '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  'eye': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  'search': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  'sliders': '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  'tool': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  'hammer': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  'pen-tool': '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  'copy': '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  'clipboard': '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  'folder': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  'archive': '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  'cloud': '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  'wifi': '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  'battery': '<rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/>',
  'sun': '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  'moon': '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  'coffee': '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  'briefcase': '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  'map': '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  'award': '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  'gift': '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  'lightbulb': '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 0 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/>',
  'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'crosshair': '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>'
};

const state = { tab: 'prompts', prompts: [], skills: [], selectedIcon: 'sparkles' };

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupPrompts();
  setupSkills();
  setupFetch();
  setupIconPicker();
  setupThemes();
  loadData();
  loadThemeSettings();
  loadTokenStats();
  
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.dsnx_armed) {
      if (state.tab === 'prompts' || state.tab === 'skills') renderList(state.tab);
    }
    if (changes.dsnx_global_tokens && state.tab === 'tokens') {
      loadTokenStats();
    }
  });
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-view`).classList.add('active');
      state.tab = tab.dataset.tab;
      if (state.tab === 'prompts' || state.tab === 'skills') renderList(state.tab);
      if (state.tab === 'tokens') loadTokenStats();
    });
  });
}

async function loadData() {
  const data = await chrome.storage.local.get(['dsnx_prompts', 'dsnx_skills']);
  state.prompts = data.dsnx_prompts || [];
  state.skills = data.dsnx_skills || [];
  renderList('prompts');
  renderList('skills');
}

function escapeHtml(str) { return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])) : ''; }

async function renderList(type) {
  const listEl = document.getElementById(`${type}-list`);
  if (!listEl) return;
  const items = state[type];
  const { dsnx_armed } = await chrome.storage.local.get('dsnx_armed');
  const armedId = dsnx_armed?.id;

  listEl.innerHTML = !items.length ? `<div style="padding:32px; text-align:center; color:var(--text-mut);">No ${type} saved yet.</div>` : '';

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'item';
    const isArmed = armedId === item.id;
    
    let iconSvg = '';
    if (type === 'skills') {
      iconSvg = `<div class="item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SKILL_ICONS[item.icon] || SKILL_ICONS['sparkles']}</svg></div>`;
    }
    
    const descText = type === 'skills' && item.description ? escapeHtml(item.description) : escapeHtml((item.text || "").slice(0, 60)) + '...';

    el.innerHTML = `
      <div class="item-content">
        ${iconSvg}
        <div class="item-text">
          <div class="item-title">${escapeHtml(item.name)}</div>
          <div class="item-desc">${descText}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <label class="dsnx-switch">
          <input type="checkbox" class="dsnx-toggle" data-id="${item.id}" ${isArmed ? 'checked' : ''}>
          <span class="dsnx-slider"></span>
        </label>
        <button class="item-del" data-id="${item.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    listEl.appendChild(el);
  });

  listEl.querySelectorAll('.dsnx-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const id = e.currentTarget.dataset.id;
      const item = items.find(i => i.id === id);
      if (e.target.checked) await chrome.storage.local.set({ dsnx_armed: item });
      else await chrome.storage.local.remove('dsnx_armed');
      renderList(type);
    });
  });

  listEl.querySelectorAll('.item-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      state[type] = state[type].filter(i => i.id !== id);
      await chrome.storage.local.set({ [`dsnx_${type}`]: state[type] });
      if (armedId === id) await chrome.storage.local.remove('dsnx_armed');
      renderList(type);
    });
  });
}

function setupPrompts() {
  document.getElementById('save-prompt-btn').addEventListener('click', async () => {
    const name = document.getElementById('prompt-title').value.trim();
    const text = document.getElementById('prompt-content').value.trim();
    if (!name || !text) return alert('Name and text are required.');
    if (state.prompts.some(p => p.name.toLowerCase() === name.toLowerCase())) return alert('Prompt already exists.');
    state.prompts.unshift({ id: crypto.randomUUID(), name, text });
    await chrome.storage.local.set({ dsnx_prompts: state.prompts });
    document.getElementById('prompt-title').value = '';
    document.getElementById('prompt-content').value = '';
    renderList('prompts');
  });
}

function setupSkills() {
  document.getElementById('save-skill-btn').addEventListener('click', async () => {
    const name = document.getElementById('skill-title').value.trim();
    const desc = document.getElementById('skill-description').value.trim();
    const text = document.getElementById('skill-content').value.trim();
    if (!name || !text || !desc) return alert('All fields are required.');
    if (state.skills.some(s => s.name.toLowerCase() === name.toLowerCase())) return alert('Skill already exists.');
    state.skills.unshift({ id: crypto.randomUUID(), name, description: desc, icon: state.selectedIcon, text });
    await chrome.storage.local.set({ dsnx_skills: state.skills });
    document.getElementById('skill-title').value = '';
    document.getElementById('skill-description').value = '';
    document.getElementById('skill-content').value = '';
    setSelectedIcon('sparkles');
    renderList('skills');
  });
}

function setupIconPicker() {
  const trigger = document.getElementById('icon-picker-trigger');
  const overlay = document.getElementById('icon-picker-overlay');
  const grid = document.getElementById('icon-grid');
  
  grid.innerHTML = Object.keys(SKILL_ICONS).map(name => `
    <div class="icon-grid-item" data-icon="${name}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SKILL_ICONS[name]}</svg>
    </div>
  `).join('');

  trigger.addEventListener('click', () => overlay.style.display = 'flex');
  document.getElementById('icon-picker-close').addEventListener('click', () => overlay.style.display = 'none');
  
  grid.addEventListener('click', (e) => {
    const item = e.target.closest('.icon-grid-item');
    if (item) { 
      setSelectedIcon(item.dataset.icon); 
      overlay.style.display = 'none'; 
    }
  });
}

function setSelectedIcon(iconName) {
  state.selectedIcon = iconName;
  const preview = document.getElementById('selected-icon-preview');
  if (preview) preview.innerHTML = SKILL_ICONS[iconName] || SKILL_ICONS['sparkles'];
}

function setupFetch() {
  const setLoading = (btn, isLoading) => { 
    btn.disabled = isLoading; 
    btn.innerHTML = isLoading ? `<svg class="spinner" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>` : `Fetch`; 
  };
  
  document.getElementById('gh-btn').addEventListener('click', async (e) => {
    const match = document.getElementById('gh-url').value.trim().match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return alert('Invalid GitHub URL');
    setLoading(e.currentTarget, true);
    let text = null;
    for (const branch of ["HEAD", "main", "master"]) {
      try { const res = await chrome.runtime.sendMessage({ type: "fetch", url: `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${branch}/README.md` }); if (res.ok && res.data.trim()) { text = res.data; break; } } catch (_) {}
    }
    setLoading(e.currentTarget, false);
    if (text) { 
      document.getElementById('prompt-title').value = `${match[1]}/${match[2]} README`; 
      document.getElementById('prompt-content').value = text; 
      document.querySelector('.tab[data-tab="prompts"]').click(); 
    } else alert('Could not find README.');
  });

  document.getElementById('hf-btn').addEventListener('click', async (e) => {
    const id = document.getElementById('hf-id').value.trim();
    const token = document.getElementById('hf-token').value.trim();
    if (!id) return alert('Enter a model/dataset ID');
    if (token) await chrome.storage.local.set({ dsnx_hf_token: token });
    setLoading(e.currentTarget, true);
    const res = await chrome.runtime.sendMessage({ type: 'fetchHFReadme', repoId: id, token: token || undefined });
    setLoading(e.currentTarget, false);
    if (res.ok) { 
      document.getElementById('prompt-title').value = `${id.replace('/','-')} README`; 
      document.getElementById('prompt-content').value = res.data; 
      document.querySelector('.tab[data-tab="prompts"]').click(); 
    } else alert(`Error: ${res.error}`);
  });
}

async function loadTokenStats() {
  const { dsnx_global_tokens } = await chrome.storage.local.get('dsnx_global_tokens');
  if (dsnx_global_tokens) {
    document.getElementById('dsnx-global-tokens').textContent = dsnx_global_tokens.totalTokens.toLocaleString();
    document.getElementById('dsnx-global-chats').textContent = dsnx_global_tokens.chatsTracked;
  }
}

async function loadThemeSettings() {
  const { dsnx_theme } = await chrome.storage.local.get('dsnx_theme');
  if (dsnx_theme) {
    document.getElementById('color-accent').value = dsnx_theme.accent || '#4d7cfe';
    document.getElementById('text-accent').value = dsnx_theme.accent || '#4d7cfe';
    document.getElementById('color-bg').value = dsnx_theme.bg || '#0a0a0a';
    document.getElementById('text-bg').value = dsnx_theme.bg || '#0a0a0a';
    document.getElementById('color-surface').value = dsnx_theme.surface || '#141414';
    document.getElementById('text-surface').value = dsnx_theme.surface || '#141414';
    document.getElementById('color-text').value = dsnx_theme.text || '#ffffff';
    document.getElementById('text-text').value = dsnx_theme.text || '#ffffff';
  }
}

function setupThemes() {
  const pairs = [
    { color: 'color-accent', text: 'text-accent' },
    { color: 'color-bg', text: 'text-bg' },
    { color: 'color-surface', text: 'text-surface' },
    { color: 'color-text', text: 'text-text' }
  ];

  pairs.forEach(({ color, text }) => {
    const cInput = document.getElementById(color);
    const tInput = document.getElementById(text);
    cInput.addEventListener('input', () => tInput.value = cInput.value);
    tInput.addEventListener('input', () => { if (tInput.value.startsWith('#')) cInput.value = tInput.value; });
  });

  document.getElementById('theme-image-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => extractColorFromImage(ev.target.result);
    reader.readAsDataURL(file);
  });

  document.getElementById('apply-theme-btn').addEventListener('click', async () => {
    const theme = {
      accent: document.getElementById('text-accent').value,
      bg: document.getElementById('text-bg').value,
      surface: document.getElementById('text-surface').value,
      text: document.getElementById('text-text').value
    };
    await chrome.storage.local.set({ dsnx_theme: theme });
    alert("Theme applied successfully!");
  });

  document.getElementById('reset-theme-btn').addEventListener('click', async () => {
    await chrome.storage.local.remove('dsnx_theme');
    document.getElementById('text-accent').value = '#4d7cfe'; document.getElementById('color-accent').value = '#4d7cfe';
    document.getElementById('text-bg').value = '#0a0a0a'; document.getElementById('color-bg').value = '#0a0a0a';
    document.getElementById('text-surface').value = '#141414'; document.getElementById('color-surface').value = '#141414';
    document.getElementById('text-text').value = '#ffffff'; document.getElementById('color-text').value = '#ffffff';
    alert("Theme reset to native defaults.");
  });
}

function extractColorFromImage(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 50; canvas.height = 50;
    ctx.drawImage(img, 0, 0, 50, 50);
    const data = ctx.getImageData(0, 0, 50, 50).data;
    
    let maxSat = 0, bestColor = { r: 77, g: 124, b: 254 };
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
      if (s > maxSat && l > 0.2 && l < 0.8) { maxSat = s; bestColor = { r, g, b }; }
    }

    const toHex = (n) => n.toString(16).padStart(2, '0');
    const hex = `#${toHex(bestColor.r)}${toHex(bestColor.g)}${toHex(bestColor.b)}`;
    
    document.getElementById('text-accent').value = hex; document.getElementById('color-accent').value = hex;
    const bgHex = mixColors(hex, '#000000', 0.9);
    document.getElementById('text-bg').value = bgHex; document.getElementById('color-bg').value = bgHex;
    const surfHex = mixColors(hex, '#000000', 0.8);
    document.getElementById('text-surface').value = surfHex; document.getElementById('color-surface').value = surfHex;
    document.getElementById('text-text').value = '#ffffff'; document.getElementById('color-text').value = '#ffffff';
  };
  img.src = dataUrl;
}

function mixColors(hex1, hex2, weight) {
  const h1 = hex1.replace('#',''), h2 = hex2.replace('#','');
  const r1 = parseInt(h1.substring(0,2), 16), g1 = parseInt(h1.substring(2,4), 16), b1 = parseInt(h1.substring(4,6), 16);
  const r2 = parseInt(h2.substring(0,2), 16), g2 = parseInt(h2.substring(2,4), 16), b2 = parseInt(h2.substring(4,6), 16);
  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}