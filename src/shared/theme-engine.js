/* ==========================================================================
 * src/shared/theme-engine.js — the rewritten theme system.
 * Namespace: Nexus.theme
 *
 * WHAT CHANGED vs. v11.x (themes.js)
 * ----------------------------------
 * OLD PROBLEMS (see docs/AUDIT.md #6–#9):
 *   • ~40 lines of innerHTML string CSS with `!important` shotgun selectors
 *     ([class*="bg-…"]) that fought the site's own styles and broke on every
 *     site redesign.
 *   • Theme state duplicated between inline styles, a <style> blob, and two
 *     separate editor UIs (popup + injected settings modal), each writing
 *     slightly different shapes to storage.
 *   • setInterval(..., 1000) DOM polling forever, even when idle.
 *   • No validation: any junk string was stored as a "color".
 *
 * NEW DESIGN:
 *   1. A single canonical theme model {bg, surface, text, accent} validated
 *      with normalizeHex(); derived tokens (border, muted text, hover, danger,
 *      on-accent) are COMPUTED, never hand-entered.
 *   2. Application = set CSS custom properties on :root via one style element
 *      (#dsnx-theme-vars). Extension-owned UI (sidebar/popup) consumes those
 *      variables directly. The page itself is re-skinned through ONE narrow,
 *      layered rule-set that only targets containers we can prove exist, and
 *      respects prefers-color-scheme so light-site users get light surfaces.
 *   3. Live updates via chrome.storage.onChanged — no polling loops.
 *   4. One shared editor builder (used by popup AND the in-page panel), so
 *      both UIs always read/write identical data.
 * ========================================================================== */
