/* ==========================================================================
 * src/content/panel.js — the Nexus sidebar UI injected into chat pages.
 * Namespace: Nexus.panel
 *
 * Rewrite notes (v12):
 *   • Every node is built with createElement/textContent — no innerHTML with
 *     user data (XSS fix, audit item #3). The only innerHTML left is for our
 *     own hard-coded SVG icon strings from ICONS (never user input).
 *   • All colors come from CSS custom properties maintained by the theme
 *     engine — zero inline hex values (audit item #7).
 *   • Fetch tab now uses account tokens via the background worker; token
 *     fields live in chrome.storage.session and are never echoed back.
 *   • Export/import uses the versioned backup format from shared/storage.js.
 * ========================================================================== */
(function (global) {
  "use strict";

  /* Hard-coded icon path catalogue (safe: fixed strings, not user input). */
  const ICONS = {
    "file-text": '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    sparkles:
      '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
    "message-circle":
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    trash:
      '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    logo: '<polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"/><path d="M8 15V9l8 6V9"/>',
  };

  function svgIcon(name, size) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", String(size || 16));
    s.setAttribute("height", String(size || 16));
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    // Safe: ICONS[name] is a constant string from this file only.
    s.innerHTML = ICONS[name] || ICONS.sparkles;
    return s;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  const panel = {
    node: null,
    tab: "prompts",
    _toastTimer: null,

    isOpen() { return !!this.node && this.node.classList.contains("open"); },

    toggle(force) {
      this.ensure();
      if (!this.node) return;
      const open = force != null ? force : !this.node.classList.contains("open");
      this.node.classList.toggle("open", open);
      if (open) this.renderList(this.tab);
    },

    destroy() {
      if (this.node) { this.node.remove(); this.node = null; }
    },

    toast(msg, kind) {
      this.ensure();
      let t = this.node.querySelector(".dsnx-toast");
      if (!t) { t = el("div", "dsnx-toast"); this.node.appendChild(t); }
      t.textContent = msg;
      t.className = "dsnx-toast show" + (kind ? " " + kind : "");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
    },

    /* ---- construction ---------------------------------------------------- */
    ensure() {
      if (this.node && document.body.contains(this.node)) return;
      const root = el("div", "dsnx-panel");
      root.id = "dsnx-sidebar";

      // header
      const header = el("div", "dsnx-header");
      const title = el("div", "dsnx-title");
      title.append(svgIcon("logo", 18), el("span", null, "Prompt Nexus"));
      const actions = el("div", "dsnx-actions");

      const exportBtn = el("button", "dsnx-icon-btn");
      exportBtn.title = "Export backup (JSON)";
      exportBtn.append(svgIcon("download"));
      exportBtn.onclick = () => this.onExport();

      const importBtn = el("button", "dsnx-icon-btn");
      importBtn.title = "Import backup (JSON)";
      importBtn.append(svgIcon("upload"));
      importBtn.onclick = () => root.querySelector("#dsnx-import-file").click();
      const importFile = el("input", null);
      importFile.type = "file";
      importFile.id = "dsnx-import-file";
      importFile.accept = ".json,application/json";
      importFile.hidden = true;
      importFile.onchange = (e) => this.onImportFile(e.target.files[0]);

      const closeBtn = el("button", "dsnx-icon-btn");
      closeBtn.title = "Close";
      closeBtn.append(svgIcon("close", 18));
      closeBtn.onclick = () => this.toggle(false);

      actions.append(exportBtn, importBtn, importFile, closeBtn);
      header.append(title, actions);

      // tabs
      const tabs = el("div", "dsnx-tabs");
      for (const [id, label] of [["prompts", "Prompts"], ["skills", "Skills"], ["fetch", "Fetch"], ["tokens", "Tokens"], ["theme", "Theme"]]) {
        const b = el("button", "dsnx-tab" + (id === this.tab ? " active" : ""), label);
        b.dataset.tab = id;
        b.onclick = () => this.switchTab(id);
        tabs.append(b);
      }

      // views
      const vPrompts = this.buildListView("prompts");
      const vSkills = this.buildListView("skills");
      const vFetch = this.buildFetchView();
      const vTokens = this.buildTokensView();
      const vTheme = this.buildThemeView();

      root.append(header, tabs, vPrompts, vSkills, vFetch, vTokens, vTheme);
      document.body.appendChild(root);
      this.node = root;
    },

    switchTab(id) {
      this.tab = id;
      if (!this.node) return;
      for (const b of this.node.querySelectorAll(".dsnx-tab")) b.classList.toggle("active", b.dataset.tab === id);
      for (const v of this.node.querySelectorAll(".dsnx-view")) v.classList.toggle("active", v.dataset.view === id);
      if (id === "prompts" || id === "skills") this.renderList(id);
      if (id === "tokens") global.Nexus.tokens.refresh();
      if (id === "theme") this.refreshThemeView();
    },

    /* ---- prompts / skills lists ------------------------------------------ */
    buildListView(kind) {
      const view = el("div", "dsnx-view" + (kind === this.tab ? " active" : ""));
      view.dataset.view = kind;

      const search = el("input", "dsnx-input");
      search.type = "search";
      search.placeholder = `Search ${kind}…`;
      search.oninput = global.Nexus.util.debounce(() => this.renderList(kind, search.value), 120);

      const list = el("div", "dsnx-list");
      list.dataset.list = kind;

      const form = el("div", "dsnx-form");
      const name = el("input", "dsnx-input");
      name.placeholder = "Title";
      const desc = el("input", "dsnx-input");
      desc.placeholder = "Short description";
      desc.hidden = kind !== "skills";
      desc.dataset.role = "desc";
      const body = el("textarea", "dsnx-textarea");
      body.placeholder = kind === "skills" ? "Text injected when /skill is chosen…" : "Prompt text…";
      const save = el("button", "dsnx-btn primary", "Save");
      save.onclick = async () => {
        const n = name.value.trim();
        const t = body.value.trim();
        if (!n || !t) return this.toast("Name and text are required.", "warn");
        const items = await global.Nexus.store.list(kind);
        if (items.some((i) => (i.name || "").toLowerCase() === n.toLowerCase()))
          return this.toast(`A ${kind.slice(0, -1)} named “${n}” already exists.`, "warn");
        const entry = { name: n, text: t };
        if (kind === "skills") entry.description = desc.value.trim();
        await global.Nexus.store.add(kind, entry);
        name.value = ""; body.value = ""; desc.value = "";
        if (kind === "skills") global.Nexus.slash.setSkills(await global.Nexus.store.list("skills"));
        this.renderList(kind);
        this.toast(`Saved “${n}”.`, "ok");
      };

      form.append(name, desc, body, save);
      view.append(search, list, form);
      return view;
    },

    async renderList(kind, query) {
      if (!this.node) return;
      const listEl = this.node.querySelector(`[data-list="${kind}"]`);
      if (!listEl) return;
      const U = global.Nexus.util;
      const items = await U.withTimeout(global.Nexus.store.list(kind), 3000, "storage read").catch(() => []);
      const q = (query || (this.node.querySelector(`[data-view="${kind}"] .dsnx-input`)?.value || "")).toLowerCase().trim();
      const filtered = items.filter((p) => !q || (p.name || "").toLowerCase().includes(q) || (p.text || "").toLowerCase().includes(q));
      const armed = await global.Nexus.store.getArmed();

      listEl.replaceChildren();
      if (!filtered.length) {
        listEl.append(el("div", "dsnx-empty", `No ${kind} saved.`));
        return;
      }

      for (const item of filtered) {
        const row = el("div", "dsnx-item" + (armed && armed.id === item.id ? " armed" : ""));
        const main = el("div", "dsnx-item-main");
        if (kind === "skills") {
          const ic = el("div", "dsnx-item-icon");
          ic.append(svgIcon(item.icon || "sparkles"));
          main.append(ic);
        }
        const txt = el("div", "dsnx-item-text");
        txt.append(el("div", "dsnx-item-name", item.name || "Unnamed"));
        txt.append(el("div", "dsnx-item-preview", item.description || (item.text || "").slice(0, 80)));
        main.append(txt);

        // arm switch
        const label = el("label", "dsnx-switch");
        label.title = armed && armed.id === item.id ? "Disarm" : "Arm for next message";
        const cb = el("input");
        cb.type = "checkbox";
        cb.checked = !!(armed && armed.id === item.id);
        cb.onchange = async () => {
          if (cb.checked) await global.Nexus.store.setArmed(item);
          else await global.Nexus.store.clearArmed();
          this.renderList(kind, q);
        };
        const slider = el("span", "dsnx-slider-ui");
        label.append(cb, slider);

        const del = el("button", "dsnx-icon-btn danger");
        del.title = "Delete";
        del.append(svgIcon("trash"));
        del.onclick = async () => {
          await global.Nexus.store.remove(kind, item.id);
          if (kind === "skills") global.Nexus.slash.setSkills(await global.Nexus.store.list("skills"));
          this.renderList(kind, q);
          this.toast(`Deleted “${item.name}”.`, "ok");
        };

        row.append(main, label, del);
        listEl.append(row);
      }
    },

    /* ---- fetch view (account-token based) --------------------------------- */
    buildFetchView() {
      const view = el("div", "dsnx-view");
      view.dataset.view = "fetch";

      const mkCard = (titleText) => {
        const card = el("div", "dsnx-card");
        card.append(el("label", "dsnx-card-label", titleText));
        return card;
      };

      // GitHub
      const gh = mkCard("GitHub repository (README via api.github.com)");
      const ghUrl = el("input", "dsnx-input");
      ghUrl.placeholder = "https://github.com/owner/repo or owner/repo";
      const ghTok = el("input", "dsnx-input");
      ghTok.type = "password";
      ghTok.placeholder = "GitHub token (optional for public repos, required for private)";
      const ghBtn = el("button", "dsnx-btn primary", "Fetch README → Chat");
      ghBtn.onclick = () => this.fetchGithub(ghUrl.value, ghTok.value, ghBtn);
      gh.append(ghUrl, ghTok, ghBtn);

      // Hugging Face
      const hf = mkCard("Hugging Face model card (via huggingface.co/api)");
      const hfId = el("input", "dsnx-input");
      hfId.placeholder = "deepseek-ai/DeepSeek-V3";
      const hfTok = el("input", "dsnx-input");
      hfTok.type = "password";
      hfTok.placeholder = "HF access token (for gated/private repos)";
      const hfBtn = el("button", "dsnx-btn primary", "Fetch README → Chat");
      hfBtn.onclick = () => this.fetchHf(hfId.value, hfTok.value, hfBtn);
      hf.append(hfId, hfTok, hfBtn);

      const note = el("p", "dsnx-note",
        "Tokens are kept in memory-only session storage and sent exclusively to api.github.com / huggingface.co.");

      view.append(gh, hf, note);
      // Restore masked placeholders asynchronously (values themselves stay hidden).
      Promise.all([
        global.Nexus.store.getToken("gh"),
        global.Nexus.store.getToken("hf"),
      ]).then(([g, h]) => {
        if (g) ghTok.placeholder = "GitHub token stored ✓ (type to replace)";
        if (h) hfTok.placeholder = "HF token stored ✓ (type to replace)";
      }).catch(() => {});
      return view;
    },

    async fetchGithub(rawInput, tokenInput, btn) {
      const A = global.Nexus.api;
      const pair = A.parseGithub(rawInput);
      if (!pair) return this.toast("Enter a GitHub URL or owner/repo.", "warn");
      if (tokenInput) await global.Nexus.store.setToken("gh", tokenInput);
      const token = (tokenInput || "").trim() || (await global.Nexus.store.getToken("gh"));
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Fetching…";
      try {
        const text = await A.execute(A.ghReadmePlan(pair[0], pair[1], token));
        await this.sendReadmeToChat(`${pair[0]}-${pair[1]}-README.md`, text);
        this.toast("README attached to your chat composer.", "ok");
      } catch (err) {
        this.toast(String(err.message || err), "err");
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    },

    async fetchHf(id, tokenInput, btn) {
      const A = global.Nexus.api;
      id = (id || "").trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(id)) return this.toast("Enter a model ID like deepseek-ai/DeepSeek-V3.", "warn");
      if (tokenInput) await global.Nexus.store.setToken("hf", tokenInput);
      const token = (tokenInput || "").trim() || (await global.Nexus.store.getToken("hf"));
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Fetching…";
      try {
        const text = await A.execute(A.hfReadmePlan(id, token));
        await this.sendReadmeToChat(`${id.replace("/", "-")}-README.md`, text);
        this.toast("Model card attached to your chat composer.", "ok");
      } catch (err) {
        this.toast(String(err.message || err), "err");
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    },

    /** Attach fetched markdown as a file to the site's own upload input. */
    async sendReadmeToChat(filename, text) {
      const fileInput = document.querySelector("input[type='file']");
      if (!fileInput) throw new Error("Upload control not found on the page.");
      const file = new File([text], filename, { type: "text/markdown" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
      if (setter && setter.set) setter.set.call(fileInput, dt.files);
      else fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      this.toggle(false);
    },

    /* ---- tokens view ------------------------------------------------------- */
    buildTokensView() {
      const view = el("div", "dsnx-view");
      view.dataset.view = "tokens";

      const globalCard = el("div", "dsnx-card accent");
      globalCard.append(el("label", "dsnx-card-label", "Global usage (tracked chats)"));
      const totalRow = el("div", "dsnx-stat");
      totalRow.append(el("span", null, "Total tokens:"), el("strong", "dsnx-stat-strong", "0"));
      totalRow.querySelector("strong").id = "dsnx-global-tokens";
      const chatsRow = el("div", "dsnx-stat");
      chatsRow.append(el("span", null, "Chats tracked:"), el("span", null, "0"));
      chatsRow.lastChild.id = "dsnx-global-chats";
      globalCard.append(totalRow, chatsRow);

      const curCard = el("div", "dsnx-card");
      curCard.append(el("label", "dsnx-card-label", "Current chat"));
      const msgsRow = el("div", "dsnx-stat");
      msgsRow.append(el("span", null, "Messages:"), el("span", null, "0"));
      msgsRow.lastChild.id = "dsnx-chat-msgs";
      const tokRow = el("div", "dsnx-stat");
      tokRow.append(el("span", null, "Tokens used:"), el("strong", "dsnx-stat-strong", "0"));
      tokRow.querySelector("strong").id = "dsnx-chat-tokens";
      const srcRow = el("div", "dsnx-stat");
      srcRow.append(el("span", null, "Source:"), el("span", "dsnx-src-badge", "—"));
      srcRow.lastChild.id = "dsnx-token-source";

      const barWrap = el("div", "dsnx-bar-wrap");
      barWrap.append(el("div", "dsnx-bar-label", "Context window usage"));
      const barOuter = el("div", "dsnx-bar");
      const barInner = el("div", "dsnx-bar-fill");
      barInner.id = "dsnx-context-bar";
      barOuter.append(barInner);
      barWrap.append(barOuter);

      const refresh = el("button", "dsnx-btn secondary", "Refresh count");
      refresh.id = "dsnx-refresh-tokens";
      refresh.onclick = () => global.Nexus.tokens.refresh();

      curCard.append(msgsRow, tokRow, srcRow, barWrap, refresh);
      view.append(globalCard, curCard);
      return view;
    },

    updateTokens(tokState) {
      if (!this.node) return;
      const C = global.Nexus.CONST;
      const set = (id, val) => { const n = this.node.querySelector("#" + id); if (n) n.textContent = val; };
      set("dsnx-chat-tokens", (tokState.lastComputed || 0).toLocaleString());
      set("dsnx-chat-msgs", String(document.querySelectorAll("div[data-um-id], div.ds-markdown").length));
      const srcMap = { exact: "exact (API usage)", estimate: "estimated (offline tokenizer)", heuristic: "estimated (heuristic)", none: "no messages yet" };
      set("dsnx-token-source", srcMap[tokState.lastSource] || tokState.lastSource);
      global.Nexus.store.getLedger().then((led) => {
        set("dsnx-global-tokens", led.totalTokens.toLocaleString());
        set("dsnx-global-chats", String(Object.keys(led.sessions).length));
      }).catch(() => {});
      const pct = Math.min(((tokState.lastComputed || 0) / C.DEFAULTS.CONTEXT_LIMIT) * 100, 100);
      const bar = this.node.querySelector("#dsnx-context-bar");
      if (bar) {
        bar.style.width = pct + "%";
        bar.classList.toggle("hot", pct > 90);
      }
    },

    /* ---- theme view (shared editor) ---------------------------------------- */
    buildThemeView() {
      const view = el("div", "dsnx-view");
      view.dataset.view = "theme";
      const holder = el("div", "dsnx-theme-holder");
      holder.id = "dsnx-theme-holder";

      const imgBtn = el("button", "dsnx-btn secondary", "Extract palette from image…");
      const imgFile = el("input");
      imgFile.type = "file";
      imgFile.accept = "image/*";
      imgFile.hidden = true;
      imgFile.onchange = (e) => this.extractFromFile(e.target.files[0]);
      imgBtn.onclick = () => imgFile.click();

      const apply = el("button", "dsnx-btn primary", "Apply theme");
      apply.onclick = async () => {
        const ed = this._themeEditor;
        if (!ed) return;
        await global.Nexus.theme.save(ed.read());
        this.toast("Theme applied everywhere.", "ok");
      };
      const reset = el("button", "dsnx-btn secondary", "Reset to native");
      reset.onclick = async () => {
        await global.Nexus.theme.save(null);
        this.refreshThemeView();
        this.toast("Native theme restored.", "ok");
      };

      view.append(holder, imgBtn, imgFile, el("div", "dsnx-btnrow", null));
      view.querySelector(".dsnx-btnrow").append(apply, reset);
      return view;
    },

    refreshThemeView() {
      if (!this.node) return;
      const holder = this.node.querySelector("#dsnx-theme-holder");
      if (!holder) return;
      const editor = global.Nexus.theme.buildEditor(document, global.Nexus.theme.current || global.Nexus.CONST.DEFAULT_THEME);
      holder.replaceChildren(editor.node);
      this._themeEditor = editor;
    },

    async extractFromFile(file) {
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const pal = await global.Nexus.theme.extractPalette(url);
        if (!pal) return this.toast("Could not extract a color from that image.", "warn");
        if (this._themeEditor) this._themeEditor.write(pal);
        this.toast("Palette extracted — press Apply.", "ok");
      } finally {
        URL.revokeObjectURL(url);
      }
    },

    /* ---- backup ------------------------------------------------------------ */
    async onExport() {
      try {
        const doc = await global.Nexus.store.exportBackup();
        const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      } catch (err) {
        this.toast("Export failed: " + err.message, "err");
      }
    },

    async onImportFile(file) {
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const keys = await global.Nexus.store.importBackup(parsed);
        this.toast(`Restored ${keys.length} section(s). Reloading slash commands…`, "ok");
        global.Nexus.slash.setSkills(await global.Nexus.store.list("skills"));
        this.renderList(this.tab === "theme" || this.tab === "fetch" || this.tab === "tokens" ? "prompts" : this.tab);
      } catch (err) {
        this.toast("Import failed: " + (err.message || "invalid file"), "err");
      }
    },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.content = { ICONS, svgIcon };
  global.Nexus.panel = panel;
})(typeof self !== "undefined" ? self : window);
