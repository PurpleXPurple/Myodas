/* ==========================================================================
 * src/shared/util.js — tiny cross-context helpers (DOM-safe and worker-safe).
 * Namespace: Nexus.util
 * ========================================================================== */
(function (global) {
  "use strict";

  const util = {
    /** Escape a string for safe interpolation into innerHTML. */
    escapeHtml(str) {
      if (str == null) return "";
      return String(str).replace(/[&<>'"]/g, (tag) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[tag]));
    },

    /** Generate an id; crypto.randomUUID when available, fallback otherwise. */
    uid() {
      if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
      return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    },

    /** Stable small hash of a string (djb2), used as per-chat ledger keys. */
    hash(str) {
      let h = 5381;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) | 0;
      }
      return (h >>> 0).toString(36);
    },

    /** Promise with timeout; rejects with TimeoutError on expiry. */
    withTimeout(promise, ms, label = "operation") {
      return new Promise((resolve, reject) => {
        const t = setTimeout(
          () => reject(new DOMException(`Timeout after ${ms}ms: ${label}`, "TimeoutError")),
          ms
        );
        promise.then(
          (v) => { clearTimeout(t); resolve(v); },
          (e) => { clearTimeout(t); reject(e); }
        );
      });
    },

    /** Clamp n into [lo, hi]. */
    clamp(n, lo, hi) {
      return Math.min(Math.max(n, lo), hi);
    },

    /** Debounce a function by `ms` milliseconds. */
    debounce(fn, ms) {
      let timer = null;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
      };
    },

    /** requestIdleCallback wrapper with a guaranteed fallback. */
    idle(fn) {
      if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 1000 });
      else setTimeout(fn, 200);
    },

    /** Safe JSON parse returning `fallback` on error. */
    jsonTry(text, fallback = null) {
      try { return JSON.parse(text); } catch { return fallback; }
    },

    /** Normalize "#RGB" → "#RRGGBB"; returns null for anything else. */
    normalizeHex(value) {
      if (typeof value !== "string") return null;
      let v = value.trim();
      if (!v.startsWith("#")) v = "#" + v;
      if (/^#[0-9a-fA-F]{3}$/.test(v)) {
        v = "#"+ v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
      }
      return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
    },

    /** Linear mix of two hex colors; weight 0 → c1, 1 → c2. */
    mixColors(c1, c2, weight) {
      const a = util.normalizeHex(c1) || "#333333";
      const b = util.normalizeHex(c2) || "#333333";
      const w = util.clamp(Number(weight) || 0, 0, 1);
      const px = (h, i) => parseInt(h.slice(i, i + 2), 16);
      const ch = (i) =>
        Math.round(px(a, i) * (1 - w) + px(b, i) * w).toString(16).padStart(2, "0");
      return `#${ch(1)}${ch(3)}${ch(5)}`;
    },

    /** Relative luminance (Rec. 601) of a hex color, 0..1. Null if invalid. */
    luminance(hex) {
      const h = util.normalizeHex(hex);
      if (!h) return null;
      const r = parseInt(h.slice(1, 3), 16);
      const g = parseInt(h.slice(3, 5), 16);
      const b = parseInt(h.slice(5, 7), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    },

    /** Pick black or white text for readable contrast over `bg`. */
    readableText(bg) {
      const lum = util.luminance(bg);
      if (lum == null) return "#ffffff";
      return lum > 0.55 ? "#111111" : "#ffffff";
    },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.util = util;
})(typeof self !== "undefined" ? self : window);
