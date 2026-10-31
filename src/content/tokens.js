/* ==========================================================================
 * src/content/tokens.js — token accounting for the current chat.
 * Namespace: Nexus.tokens
 *
 * Combines the three counting strategies (see shared/tokenizer.js header):
 *   exact backend usage  >  offline vocab estimator  >  pure heuristic.
 * Maintains a per-chat ledger in storage keyed by a stable hash of the first
 * messages, and broadcasts snapshots to the background worker so the popup
 * can display live numbers (fixes audit item #14).
 *
 * REMOVED: v11.x's fetchTotalSessionCount() called DeepSeek's internal
 * /chat_session/fetch_page endpoint using localStorage.userToken — reading a
 * site session secret out of page storage is exactly the "browser stuff" the
 * user asked us to stop doing. Session totals now come from our own ledger.
 * ========================================================================== */
(function (global) {
  "use strict";

  const tokens = {
    lastExact: 0,        // most recent authoritative usage.total_tokens
    lastComputed: 0,     // last displayed value
    lastSource: "none",  // "exact" | "estimate" | "heuristic" | "none"

    /** Collect visible conversation text (excluding composer/inputs). */
    collectChatText() {
      const qa = (sel) => Array.from(document.querySelectorAll(sel));
      let text = "";
      for (const node of qa("div[data-um-id], div.ds-markdown, .ds-message-content")) {
        if (node.closest("form") || node.closest('[contenteditable="true"]')) continue;
        text += (node.innerText || "") + "\n";
      }
      return text.trim();
    },

    /** Stable identity for the currently open chat (URL id, else content hash). */
    chatKey(text) {
      const U = global.Nexus.util;
      const m = location.pathname.match(/\/a\/chat\/s\/([\w-]+)/);
      if (m) return "url:" + m[1];
      return "hash:" + U.hash((text || "").slice(0, 200));
    },

    /** Recompute counts, update the ledger + UI, notify the worker. */
    async refresh() {
      const Nexus = global.Nexus;
      const text = this.collectChatText();
      let count = 0;
      let source = "none";
      if (text) {
        if (this.lastExact > 0) {
          count = this.lastExact;
          source = "exact";
        } else {
          count = await Nexus.tokenizer.count(text);
          source = Nexus.tokenizer.mode === "heuristic" ? "heuristic" : "estimate";
        }
      }
      this.lastComputed = count;
      this.lastSource = source;

      // Ledger bookkeeping (per-chat max-ever observed).
      let ledger = null;
      try {
        ledger = await Nexus.store.recordSession(this.chatKey(text), count);
      } catch (_) { /* storage unavailable; keep going with UI-only update */ }

      // Push live snapshot to the service worker for the popup.
      try {
        chrome.runtime.sendMessage({
          type: Nexus.CONST.MSG.STATE_SNAPSHOT,
          payload: {
            url: location.href,
            current: count,
            exact: this.lastExact,
            source,
            messages: document.querySelectorAll("div[data-um-id], div.ds-markdown").length,
            totalTokens: ledger ? ledger.totalTokens : undefined,
            chatsTracked: ledger ? Object.keys(ledger.sessions).length : undefined,
          },
        });
      } catch (_) { /* context invalidated mid-navigation; ignore */ }

      if (Nexus.panel && Nexus.panel.updateTokens) Nexus.panel.updateTokens(this);
      return { count, source, ledger };
    },

    /** Called when the page-world interceptor reports real usage. */
    noteUsage(totalTokens) {
      const v = Number(totalTokens);
      if (Number.isFinite(v) && v >= 0) {
        this.lastExact = Math.max(this.lastExact, v); // monotonic within a chat
        global.Nexus.tokenizer.noteExactUsage(this.lastExact);
      }
    },

    /** Reset per-chat state when navigating between conversations. */
    onChatChange() {
      this.lastExact = 0;
      global.Nexus.tokenizer._lastExact = 0;
      global.Nexus.tokenizer._mode = global.Nexus.tokenizer._vocab ? "vocab" : global.Nexus.tokenizer._mode;
    },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.tokens = tokens;
})(typeof self !== "undefined" ? self : window);
