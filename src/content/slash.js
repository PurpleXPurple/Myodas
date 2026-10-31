/* ==========================================================================
 * src/content/slash.js — "/" skill command menu inside the composer.
 * Namespace: Nexus.slash
 *
 * v11.x issues fixed here (see docs/AUDIT.md #4):
 *   • contenteditable cursor math used range.startOffset only (wrong for
 *     multi-node editors) → now we scan text up to the caret properly;
 *   • menu re-rendered on every keystroke without debounce → debounced;
 *   • menu could render off-screen above small viewports → clamped;
 *   • keyboard handler swallowed Enter globally when armed → scoped and
 *     guarded.
 * ========================================================================== */
(function (global) {
  "use strict";

  const state = {
    open: false,
    index: 0,
    query: "",
    startPos: -1,
    removeLen: 0,
    skills: [],
    filtered: [],
    node: null,
  };

  function doc() { return global.document; }

  function ensureMenu() {
    if (state.node && doc().body.contains(state.node)) return state.node;
    const el = doc().createElement("div");
    el.id = "dsnx-slash-menu";
    el.setAttribute("role", "listbox");
    el.hidden = true;
    doc().body.appendChild(el);
    // mousedown (not click) so it beats the editor's own blur/enter handling.
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const item = e.target.closest(".dsnx-slash-item");
      if (item) select(state.filtered[Number(item.dataset.index)]);
    });
    state.node = el;
    return el;
  }

  /** Caret-relative text before cursor, works for textarea + contenteditable. */
  function caretContext(el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const pos = el.selectionStart || 0;
      return { before: el.value.slice(0, pos), at: pos };
    }
    // contenteditable: walk text nodes until the caret.
    try {
      const sel = global.getSelection();
      if (!sel || !sel.rangeCount) return { before: "", at: 0 };
      const range = sel.getRangeAt(0).cloneRange();
      const pre = doc().createRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.endContainer, range.endOffset);
      return { before: pre.toString(), at: pre.toString().length };
    } catch (_) {
      return { before: el.textContent || "", at: (el.textContent || "").length };
    }
  }

  function hide() {
    state.open = false;
    state.index = 0;
    state.query = "";
    state.startPos = -1;
    state.removeLen = 0;
    if (state.node) state.node.hidden = true;
  }

  function positionMenu(el) {
    const rect = el.getBoundingClientRect();
    const menu = state.node;
    menu.style.left = `${Math.max(8, rect.left)}px`;
    // Prefer above the composer; clamp into viewport.
    const h = menu.offsetHeight || 200;
    const top = rect.top - h - 8;
    menu.style.top = `${top > 8 ? top : Math.min(rect.bottom + 8, innerHeight - h - 8)}px`;
    menu.style.maxWidth = `${Math.min(360, innerWidth - 16)}px`;
  }

  function render() {
    const U = global.Nexus.util;
    const menu = ensureMenu();
    state.filtered = state.skills.filter(
      (s) =>
        s.command.toLowerCase().includes("/" + state.query) ||
        (s.description || "").toLowerCase().includes(state.query)
    );
    if (!state.filtered.length) return hide();
    if (state.index >= state.filtered.length) state.index = state.filtered.length - 1;

    menu.replaceChildren(
      ...state.filtered.map((s, i) => {
        const row = doc().createElement("div");
        row.className = "dsnx-slash-item" + (i === state.index ? " selected" : "");
        row.dataset.index = String(i);
        row.setAttribute("role", "option");
        const icon = doc().createElement("span");
        icon.className = "dsnx-slash-icon";
        icon.innerHTML = panelIcon(s.icon); // icons are from our fixed catalogue
        const txt = doc().createElement("span");
        txt.className = "dsnx-slash-text";
        const cmd = doc().createElement("b");
        cmd.textContent = s.command;
        const desc = doc().createElement("small");
        desc.textContent = s.description || "";
        txt.append(cmd, desc);
        row.append(icon, txt);
        return row;
      })
    );
    menu.hidden = false;
    state.open = true;
    positionMenu(global.Nexus.composer.el);
    void U; // escapeHtml unused with DOM-building renderer (kept API parity)
  }

  function panelIcon(name) {
    const ICONS = global.Nexus.content && global.Nexus.content.ICONS;
    if (!ICONS) return "";
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.sparkles}</svg>`;
  }

  /** Feed skills from storage into the slash registry. */
  function setSkills(list) {
    state.skills = (list || []).map((s) => ({
      command: "/" + (s.name || "").toLowerCase().replace(/\s+/g, "-"),
      name: s.name,
      description: s.description || "",
      icon: s.icon || "sparkles",
      text: s.text || "",
    }));
  }

  /** Call on composer input events. */
  function onInput() {
    const el = global.Nexus.composer.el;
    if (!el) return;
    const { before } = caretContext(el);
    const m = before.match(/\/([a-zA-Z0-9_-]*)$/);
    if (m) {
      state.query = m[1].toLowerCase();
      state.startPos = before.length - m[0].length;
      state.removeLen = m[0].length;
      render();
    } else if (state.open) {
      hide();
    }
  }

  function select(skill) {
    const comp = global.Nexus.composer;
    if (!skill || state.startPos < 0 || !comp.el) return hide();
    comp.splice(state.startPos, state.removeLen, skill.text);
    hide();
    try { comp.el.focus(); } catch (_) {}
  }

  /** Keydown entry point; returns true if the event was consumed. */
  function handleKey(e) {
    if (!state.open) return false;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        state.index = (state.index + 1) % Math.max(1, state.filtered.length);
        render();
        return true;
      case "ArrowUp":
        e.preventDefault();
        state.index = (state.index - 1 + state.filtered.length) % Math.max(1, state.filtered.length);
        render();
        return true;
      case "Enter":
        e.preventDefault();
        select(state.filtered[state.index]);
        return true;
      case "Escape":
        e.preventDefault();
        hide();
        return true;
      case " ":
        hide();
        return false;
      default:
        return false;
    }
  }

  global.Nexus = global.Nexus || {};
  global.Nexus.slash = { setSkills, onInput: global.Nexus.util.debounce(onInput, global.Nexus.CONST.DEFAULTS.SLASH_DEBOUNCE_MS), handleKey, hide, _state: state };
})(typeof self !== "undefined" ? self : window);