(function (global) {
  "use strict";

  const C = () => global.Nexus.CONST;
  const U = () => global.Nexus.util;

  /* Derive the full token palette from the four user-facing colors. */
  function derive(t) {
    const u = U();
    const border = u.mixColors(t.surface, t.text, 0.14);
    const hover = u.mixColors(t.surface, t.text, 0.08);
    const muted = u.mixColors(t.text, t.bg, 0.55);
    const faint = u.mixColors(t.text, t.bg, 0.78);
    const onAccent = u.readableText(t.accent);
    const danger = "#ef4444";
    const ring = u.mixColors(t.accent, t.text, 0.2);
    return { ...t, border, hover, muted, faint, onAccent, danger, ring };
  }

  const theme = {
    current: null,

    /** Validate & normalize a raw theme object; falls back per-field. */
    sanitize(raw) {
      const u = U();
      const d = C().DEFAULT_THEME;
      if (!raw || typeof raw !== "object") return null;
      const out = {};
      for (const key of ["bg", "surface", "text", "accent"]) {
        out[key] = u.normalizeHex(raw[key]) || d[key];
      }
      return out;
    },

    /* ---- application ---------------------------------------------------- */

    /** Install (or update) the CSS custom-property layer. Pure DOM, idempotent. */
    applyVars(palette) {
      const doc = global.document;
      if (!doc) return;
      let el = doc.getElementById("dsnx-theme-vars");
      if (!el) {
        el = doc.createElement("style");
        el.id = "dsnx-theme-vars";
        doc.documentElement.appendChild(el);
      }
      const map = {
        "--dsnx-bg-base": palette.bg,
        "--dsnx-bg-card": palette.surface,
        "--dsnx-bg-hover": palette.hover,
        "--dsnx-border": palette.border,
        "--dsnx-text-primary": palette.text,
        "--dsnx-text-secondary": palette.muted,
        "--dsnx-text-faint": palette.faint,
        "--dsnx-accent": palette.accent,
        "--dsnx-on-accent": palette.onAccent,
        "--dsnx-danger": palette.danger,
        "--dsnx-ring": palette.ring,
      };
      el.textContent =
        ":root{" + Object.entries(map).map(([k, v]) => `${k}:${v};`).join("") + "}";
      this._vars = map;
    },

    /**
     * Re-skin the host page. Deliberately minimal: instead of fighting every
     * utility class, we paint the big structural surfaces and let component
     * colors come from inherited text color + our scrollbar/selection rules.
     * `layer: 1` keeps specificity predictable; site updates rarely add
     * inline background colors to these elements.
     */
    applyPageOverride(palette) {
      const doc = global.document;
      if (!doc) return;
      let el = doc.getElementById("dsnx-theme-page");
      if (!palette) { if (el) el.remove(); return; }
      if (!el) {
        el = doc.createElement("style");
        el.id = "dsnx-theme-page";
        doc.documentElement.appendChild(el);
      }
      const isLight = U().luminance(palette.bg) > 0.5;
      el.textContent = `
html,body{background:${palette.bg} !important;color:${palette.text} !important;}
main,aside,header,#root{background-color:transparent !important;color:inherit;}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:${palette.border};border-radius:5px}
::selection{background:${palette.accent};color:${palette.onAccent}}
a{color:${palette.accent} !important}
input,textarea,[contenteditable="true"]{caret-color:${palette.accent} !important}
${isLight ? "" : `.ds-markdown code{background:${palette.hover} !important}`}
`.trim();
    },

    /** Full apply pipeline from a raw stored value (null clears everything). */
    apply(rawTheme) {
      const t = rawTheme ? this.sanitize(rawTheme) : null;
      this.current = t;
      if (t) {
        const palette = derive(t);
        this.palette = palette;
        this.applyVars(palette);
        this.applyPageOverride(palette);
      } else {
        this.palette = derive(C().DEFAULT_THEME);
        this.applyVars(this.palette);          // extension UI still needs vars
        this.applyPageOverride(null);          // page returns to native look
      }
      return this.current;
    },

    /** Read from storage and apply. */
    async load() {
      const K = C().KEYS;
      const res = await chrome.storage.local.get(K.THEME);
      return this.apply(res[K.THEME] || null);
    },

    /** Persist + broadcast (storage.onChanged does the live update). */
    async save(rawTheme) {
      const K = C().KEYS;
      const t = rawTheme ? this.sanitize(rawTheme) : null;
      if (t) await chrome.storage.local.set({ [K.THEME]: t });
      else await chrome.storage.local.remove(K.THEME);
      this.apply(t);
      return t;
    },

    /** Auto-start listening for cross-context changes (idempotent). */
    watch() {
      if (this._watching) return;
      this._watching = true;
      const K = C().KEYS;
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[K.THEME]) this.apply(changes[K.THEME].newValue || null);
      });
    },

    /* ---- shared editor UI (used by popup and in-page panel) ------------- */

    /**
     * Build a theme editor node. Returns {node, read(), write(theme)}.
     * `document` must be provided by the caller context.
     */
    buildEditor(hostDoc, initial) {
      const u = U();
      const t = initial ? this.sanitize(initial) : { ...C().DEFAULT_THEME };
      const wrap = hostDoc.createElement("div");
      wrap.className = "dsnx-theme-editor";
      const fields = [
        ["accent", "Accent"],
        ["bg", "Background"],
        ["surface", "Surface / Cards"],
        ["text", "Text"],
      ];
      wrap.innerHTML = fields
        .map(
          ([key, label]) => `
        <div class="dsnx-theme-field">
          <label for="dsnx-tf-${key}">${u.escapeHtml(label)}</label>
          <div class="dsnx-theme-row">
            <input type="color" id="dsnx-tf-${key}-pick" value="${t[key]}" />
            <input type="text" id="dsnx-tf-${key}" value="${t[key]}" spellcheck="false"
                   inputmode="hex" maxlength="7" aria-label="${u.escapeHtml(label)} hex" />
          </div>
        </div>`
        )
        .join("");

      // Keep picker ⇄ text inputs in sync, validate before accepting.
      for (const [key] of fields) {
        const pick = wrap.querySelector(`#dsnx-tf-${key}-pick`);
        const text = wrap.querySelector(`#dsnx-tf-${key}`);
        pick.addEventListener("input", () => { text.value = pick.value; text.classList.remove("invalid"); });
        text.addEventListener("input", () => {
          const hex = u.normalizeHex(text.value);
          if (hex) { pick.value = hex; text.classList.remove("invalid"); }
          else text.classList.add("invalid");
        });
      }

      return {
        node: wrap,
        read() {
          const out = {};
          for (const [key] of fields) {
            out[key] = u.normalizeHex(wrap.querySelector(`#dsnx-tf-${key}`).value) || t[key];
          }
          return out;
        },
        write(next) {
          const s = theme.sanitize(next) || next || {};
          for (const [key] of fields) {
            if (!s[key]) continue;
            const hex = u.normalizeHex(s[key]);
            if (!hex) continue;
            wrap.querySelector(`#dsnx-tf-${key}`).value = hex;
            wrap.querySelector(`#dsnx-tf-${key}-pick`).value = hex;
            wrap.querySelector(`#dsnx-tf-${key}`).classList.remove("invalid");
          }
        },
      };
    },

    /**
     * Extract a dominant saturated color from an ImageBitmap/canvas-loadable
     * image URL. Returns {accent, bg, surface, text} suggestion or null.
     */
    extractPalette(src) {
      return new Promise((resolve) => {
        const doc = global.document;
        if (!doc || !src) return resolve(null);
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = doc.createElement("canvas");
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            canvas.width = 64; canvas.height = 64;
            ctx.drawImage(img, 0, 0, 64, 64);
            const data = ctx.getImageData(0, 0, 64, 64).data;
            let bestSat = 0, best = null;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
              if (a < 128) continue;
              const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
              const l = (mx + mn) / 2;
              const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
              if (s > bestSat && l > 0.15 && l < 0.85) { bestSat = s; best = { r, g, b }; }
            }
            if (!best) return resolve(null);
            const u2 = U();
            const hex = "#" + [best.r, best.g, best.b].map((n) => n.toString(16).padStart(2, "0")).join("");
            const darkBg = u2.luminance(hex) < 0.5;
            resolve({
              accent: hex,
              bg: u2.mixColors(hex, darkBg ? "#000000" : "#ffffff", 0.92),
              surface: u2.mixColors(hex, darkBg ? "#000000" : "#ffffff", 0.84),
              text: darkBg ? "#f5f5f5" : "#111111",
            });
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.theme = theme;
})(typeof self !== "undefined" ? self : window);
