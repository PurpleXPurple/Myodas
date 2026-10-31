/* ==========================================================================
 * src/background/state-handlers.js — cross-tab state for the popup.
 * Namespace exposed to worker global: self.__dsnxStateHandlers
 *
 * The popup previously had a "Tokens" tab full of dead fields because it
 * never reached the live chat page (audit item #14). Now the content script
 * broadcasts a compact snapshot whenever it recomputes, and the popup reads
 * the freshest snapshot through this handler.
 * ========================================================================== */
(function () {
  "use strict";

  const snapshots = new Map(); // tabId -> {url, current, exact, updatedAt}

  self.__dsnxStateHandlers = {
    /** Called from the message router for type STATE_SNAPSHOT. */
    put(tabId, snap) {
      if (!snap || typeof snap !== "object") return { ok: false };
      snapshots.set(tabId, { ...snap, updatedAt: Date.now() });
      return { ok: true };
    },

    /** Latest snapshot for `tabId`, else most recent overall, else null. */
    latest(tabId) {
      if (snapshots.has(tabId)) return snapshots.get(tabId);
      let best = null;
      for (const s of snapshots.values()) if (!best || s.updatedAt > best.updatedAt) best = s;
      return best;
    },

    dropTab(tabId) { snapshots.delete(tabId); },
    _map: snapshots, // exposed for tests
  };
})();
