(() => {
  "use strict";

  const KEYS = {
    ARMED: "dsnx_armed",
    PROMPTS: "dsnx_prompts",
    SKILLS: "dsnx_skills",
    TOKENS: "dsnx_global_tokens"
  };

  const state = {
    armed: null,
    composer: null,
    slash: { open: false, index: 0, query: "", startPos: -1, skills: [], filtered: [] },
    tab: "prompts",
    tokens: { global: { total: 0, chats: 0 }, current: 0, backendUsage: 0 }
  };

  const ICONS = {
    'file-text': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'code': '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
    'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'
  };

  const DOM = {
    q: (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } },
    qa: (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch { return []; } },
    isVisible: (el) => el && el.getBoundingClientRect().width > 0,
    escape: (str) => str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])) : "",
    getIcon: (name) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS['sparkles']}</svg>`
  };

  const Store = {
    get: async (key) => { try { const res = await chrome.storage.local.get(key); return res[key]; } catch { return null; } },
    set: async (key, val) => { try { await chrome.storage.local.set({ [key]: val }); return true; } catch { return false; } },
    remove: async (key) => { try { await chrome.storage.local.remove(key); return true; } catch { return false; } }
  };

  const Net = {
    async fetch(url, options = {}) {
      return new Promise((resolve, reject) => {
        if (!chrome.runtime?.id) return reject(new Error("Extension context invalidated."));
        try {
          chrome.runtime.sendMessage({ type: "fetch", url, ...options }, (res) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!res) return reject(new Error("Empty response."));
            if (res.ok) resolve(res.data);
            else reject(new Error(res.error || "Unknown network error."));
          });
        } catch (err) { reject(err); }
      });
    },
    async fetchHF(repoId) {
      return new Promise((resolve, reject) => {
        if (!chrome.runtime?.id) return reject(new Error("Extension context invalidated."));
        try {
          chrome.runtime.sendMessage({ type: "fetchHFReadme", repoId }, (res) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!res) return reject(new Error("Empty response."));
            if (res.ok) resolve(res.data);
            else reject(new Error(res.error || "Unknown network error."));
          });
        } catch (err) { reject(err); }
      });
    }
  };

  function findComposer() {
    const textareas = DOM.qa("textarea");
    let best = null;
    for (const el of textareas) {
      if (DOM.isVisible(el)) {
        if (document.activeElement === el) return el;
        if (!best || el.getBoundingClientRect().top > best.getBoundingClientRect().top) best = el;
      }
    }
    return best || DOM.q("textarea#chat-input") || DOM.q("div[contenteditable='true']");
  }

  function findSendButton() {
    if (!state.composer) return DOM.q("button[aria-label*='Send' i]");
    const container = state.composer.closest('form') || state.composer.parentElement?.parentElement;
    const btn = DOM.q("button[aria-label*='Send' i], button[type='submit']", container);
    return btn || DOM.q("button[aria-label*='Send' i], button[type='submit']");
  }

  function getComposerText() {
    if (!state.composer) return "";
    return state.composer.tagName === "TEXTAREA" ? (state.composer.value || "") : (state.composer.innerText || "");
  }

  function setComposerText(text) {
    if (!state.composer) return;
    if (state.composer.tagName === "TEXTAREA") {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      nativeInputValueSetter.call(state.composer, text);
      state.composer.dispatchEvent(new Event("input", { bubbles: true }));
      state.composer.selectionStart = state.composer.selectionEnd = state.composer.value.length;
    } else {
      state.composer.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
  }

  // --- Token Logic ---
  function getCurrentChatText() {
    let text = "";
    const msgNodes = DOM.qa("div[data-um-id], div.ds-markdown, .ds-message-content, [class*='chat-message']");
    msgNodes.forEach(node => {
      if (!node.closest('form') && !node.closest('[contenteditable="true"]')) {
        text += node.innerText + "\n";
      }
    });
    return text.trim();
  }

  async function fetchTotalSessionCount() {
    try {
      const token = localStorage.getItem('userToken');
      if (!token) return 1;
      const res = await fetch('/api/v0/chat_session/fetch_page?count=1', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return 1;
      const data = await res.json();
      return data.total || 1;
    } catch { return 1; }
  }

  async function refreshTokens() {
    const btn = DOM.q("#dsnx-refresh-tokens");
    if (btn) { btn.textContent = "Counting..."; btn.disabled = true; }

    try {
      const text = getCurrentChatText();
      if (!text) throw new Error("No chat text found");

      const tokenCount = state.tokens.backendUsage > 0 
        ? state.tokens.backendUsage 
        : await window.dsnxCountTokens(text);
      
      state.tokens.current = tokenCount;

      const chatHash = text.slice(0, 100).split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString();
      let globalTokens = await Store.get(KEYS.TOKENS) || { totalTokens: 0, chatsTracked: 0, sessions: {} };
      
      if (!globalTokens.sessions) globalTokens.sessions = {};
      if (!globalTokens.sessions[chatHash]) {
        globalTokens.sessions[chatHash] = tokenCount;
        globalTokens.totalTokens += tokenCount;
        globalTokens.chatsTracked = Object.keys(globalTokens.sessions).length;
        await Store.set(KEYS.TOKENS, globalTokens);
      }

      // Fetch actual total sessions from API
      const totalSessions = await fetchTotalSessionCount();
      if (totalSessions > globalTokens.chatsTracked) {
        globalTokens.chatsTracked = totalSessions; 
      }

      state.tokens.global = globalTokens;
      updateTokenUI();
    } catch (e) {
      console.warn("[Nexus] Token count failed:", e);
      if (btn) btn.textContent = "Retry";
    } finally {
      if (btn) { btn.disabled = false; }
    }
  }

  function updateTokenUI() {
    const elGlobalTok = DOM.q('#dsnx-global-tokens');
    const elGlobalChat = DOM.q('#dsnx-global-chats');
    const elCurTok = DOM.q('#dsnx-chat-tokens');
    const elBar = DOM.q('#dsnx-context-bar');
    const elMsg = DOM.q('#dsnx-chat-msgs');

    if (elGlobalTok) elGlobalTok.textContent = state.tokens.global.totalTokens.toLocaleString();
    if (elGlobalChat) elGlobalChat.textContent = state.tokens.global.chatsTracked;
    if (elCurTok) elCurTok.textContent = state.tokens.current.toLocaleString();
    if (elMsg) elMsg.textContent = DOM.qa("div[data-um-id], div.ds-markdown").length;
    
    if (elBar) {
      const pct = Math.min((state.tokens.current / 128000) * 100, 100); // Corrected to 128K
      elBar.style.width = `${pct}%`;
      elBar.style.background = pct > 90 ? 'var(--ds-danger)' : 'var(--ds-accent)';
    }
    
    const btn = DOM.q("#dsnx-refresh-tokens");
    if (btn && btn.textContent === "Counting...") btn.textContent = "Refresh Count";
  }

  // --- Slash Commands ---
  async function loadSkills() {
    const data = await Store.get(KEYS.SKILLS) || [];
    state.slash.skills = data.map(s => ({
      command: '/' + (s.name || '').toLowerCase().replace(/\s+/g, '-'),
      name: s.name,
      description: s.description || '',
      icon: s.icon || 'sparkles',
      text: s.text
    }));
  }

  function handleComposerInput() {
    if (!state.composer) return;
    try {
      let cursor = 0, val = "";
      if (state.composer.tagName === "TEXTAREA") { 
        cursor = state.composer.selectionStart; 
        val = state.composer.value || ""; 
      } else {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        cursor = range.startOffset; 
        val = range.startContainer.textContent || "";
      }
      const match = val.slice(0, cursor).match(/\/([a-zA-Z0-9_-]*)$/);
      if (match) { 
        state.slash.query = match[1].toLowerCase(); 
        state.slash.startPos = cursor - match[0].length; 
        showSlashMenu(); 
      } else {
        hideSlashMenu();
      }
    } catch (e) {}
  }

  function showSlashMenu() {
    let menu = DOM.q('#dsnx-slash-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'dsnx-slash-menu';
      document.body.appendChild(menu);
      menu.addEventListener('mousedown', (e) => { 
        e.preventDefault(); 
        const item = e.target.closest('.dsnx-slash-item'); 
        if (item) selectSlashCommand(state.slash.filtered[parseInt(item.dataset.index)]); 
      });
    }

    state.slash.filtered = state.slash.skills.filter(s => 
      s.command.includes('/' + state.slash.query) || s.description.toLowerCase().includes(state.slash.query)
    );

    if (!state.slash.filtered.length) { hideSlashMenu(); return; }
    if (state.slash.index >= state.slash.filtered.length) state.slash.index = state.slash.filtered.length - 1;

    menu.innerHTML = state.slash.filtered.map((s, i) => `
      <div class="dsnx-slash-item ${i === state.slash.index ? 'selected' : ''}" data-index="${i}">
        <div class="dsnx-slash-icon">${DOM.getIcon(s.icon)}</div>
        <div class="dsnx-slash-text">
          <div class="dsnx-slash-command">${DOM.escape(s.command)}</div>
          <div class="dsnx-slash-desc">${DOM.escape(s.description)}</div>
        </div>
      </div>
    `).join('');
    
    const rect = state.composer.getBoundingClientRect();
    menu.style.left = `${rect.left + 16}px`;
    menu.style.top = `${rect.top - menu.offsetHeight - 8}px`;
    menu.classList.add('open');
    state.slash.open = true;
  }

  function hideSlashMenu() {
    const menu = DOM.q('#dsnx-slash-menu');
    if (menu) menu.classList.remove('open');
    state.slash.open = false; 
    state.slash.index = 0; 
    state.slash.query = ""; 
    state.slash.startPos = -1;
  }

  function selectSlashCommand(skill) {
    if (!skill || state.slash.startPos === -1 || !state.composer) return;
    try {
      if (state.composer.tagName === "TEXTAREA") {
        const val = state.composer.value;
        const before = val.slice(0, state.slash.startPos);
        const after = val.slice(state.composer.selectionStart);
        setComposerText(before + skill.text + after);
        const newCursor = state.slash.startPos + skill.text.length;
        state.composer.setSelectionRange(newCursor, newCursor);
      } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const text = range.startContainer.textContent || "";
          range.startContainer.textContent = text.slice(0, state.slash.startPos) + skill.text + text.slice(range.startOffset);
        }
      }
    } catch (e) {}
    finally { hideSlashMenu(); state.composer.focus(); }
  }

  // --- UI & RENDERING (Sidebar) ---
  async function renderList(tab) {
    state.tab = tab;
    const list = DOM.q("#dsnx-list");
    if (!list) return;
    
    const items = await Store.get(tab === "skills" ? KEYS.SKILLS : KEYS.PROMPTS) || [];
    const query = (DOM.q("#dsnx-search")?.value || "").toLowerCase().trim();
    const filtered = items.filter(p => !query || (p.name && p.name.toLowerCase().includes(query)));

    list.innerHTML = "";
    if (!filtered.length) {
      list.innerHTML = `<div class="dsnx-empty">No ${tab} saved.</div>`;
      return;
    }

    const armed = await Store.get(KEYS.ARMED);

    filtered.forEach(item => {
      const el = document.createElement("div");
      const isArmed = armed && armed.id === item.id;
      el.className = "dsnx-item" + (isArmed ? " active" : "");

      const main = document.createElement("div");
      main.className = "dsnx-item-main";
      
      if (tab === "skills") {
        const icon = document.createElement("div");
        icon.className = "dsnx-item-icon";
        icon.innerHTML = DOM.getIcon(item.icon); 
        main.appendChild(icon);
      }

      const textDiv = document.createElement("div");
      textDiv.style = "flex:1; min-width:0;";
      textDiv.innerHTML = `
        <div class="dsnx-item-name">${DOM.escape(item.name || "Unnamed")}</div>
        <div class="dsnx-item-preview">${DOM.escape(item.description || item.text.slice(0, 60))}</div>
      `;
      main.appendChild(textDiv);

      const btns = document.createElement("div");
      btns.className = "dsnx-item-buttons";

      const label = document.createElement("label");
      label.className = "dsnx-switch";
      
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isArmed;
      checkbox.addEventListener('change', async (e) => {
        if (e.target.checked) {
          state.armed = item;
          await Store.set(KEYS.ARMED, item);
        } else {
          state.armed = null;
          await Store.remove(KEYS.ARMED);
        }
        renderList(tab);
      });
      
      const slider = document.createElement("span");
      slider.className = "dsnx-slider";
      label.appendChild(checkbox);
      label.appendChild(slider);

      const delBtn = document.createElement("button");
      delBtn.className = "dsnx-btn tiny danger";
      delBtn.style = "background:transparent; border:none; padding:4px;";
      delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${item.name}"?`)) return;
        const newItems = items.filter(i => i.id !== item.id);
        await Store.set(tab === "skills" ? KEYS.SKILLS : KEYS.PROMPTS, newItems);
        if (isArmed) await Store.remove(KEYS.ARMED);
        renderList(tab);
      });

      btns.appendChild(label);
      btns.appendChild(delBtn);
      el.appendChild(main);
      el.appendChild(btns);
      list.appendChild(el);
    });
  }

  function createSidebar() {
    if (DOM.q("#dsnx-sidebar")) return;

    const sidebar = document.createElement("div");
    sidebar.id = "dsnx-sidebar";
    sidebar.innerHTML = `
      <div class="dsnx-sidebar-header">
        <div class="dsnx-sidebar-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--ds-accent)" stroke-width="2"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"/><path d="M8 15V9l8 6V9"/></svg>
          Prompt Nexus
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button id="dsnx-export-btn" class="dsnx-btn tiny" style="background:transparent; padding:4px; color:var(--ds-text-secondary);" title="Export Backup">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <label class="dsnx-btn tiny" style="background:transparent; padding:4px; cursor:pointer; color:var(--ds-text-secondary);" title="Import Backup">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <input type="file" id="dsnx-import-input" accept=".json" style="display:none;">
          </label>
          <button class="dsnx-close-btn" type="button"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
      </div>
      <div class="dsnx-tabs">
        <button class="dsnx-tab active" data-tab="prompts">Prompts</button>
        <button class="dsnx-tab" data-tab="skills">Skills</button>
        <button class="dsnx-tab" data-tab="fetch">Fetch</button>
        <button class="dsnx-tab" data-tab="tokens">Tokens</button>
      </div>
      
      <div id="dsnx-view-prompts" class="dsnx-view active" style="flex-direction:column; flex:1; overflow-y:auto;">
        <input id="dsnx-search" type="search" placeholder="Search saved..." class="dsnx-input" style="margin-bottom:16px;" />
        <div id="dsnx-list" class="dsnx-list" style="flex:1; margin-bottom:16px;"></div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <input id="dsnx-name" type="text" placeholder="Title" class="dsnx-input" />
          <textarea id="dsnx-text" placeholder="Text..." class="dsnx-textarea"></textarea>
          <div style="display:flex; gap:8px;">
            <button id="dsnx-save" class="dsnx-btn primary" style="flex:1;">Save</button>
            <button id="dsnx-cancel-arm" class="dsnx-btn secondary" style="flex:1;">Disarm</button>
          </div>
        </div>
      </div>

      <div id="dsnx-view-fetch" class="dsnx-view" style="flex-direction:column; flex:1; overflow-y:auto;">
        <div class="dsnx-fetch-card">
          <label>GitHub Repository</label>
          <input id="dsnx-github-url" type="text" placeholder="https://github.com/owner/repo" class="dsnx-input" />
          <button id="dsnx-github-btn" class="dsnx-btn primary" style="width:100%;">Fetch README</button>
        </div>
        <div class="dsnx-fetch-card">
          <label>Hugging Face Model / Dataset</label>
          <input id="dsnx-hf-id" type="text" placeholder="meta-llama/Llama-2-7b" class="dsnx-input" />
          <button id="dsnx-hf-btn" class="dsnx-btn primary" style="width:100%;">Fetch README</button>
        </div>
      </div>

      <div id="dsnx-view-tokens" class="dsnx-view" style="flex-direction:column; flex:1; overflow-y:auto;">
        <div class="dsnx-fetch-card" style="background:rgba(77,124,254,0.05); border-color:var(--ds-accent);">
          <label style="color:var(--ds-accent);">Global Usage (All Chats)</label>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-top:8px;">
            <span>Total Tokens:</span>
            <strong id="dsnx-global-tokens" style="color:var(--ds-accent);">0</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-top:4px;">
            <span>Chats Tracked:</span>
            <span id="dsnx-global-chats">0</span>
          </div>
        </div>
        <div class="dsnx-fetch-card">
          <label>Current Chat</label>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-top:8px;">
            <span>Messages:</span>
            <span id="dsnx-chat-msgs">0</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-top:4px;">
            <span>Tokens Used:</span>
            <strong id="dsnx-chat-tokens" style="color:var(--ds-accent);">0</strong>
          </div>
          <div style="margin-top:12px;">
            <div style="font-size:11px; color:var(--ds-text-secondary); margin-bottom:4px;">Context Window Usage (128k limit)</div>
            <div style="height:6px; background:var(--ds-border); border-radius:3px; overflow:hidden;">
              <div id="dsnx-context-bar" style="height:100%; background:var(--ds-accent); width:0%; transition:width 0.3s;"></div>
            </div>
          </div>
          <button id="dsnx-refresh-tokens" class="dsnx-btn secondary" style="width:100%; margin-top:12px;">Refresh Count</button>
        </div>
      </div>
    `;
    document.body.appendChild(sidebar);

    DOM.q(".dsnx-close-btn", sidebar).onclick = () => sidebar.classList.remove("open");
    DOM.q("#dsnx-cancel-arm", sidebar).onclick = () => {
      state.armed = null;
      Store.remove(KEYS.ARMED);
      renderList(state.tab);
    };
    
    DOM.qa(".dsnx-tab", sidebar).forEach(tab => {
      tab.onclick = () => {
        DOM.qa(".dsnx-tab", sidebar).forEach(t => t.classList.remove("active"));
        DOM.qa(".dsnx-view", sidebar).forEach(v => v.classList.remove("active"));
        tab.classList.add("active");
        
        const targetId = 
          tab.dataset.tab === "fetch" ? "dsnx-view-fetch" :
          tab.dataset.tab === "tokens" ? "dsnx-view-tokens" :
          "dsnx-view-prompts";
          
        DOM.q(`#${targetId}`, sidebar).classList.add("active");
        
        if (tab.dataset.tab === "tokens") {
          refreshTokens();
        } else if (tab.dataset.tab !== "fetch") {
          renderList(tab.dataset.tab);
        }
      };
    });

    DOM.q("#dsnx-search", sidebar).oninput = () => renderList(state.tab);
    DOM.q("#dsnx-save", sidebar).onclick = async () => {
      const name = DOM.q("#dsnx-name").value.trim();
      const text = DOM.q("#dsnx-text").value.trim();
      if (!name || !text) return alert("Name and text are required.");
      
      const key = state.tab === "skills" ? KEYS.SKILLS : KEYS.PROMPTS;
      const items = await Store.get(key) || [];
      if (items.some(p => p.name.toLowerCase() === name.toLowerCase())) return alert("Name already exists.");
      
      items.unshift({ id: crypto.randomUUID(), name, text });
      await Store.set(key, items);
      
      DOM.q("#dsnx-name").value = "";
      DOM.q("#dsnx-text").value = "";
      renderList(state.tab);
      if (state.tab === "skills") loadSkills();
    };

    DOM.q("#dsnx-export-btn", sidebar).onclick = () => {
      chrome.storage.local.get([KEYS.PROMPTS, KEYS.SKILLS], (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexus-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    
    DOM.q("#dsnx-import-input", sidebar).onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data[KEYS.PROMPTS]) Store.set(KEYS.PROMPTS, data[KEYS.PROMPTS]);
          if (data[KEYS.SKILLS]) Store.set(KEYS.SKILLS, data[KEYS.SKILLS]);
          alert("Backup restored!");
          setTimeout(() => window.location.reload(), 500); 
        } catch (err) { alert("Invalid backup file."); }
      };
      reader.readAsText(file);
    };

    DOM.q("#dsnx-github-btn", sidebar).onclick = async (e) => {
      const url = DOM.q("#dsnx-github-url").value.trim();
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return alert("Invalid GitHub URL");
      
      const btn = e.currentTarget;
      btn.textContent = "..."; btn.disabled = true;
      try {
        let text = null;
        for (const branch of ["HEAD", "main", "master"]) {
          try {
            const data = await Net.fetch(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${branch}/README.md`);
            if (data && data.trim()) { text = data; break; }
          } catch (_) {}
        }
        if (text) {
          await injectAsFile(`${match[1]}-${match[2]}-README.md`, text);
        } else alert("Could not find README.");
      } catch (err) { alert(err.message); }
      finally { btn.textContent = "Fetch README"; btn.disabled = false; }
    };

    DOM.q("#dsnx-hf-btn", sidebar).onclick = async (e) => {
      const id = DOM.q("#dsnx-hf-id").value.trim();
      if (!id) return alert("Enter a model or dataset ID");
      
      const btn = e.currentTarget;
      btn.textContent = "..."; btn.disabled = true;
      try {
        const text = await Net.fetchHF(id);
        await injectAsFile(`${id.replace("/", "-")}-README.md`, text);
      } catch (err) { alert(err.message); }
      finally { btn.textContent = "Fetch README"; btn.disabled = false; }
    };

    DOM.q("#dsnx-refresh-tokens", sidebar).onclick = refreshTokens;

    renderList("prompts");
    refreshTokens();
  }

  // --- INJECTION & OBSERVERS ---
  async function injectAsFile(filename, text) {
    try {
      const fileInput = DOM.q("input[type='file']");
      if (!fileInput) return alert("File input not found.");
      
      const file = new File([text], filename, { type: "text/plain" });
      const dt = new DataTransfer();
      dt.items.add(file);
      
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      
      setTimeout(() => {
        if (fileInput.files && fileInput.files.length > 0) {
          const dropZone = fileInput.closest("form") || document.body;
          dropZone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
        }
      }, 50);
      DOM.q("#dsnx-sidebar")?.classList.remove("open");
    } catch (e) { alert("Failed to inject file."); }
  }

  function injectButton() {
    const target = findComposer();
    if (!target || !DOM.isVisible(target)) return;
    state.composer = target;

    if (!target.dataset.dsnxHooked) {
      target.dataset.dsnxHooked = "1";
      target.addEventListener("input", handleComposerInput);
      target.addEventListener("keydown", handleKeyDown, true);
    }

    const toolbar = target.closest("form") || target.parentElement?.parentElement || target.parentElement;
    if (!toolbar || DOM.q("#dsnx-button")) return;

    const btn = document.createElement("button");
    btn.id = "dsnx-button"; 
    btn.type = "button"; 
    btn.title = "Prompt Nexus (Ctrl+Shift+P)";
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"/><path d="M8 15V9l8 6V9"/></svg>`;
    btn.onclick = (e) => { 
      e.preventDefault(); 
      createSidebar(); 
      DOM.q("#dsnx-sidebar")?.classList.toggle("open"); 
    };
    
    const anchor = DOM.q("button[aria-label*='upload' i], button[aria-label*='attach' i]", toolbar);
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(btn, anchor.nextSibling);
    else toolbar.appendChild(btn);
  }

  function interceptSend() {
    const sendBtn = findSendButton();
    if (sendBtn && !sendBtn.dataset.dsnxHooked) {
      sendBtn.dataset.dsnxHooked = "1";
      sendBtn.addEventListener("click", handleSend, true);
    }
  }

  async function handleSend(event) {
    if (!state.armed || !state.composer) return;
    const visibleText = getComposerText().trim();
    if (!visibleText) return; 

    const combined = `${state.armed.text.trim()}\n\n---\n\n${visibleText}`;
    if (combined.length > 8000) {
      if (event) { event.preventDefault(); event.stopImmediatePropagation(); }
      return alert("Payload exceeds 8,000 characters. Aborting.");
    }

    if (event) { event.preventDefault(); event.stopImmediatePropagation(); }
    
    state.armed = null;
    Store.remove(KEYS.ARMED);
    setComposerText(combined);

    setTimeout(() => {
      const btn = findSendButton();
      if (btn && !btn.disabled) btn.click();
      else if (state.composer.tagName === "TEXTAREA") {
        state.composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      }
    }, 150);
  }

  function handleKeyDown(e) {
    try {
      if (state.slash.open) {
        if (e.key === 'ArrowDown') { e.preventDefault(); state.slash.index = (state.slash.index + 1) % state.slash.filtered.length; showSlashMenu(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); state.slash.index = (state.slash.index - 1 + state.slash.filtered.length) % state.slash.filtered.length; showSlashMenu(); }
        else if (e.key === 'Enter') { e.preventDefault(); selectSlashCommand(state.slash.filtered[state.slash.index]); return; }
        else if (e.key === 'Escape') { e.preventDefault(); hideSlashMenu(); return; }
        else if (e.key === ' ') hideSlashMenu();
      }

      if (e.key === "Enter" && !e.shiftKey && state.armed && document.activeElement === state.composer) {
        handleSend(e);
      }
      
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        createSidebar();
        DOM.q("#dsnx-sidebar")?.classList.add("open");
      }
    } catch (err) {}
  }

  function injectInterceptor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('interceptor.js');
    document.documentElement.appendChild(script);
    script.onload = () => script.remove();
  }

  function init() {
    injectInterceptor();
    loadSkills();
    injectButton();
    interceptSend();

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'DSNX_USAGE') {
        state.tokens.backendUsage = event.data.total_tokens;
        refreshTokens();
      }
    });

    Store.get(KEYS.ARMED).then(val => { state.armed = val; });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[KEYS.ARMED]) state.armed = changes[KEYS.ARMED].newValue || null;
    });

    const observer = new MutationObserver(() => { 
      injectButton(); 
      interceptSend(); 
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();