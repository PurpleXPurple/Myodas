/* ==========================================================================
 * popup/popup.js — action popup controller.
 * Depends on (loaded first, see popup.html):
 *   Nexus.CONST, Nexus.util, Nexus.store, Nexus.tokenizer, Nexus.api,
 *   Nexus.theme
 *
 * Design rules (from the v12 audit):
 *   • No innerHTML with user data anywhere — every node via createElement +
 *     textContent (XSS fix).
 *   • Secrets (GH/HF tokens) live in chrome.storage.session only; the popup
 *     shows whether a token is SET, and lets you replace/clear it — it never
 *     renders the stored value back into an input.
 *   • All remote fetch goes through the service worker (Nexus.api.execute),
 *     so no CORS/CSP concerns here.
 * ========================================================================== */
(function () {
  "use strict";

  const C = Nexus.CONST;
  const U = Nexus.util;

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function status(msg, isError) {
    const s = $("#ph-status");
    s.textContent = msg || "";
    s.classList.toggle("error", !!isError);
    clearTimeout(status._t);
    if (msg) status._t = setTimeout(() => { s.textContent = ""; }, 4000);
  }

  /* ---- tabs ---------------------------------------------------------------- */

  function showTab(id) {
    for (const t of document.querySelectorAll(".ph-tab")) t.classList.toggle("active", t.dataset.tab === id);
    for (const v of document.querySelectorAll(".ph-view")) v.hidden = v.dataset.view !== id;
    if (id === "tokens") refreshTokens();
    if (id === "theme") refreshThemeEditor();
  }

  $("#ph-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".ph-tab");
    if (btn) showTab(btn.dataset.tab);
  });

  /* ---- tokens view ---------------------------------------------------------- */

  async function refreshTokens() {
    try {
      const led = await Nexus.store.getLedger();
      $("#ph-total-tokens").textContent = U.formatNumber
        ? U.formatNumber(led.totalTokens)
        : led.totalTokens.toLocaleString();
    } catch (_) { /* storage race; leave placeholder */ }

    // Ask the worker for the freshest snapshot from any chat tab.
    try {
      const resp = await chrome.runtime.sendMessage({ type: C.MSG.STATE_SNAPSHOT, action: "get" });
      const snap = resp && resp.ok ? resp.data : null;
      if (snap && typeof snap.current === "number") {
        $("#ph-live-tokens").textContent = snap.current.toLocaleString() +
          (snap.source === "exact" ? " (exact)" : "");
      } else {
        $("#ph-live-tokens").textContent = "no active chat";
      }
    } catch (_) {
      $("#ph-live-tokens").textContent = "worker unavailable";
    }
  }

  /* ---- prompts & skills ------------------------------------------------------ */

  function itemRow(item, kind) {
    const li = el("li", "ph-item");
    const main = el("div", "ph-item-main");
    main.append(el("div", "ph-item-name", item.name || "(unnamed)"));
    const sub = kind === "skills" ? (item.description || "") : "";
    main.append(el("div", "ph-item-sub", sub || `${(item.text || "").length} chars`));
    li.append(main);

    const del = el("button", "ph-btn danger", "Delete");
    del.onclick = async () => {
      await Nexus.store.remove(kind, item.id);
      renderList(kind);
      status(`${kind === "skills" ? "Skill" : "Prompt"} deleted.`);
    };
    li.append(del);
    return li;
  }

  async function renderList(kind) {
    const listEl = kind === "skills" ? $("#ph-skill-list") : $("#ph-prompt-list");
    const items = await Nexus.store.list(kind);
    listEl.replaceChildren(...items.map((i) => itemRow(i, kind)));
  }

  $("#ph-add-prompt").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#ph-prompt-name").value.trim();
    const text = $("#ph-prompt-text").value;
    if (!name || !text.trim()) return status("Name and text are required.", true);
    await Nexus.store.add("prompts", { name, text });
    e.target.reset();
    renderList("prompts");
    status("Prompt saved.");
  });

  $("#ph-add-skill").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#ph-skill-name").value.trim();
    const text = $("#ph-skill-text").value;
    if (!name || !text.trim()) return status("Name and instructions are required.", true);
    await Nexus.store.add("skills", { name, description: $("#ph-skill-desc").value.trim(), text, icon: "sparkles" });
    e.target.reset();
    renderList("skills");
    status("Skill saved. The '/' menu in chat updates live.");
  });

  /* ---- theme view (reuses the SHARED editor from theme-engine) -------------- */

  let themeEditor = null;

  function refreshThemeEditor() {
    const holder = $("#ph-theme-editor");
    // Build synchronously from whatever is applied; then sync with stored value.
    themeEditor = Nexus.theme.buildEditor(document, Nexus.theme.current || C.DEFAULT_THEME);
    holder.replaceChildren(themeEditor.node);
    Nexus.store.getLocal(C.KEYS.THEME).then((stored) => {
      if (stored && themeEditor) themeEditor.write(stored);
    }).catch(() => {});
  }

  $("#ph-theme-apply").onclick = async () => {
    if (!themeEditor) return;
    await Nexus.theme.save(themeEditor.read());
    status("Theme applied everywhere (chat + popup).");
  };

  $("#ph-theme-reset").onclick = async () => {
    await Nexus.theme.save(null);
    refreshThemeEditor();
    status("Native theme restored.");
  };

  /* ---- settings view ---------------------------------------------------------- */

  const TOKEN_STATE = { gh: false, hf: false };

  function tokenPlaceholder(which) {
    return TOKEN_STATE[which]
      ? "•••• set — type to replace, clear to remove"
      : "not set";
  }

  async function loadSettings() {
    TOKEN_STATE.gh = !!(await Nexus.store.getToken("gh"));
    TOKEN_STATE.hf = !!(await Nexus.store.getToken("hf"));
    $("#ph-gh-token").placeholder = tokenPlaceholder("gh");
    $("#ph-hf-token").placeholder = tokenPlaceholder("hf");

    const settings = (await Nexus.store.getLocal(C.KEYS.SETTINGS)) || {};
    $("#ph-context-limit").value = settings.contextLimit || C.DEFAULTS.CONTEXT_LIMIT;
  }

  $("#ph-save-settings").onclick = async () => {
    const gh = $("#ph-gh-token").value.trim();
    const hf = $("#ph-hf-token").value.trim();
    if (gh) await Nexus.store.setToken("gh", gh);
    if (hf) await Nexus.store.setToken("hf", hf);
    // If the field was cleared while a token existed → remove it.
    if (!gh && TOKEN_STATE.gh && $("#ph-gh-token").dataset.touched) await Nexus.store.setToken("gh", "");
    if (!hf && TOKEN_STATE.hf && $("#ph-hf-token").dataset.touched) await Nexus.store.setToken("hf", "");

    const limit = Math.max(1000, Math.min(2000000, Number($("#ph-context-limit").value) || C.DEFAULTS.CONTEXT_LIMIT));
    const prev = (await Nexus.store.getLocal(C.KEYS.SETTINGS)) || {};
    await Nexus.store.setLocal(C.KEYS.SETTINGS, { ...prev, contextLimit: limit });

    $("#ph-gh-token").value = "";
    $("#ph-hf-token").value = "";
    await loadSettings();
    status("Settings saved.");
  };

  $("#ph-gh-token").addEventListener("input", (e) => { e.target.dataset.touched = "1"; });
  $("#ph-hf-token").addEventListener("input", (e) => { e.target.dataset.touched = "1"; });

  /* ---- backup / restore -------------------------------------------------------- */

  $("#ph-export").onclick = async () => {
    const doc = await Nexus.store.exportBackup();
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
    const a = el("a");
    a.href = blobUrl;
    a.download = `prompt-nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    status("Backup downloaded.");
  };

  $("#ph-import").onclick = () => $("#ph-import-file").click();
  $("#ph-import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const doc = JSON.parse(await file.text());
      const keys = await Nexus.store.importBackup(doc);
      await Promise.all([renderList("prompts"), renderList("skills"), loadSettings(), refreshThemeEditor()]);
      status(`Restored ${keys.length} section(s) from backup.`);
    } catch (err) {
      status("Import failed: " + err.message, true);
    }
  });

  /* ---- boot ----------------------------------------------------------------------- */

  async function boot() {
    $("#ph-version").textContent = chrome.runtime.getManifest().version;
    Nexus.theme.watch();                       // live palette updates while open
    await Nexus.theme.load().catch(() => Nexus.theme.apply(null));
    Nexus.theme.applyVars(Nexus.theme.palette); // ensure vars even with no theme
    await Promise.all([renderList("prompts"), renderList("skills"), loadSettings()]);
    refreshTokens();
    setInterval(refreshTokens, 5000);          // cheap while popup is open
  }

  boot().catch((err) => status("Startup error: " + err.message, true));
})();
