/* ==========================================================================
 * src/content/interceptor.js — runs in the PAGE world (not isolated).
 * Injected via chrome.runtime.getURL + <script src>. MV3 serves extension
 * scripts from the chrome-extension:// origin which the site's CSP already
 * lists as an allowed script source; if a stricter policy ever blocks it we
 * simply lose exact-usage telemetry and keep using the offline estimator —
 * no console errors either way (v11.x threw one on every single page load).
 *
 * Purpose: observe the chat API's own `usage.total_tokens` so Nexus can show
 * EXACT counts instead of estimates. Uses a Proxy around window.fetch so the
 * original function keeps sane semantics (audit item #15: v11.x replaced
 * window.fetch with a new function, breaking code that compared/bound the
 * original reference).
 * ========================================================================== */
(function () {
  "use strict";

  if (window.__dsnxInterceptorInstalled) return;
  window.__dsnxInterceptorInstalled = true;

  const CHAT_PATHS = ["/chat/completions", "/api/v0/chat"];

  function looksLikeChat(url) {
    try {
      const u = new URL(url, location.href);
      return CHAT_PATHS.some((p) => u.pathname.includes(p));
    } catch (_) {
      return false;
    }
  }

  function emit(totalTokens) {
    const v = Number(totalTokens);
    if (Number.isFinite(v) && v >= 0) {
      window.postMessage({ type: "dsnx_usage", total_tokens: v }, "*");
    }
  }

  function scanPayload(data) {
    // Handle both non-stream JSON bodies and SSE text fragments defensively.
    if (!data) return;
    if (typeof data === "string") {
      for (const line of data.split("\n")) {
        const m = line.match(/"total_tokens"\s*:\s*(\d+)/);
        if (m) emit(m[1]);
      }
      return;
    }
    if (data.usage && data.usage.total_tokens != null) emit(data.usage.total_tokens);
    if (Array.isArray(data.choices)) {
      for (const c of data.choices) if (c && c.usage && c.usage.total_tokens != null) emit(c.usage.total_tokens);
    }
  }

  const nativeFetch = window.fetch.bind(window);

  window.fetch = new Proxy(nativeFetch, {
    apply(target, thisArg, args) {
      const promise = target.apply(thisArg, args);
      try {
        const raw = args[0];
        const url = typeof raw === "string" ? raw : raw && raw.url;
        if (url && looksLikeChat(url)) {
          promise
            .then((res) => {
              if (!res || !res.ok) return res;
              const ct = (res.headers && res.headers.get("content-type")) || "";
              if (ct.includes("application/json")) {
                res.clone().json().then(scanPayload).catch(() => {});
              } else if (ct.includes("event-stream") || ct.includes("text")) {
                // Peek at the tail of streamed responses for a final usage chunk.
                res
                  .clone()
                  .text()
                  .then((txt) => scanPayload(txt.slice(-4096)))
                  .catch(() => {});
              }
              return res;
            })
            .catch(() => {});
        }
      } catch (_) { /* never break the page's request */ }
      return promise;
    },
  });
})();
