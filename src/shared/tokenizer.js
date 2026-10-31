/* ==========================================================================
 * src/shared/tokenizer.js — OFFLINE DeepSeek-style token counter.
 * Namespace: Nexus.tokenizer
 *
 * WHY THIS EXISTS (bug fix, v12.0.0)
 * ----------------------------------
 * The previous implementation did:
 *     await import('https://cdn.jsdelivr.net/npm/@lenml/tokenizer-deepseek_v3…')
 * from a content script. chat.deepseek.com serves a Content-Security-Policy
 * with `script-src 'self' …`, which forbids loading any remote script — so
 * the dynamic import was blocked and every count silently fell back to a
 * crude 0.3/0.6-per-char heuristic that printed console errors.
 *
 * FIX STRATEGY (defence in depth, all local — zero remote scripts):
 *   1. Ground truth first: whenever the page's own API returns
 *      `usage.total_tokens` (see interceptor.js), we use that exact number.
 *   2. Deterministic estimator: a packaged vocabulary (data/tokenizer-vocab
 *      .json) drives a longest-match greedy segmentation; characters not
 *      covered fall back to a calibrated per-codepoint cost table
 *      (data/char-stats.json). Both files are shipped inside the extension
 *      and loaded via chrome.runtime.getURL — same-origin, CSP-clean.
 *   3. If even packaged data fails to load, a pure-computation fallback
 *      (regex word/digit/CJK model) still produces sane numbers, offline.
 *
 * This module is usable from content scripts AND the service worker
 * (fetch(chrome.runtime.getURL(...)) works in both). In plain-node tests,
 * call Nexus.tokenizer.setData(vocabDoc, statsDoc) directly.
 * ========================================================================== */
(function (global) {
  "use strict";

  const CJK_RE = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

  const tokenizer = {
    _vocab: null,          // Map<string, id>
    _maxTokenLen: 0,       // longest vocab entry (bounds the greedy scan)
    _charCost: null,       // Map<char, avg-token-cost>
    _charDefault: 0.35,
    _loading: null,        // shared load promise (dedupe concurrent loads)
    _mode: "unloaded",     // "exact-usage" | "vocab" | "stats" | "heuristic"

    /* ---- data loading -------------------------------------------------- */

    /** Load packaged JSON assets. Safe to call repeatedly; deduped. */
    load() {
      if (this._loading) return this._loading;
      this._loading = (async () => {
        try {
          const base =
            typeof chrome !== "undefined" && chrome.runtime?.getURL
              ? chrome.runtime.getURL("")
              : null;
          const [vocabRes, statsRes] = await Promise.all([
            fetch(base + "data/tokenizer-vocab.json"),
            fetch(base + "data/char-stats.json"),
          ]);
          if (!vocabRes.ok || !statsRes.ok) throw new Error("asset http " + vocabRes.status);
          const vocabDoc = await vocabRes.json();
          const statsDoc = await statsRes.json();
          this.setData(vocabDoc, statsDoc);
        } catch (err) {
          // Packaged data unavailable → stay in pure-heuristic mode.
          console.warn("[Nexus] tokenizer data unavailable, using heuristic:", err.message);
          this._mode = "heuristic";
        }
        return this._mode;
      })();
      return this._loading;
    },

    /** Inject parsed data (used by load() and by unit tests). */
    setData(vocabDoc, statsDoc) {
      if (vocabDoc && vocabDoc.vocab) {
        this._vocab = new Map(Object.entries(vocabDoc.vocab));
        this._maxTokenLen = Math.max(
          0,
          ...Array.from(this._vocab.keys(), (k) => k.length)
        );
      }
      if (statsDoc && statsDoc.stats) {
        this._charCost = new Map(Object.entries(statsDoc.stats));
        this._charDefault = typeof statsDoc.default === "number" ? statsDoc.default : 0.35;
      }
      this._mode = this._vocab ? "vocab" : this._charCost ? "stats" : "heuristic";
    },

    get mode() { return this._mode; },

    /* ---- public API ----------------------------------------------------- */

    /**
     * Count tokens in `text`. Returns an integer >= 0. Never throws, never
     * touches the network, never imports remote code.
     */
    async count(text) {
      if (!text) return 0;
      if (this._mode === "unloaded") await this.load();
      return this.countSync(text);
    },

    /** Synchronous variant for when data is already loaded (or heuristic). */
    countSync(text) {
      if (!text) return 0;
      if (this._vocab) return this._greedyVocab(text);
      if (this._charCost) return this._costTable(text);
      return this._heuristic(text);
    },

    /* ---- strategy 2a: longest-match greedy over packaged vocab ---------- */
    _greedyVocab(text) {
      let count = 0;
      let i = 0;
      const n = text.length;
      while (i < n) {
        let matched = false;
        const limit = Math.min(this._maxTokenLen, n - i);
        for (let len = limit; len >= 1; len--) {
          if (this._vocab.has(text.substr(i, len))) {
            i += len;
            count += 1;
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Unknown run: accumulate cost until the next matchable boundary.
          count += this._costChar(text[i]);
          i += 1;
        }
      }
      return Math.max(1, Math.round(count));
    },

    /* ---- strategy 2b: calibrated per-character cost table --------------- */
    _costTable(text) {
      let total = 0;
      for (const ch of text) total += this._costChar(ch);
      return Math.max(1, Math.round(total));
    },

    _costChar(ch) {
      if (this._charCost) {
        const c = this._charCost.get(ch);
        if (c != null) return c;
        if (CJK_RE.test(ch)) return 1.0; // unseen CJK ≈ 1 token/char
        return this._charDefault;
      }
      return this._charDefault;
    },

    /* ---- strategy 3: dependency-free last resort ------------------------ */
    _heuristic(text) {
      let tokens = 0;
      // Latin words: ceil(len/4) BPE-ish tokens each.
      for (const m of text.matchAll(/[A-Za-z']+/g)) {
        tokens += Math.max(1, Math.ceil(m[0].length / 4));
      }
      // Digit runs: one token per 3 digits.
      for (const m of text.matchAll(/\d+/g)) {
        tokens += Math.max(1, Math.ceil(m[0].length / 3));
      }
      // CJK ideographs & full-width punctuation: ~1 token each.
      for (const ch of text) {
        if (CJK_RE.test(ch)) tokens += 1;
      }
      // Remaining symbols/punctuation: ~0.8 token each.
      const other = text
        .replace(/[A-Za-z'0-9]|\s/g, "")
        .replace(/[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/g, "");
      tokens += Math.floor(other.length * 0.8);
      return Math.max(1, Math.round(tokens));
    },

    /**
     * Strategy 1 hook: record an authoritative usage figure reported by the
     * backend so UI layers can prefer it over estimation.
     */
    noteExactUsage(totalTokens) {
      const v = Number(totalTokens);
      if (Number.isFinite(v) && v >= 0) {
        this._lastExact = v;
        this._mode = "exact-usage";
      }
    },

    _lastExact: 0,
    get lastExactUsage() { return this._lastExact; },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.tokenizer = tokenizer;
})(typeof self !== "undefined" ? self : window);
