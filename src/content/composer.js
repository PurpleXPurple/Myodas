/* ==========================================================================
 * src/content/composer.js — chat composer discovery & text manipulation.
 * Namespace: Nexus.composer  (content-script world)
 *
 * Consolidates what used to be spread across content.js: findComposer(),
 * findSendButton(), get/setComposerText(). One owner = easier fixes when the
 * site changes its DOM. All selectors are defensive (try/catch, null-safe).
 * ========================================================================== */
(function (global) {
  "use strict";

  const composer = {
    el: null, // last known composer element

    find() {
      const qa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
      let best = null;
      for (const el of qa("textarea")) {
        if (!el.getBoundingClientRect().width && !el.getBoundingClientRect().height) continue;
        if (document.activeElement === el) { this.el = el; return el; }
        if (!best || el.getBoundingClientRect().top > best.getBoundingClientRect().top) best = el;
      }
      this.el = best || qa("div[contenteditable='true']").pop() || null;
      return this.el;
    },

    isTextarea() { return !!this.el && this.el.tagName === "TEXTAREA"; },

    text() {
      if (!this.el) return "";
      return this.isTextarea() ? this.el.value || "" : this.el.innerText || "";
    },

    /** Replace all composer text in a framework-friendly way (React-safe). */
    setText(value) {
      if (!this.el) return false;
      if (this.isTextarea()) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
        if (setter && setter.set) setter.set.call(this.el, value);
        else this.el.value = value;
        this.el.dispatchEvent(new Event("input", { bubbles: true }));
        try {
          const end = this.el.value.length;
          this.el.setSelectionRange(end, end);
        } catch (_) {}
        return true;
      }
      // contenteditable path
      this.el.focus();
      try {
        const sel = global.getSelection();
        const range = document.createRange();
        range.selectNodeContents(this.el);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("insertText", false, value);
      } catch (_) {
        this.el.textContent = value;
        this.el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return true;
    },

    /** Insert `text` at absolute index `at`, replacing [at, removeLen). */
    splice(at, removeLen, text) {
      const cur = this.text();
      const next = cur.slice(0, at) + text + cur.slice(at + removeLen);
      this.setText(next);
      if (this.isTextarea()) {
        const pos = at + text.length;
        try { this.el.setSelectionRange(pos, pos); } catch (_) {}
      }
    },

    findSendButton() {
      const q = (sel, root) => { try { return (root || document).querySelector(sel); } catch (_) { return null; } };
      const scope = this.el
        ? this.el.closest("form") || (this.el.parentElement && this.el.parentElement.parentElement) || document
        : document;
      return (
        q("button[aria-label*='Send' i], button[type='submit']", scope) ||
        q("button[aria-label*='Send' i], button[type='submit']")
      );
    },

    send() {
      const btn = this.findSendButton();
      if (btn && !btn.disabled) { btn.click(); return true; }
      if (this.isTextarea() && this.el) {
        this.el.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
        );
        return true;
      }
      return false;
    },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.composer = composer;
})(typeof self !== "undefined" ? self : window);
