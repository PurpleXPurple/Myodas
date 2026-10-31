/* ==========================================================================
 * src/background/service-worker.js — MV3 entry point (thin by design).
 *
 * v11.x's background.js was a single anonymous listener that:
 *   • proxied arbitrary URLs/headers from any content script (SSRF-ish risk),
 *   • hard-coded the whole HF README flow inline,
 *   • used the callback-style sendResponse without error isolation.
 * v12.x keeps only wiring here; logic lives in the imported modules.
 * ========================================================================== */

importScripts(
  "../shared/constants.js",
  "../shared/util.js",
  "../shared/api-client.js",
  "net-handlers.js",
  "state-handlers.js"
);

const C = Nexus.CONST;

/* Make session storage usable from extension contexts (default is
 * "trusted" which already covers popup + SW; set explicitly for clarity). */
try {
  chrome.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
} catch (_) { /* older Chrome: default already fine */ }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ---- network plans -----------------------------------------------------
  if (message && message.type === C.MSG.NET_API) {
    Promise.resolve()
      .then(() => self.__dsnxNetRouter(message))
      .then((result) => sendResponse(result || { ok: false, error: "Unhandled." }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true; // keep the message channel open for the async reply
  }

  // ---- live-tab state snapshots ------------------------------------------
  if (message && message.type === C.MSG.STATE_SNAPSHOT) {
    const tabId = sender?.tab?.id;
    if (message.action === "get") {
      // Popup asking for the freshest snapshot of its (or any) chat tab.
      const snap = self.__dsnxStateHandlers.latest(tabId);
      sendResponse({ ok: true, data: snap });
      return false;
    }
    if (typeof tabId === "number") self.__dsnxStateHandlers.put(tabId, message.payload);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

/* Clean up snapshots when tabs close so the Map can't grow unbounded. */
chrome.tabs?.onRemoved?.addListener((tabId) => self.__dsnxStateHandlers.dropTab(tabId));
