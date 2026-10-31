/* ==========================================================================
 * src/shared/constants.js — single source of truth for storage keys, API
 * endpoints and tunables. Loaded as a classic script before every module
 * that uses it (content scripts, popup, service worker importScripts).
 * Namespace: Nexus.CONST
 * ========================================================================== */
(function (global) {
  "use strict";

  const PREFIX = "dsnx_";

  const CONST = {
    /* Extension-wide namespace used on injected DOM nodes (data-* attrs). */
    NS: "dsnx",

    /* ---- chrome.storage.local keys ---------------------------------- */
    KEYS: {
      ARMED: PREFIX + "armed",            // prompt/skill queued for next send
      PROMPTS: PREFIX + "prompts",        // saved prompts   [{id,name,text}]
      SKILLS: PREFIX + "skills",          // saved skills    [{id,name,description,icon,text}]
      THEME: PREFIX + "theme",            // active theme object (or null)
      TOKEN_STATS: PREFIX + "token_stats",// global token ledger
      SETTINGS: PREFIX + "settings",      // misc user settings (context limit…)
      /* Tokens are stored in chrome.storage.session only (never .local), so
       * they live in memory and are cleared when the browser restarts. */
      GH_TOKEN: PREFIX + "gh_token",
      HF_TOKEN: PREFIX + "hf_token",
    },

    /* ---- runtime message types (chrome.runtime.sendMessage) ---------- */
    MSG: {
      NET_API: "dsnx:net:api",   // generic GitHub/HF REST fetch (auth-aware)
      NET_FILE: "dsnx:net:file", // README / raw-file fetch with fallbacks
      STATE_SNAPSHOT: "dsnx:state:snapshot",
    },

    /* ---- external (page → content) postMessage types ----------------- */
    PAGE: {
      USAGE: PREFIX + "usage", // emitted by page-world interceptor.js
    },

    /* ---- API endpoints -------------------------------------------------- */
    API: {
      GITHUB_REST: "https://api.github.com",
      GITHUB_RAW: "https://raw.githubusercontent.com",
      HF: "https://huggingface.co",
      HF_API: "https://huggingface.co/api",
    },

    /* ---- defaults & limits --------------------------------------------- */
    DEFAULTS: {
      CONTEXT_LIMIT: 128000,   // DeepSeek-V3 context window (tokens)
      MAX_ARMED_CHARS: 8000,   // refuse to auto-inject gigantic payloads
      FETCH_TIMEOUT_MS: 15000,
      SLASH_DEBOUNCE_MS: 60,
    },

    /* Theme field → CSS custom property mapping (consumed by theme-engine). */
    THEME_VARS: {
      bg: "--dsnx-bg-base",
      surface: "--dsnx-bg-card",
      text: "--dsnx-text-primary",
      accent: "--dsnx-accent",
    },

    DEFAULT_THEME: {
      bg: "#0a0a0a",
      surface: "#141414",
      text: "#ffffff",
      accent: "#4d7cfe",
    },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.CONST = CONST;
})(typeof self !== "undefined" ? self : window);
