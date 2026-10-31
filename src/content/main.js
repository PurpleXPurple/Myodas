/* ==========================================================================
 * src/content/main.js — content-script entry point (wiring only).
 * Loaded by the manifest AFTER the shared modules and sibling modules:
 *   constants → util → storage → tokenizer → theme-engine → api-client
 *   → composer → slash → tokens → panel → main
 *
 * Responsibilities left here after the refactor:
 *   • inject the page-world fetch interceptor,
 *   • mount the toolbar button + keyboard shortcuts,
 *   • arm/disarm prompt injection on send,
 *   • observe DOM changes with a throttled MutationObserver (v11.x re-ran
 *     full injection work on every mutation — audit item #5),
 *   • route window messages from the interceptor into Nexus.tokens.
 * ========================================================================== */
(function (global) {
  "use strict";

  const Nexus = () => global.Nexus;

  let chatSignature = location.pathname;

  /* ---- injection ---------------------------------------------------------- */

  function injectInterceptor() {
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("src/content/interceptor.js");
      script.onload = () => script.remove();
      script.onerror = () => {
        script.remove(); // CSP blocked us; degrade silently (no console spam).
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (_) { /* never fatal */ }
  }

  function ensureButton() {
    const N = Nexus();
    const comp = N.composer;
    const target = comp.find();
    if (!target) return;

    if (!target.dataset.dsnxHooked) {
      target.dataset.dsnxHooked = "1";
      target.addEventListener("input", () => {
        N.slash.onInput();
        scheduleTokenRefresh();
      });
      target.addEventListener("keydown", handleKeyDown, true);
    }

    if (document.getElementById("dsnx-button")) return;
    const toolbar =
      target.closest("form") ||
      (target.parentElement && (target.parentElement.parentElement || target.parentElement));
    if (!toolbar) return;

    const btn = document.createElement("button");
    btn.id = "dsnx-button";
    btn.type = "button";
    btn.title = "Prompt Nexus (Ctrl+Shift+P)";
    btn.className = "dsnx-launch-btn";
    btn.appendChild(N.content.svgIcon("logo", 20));
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      N.panel.toggle();
    };

    const anchor = toolbar.querySelector("button[aria-label*='upload' i], button[aria-label*='attach' i]");
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(btn, anchor.nextSibling);
    else toolbar.appendChild(btn);
  }

  /* ---- armed prompt sending ------------------------------------------------ */

  async function handleSend(event) {
    const N = Nexus();
    const armed = await N.store.getArmed();
    if (!armed) return;
    const visible = N.composer.text().trim();
    if (!visible) return;

    const combined = `${(armed.text || "").trim()}\n\n---\n\n${visible}`;
    if (combined.length > N.CONST.DEFAULTS.MAX_ARMED_CHARS) {
      if (event) { event.preventDefault(); event.stopImmediatePropagation(); }
      N.panel.toast(`Payload exceeds ${N.CONST.DEFAULTS.MAX_ARMED_CHARS} characters — send aborted.`, "warn");
      return;
    }
    if (event) { event.preventDefault(); event.stopImmediatePropagation(); }
    await N.store.clearArmed();
    N.composer.setText(combined);
    setTimeout(() => N.composer.send(), 150);
  }

  /* ---- keyboard ------------------------------------------------------------- */

  function handleKeyDown(e) {
    const N = Nexus();
    try {
      if (N.slash.handleKey(e)) return; // menu consumed it

      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        N.panel.toggle(true);
        return;
      }

      // Enter (no shift) while a prompt is armed → merge & send.
      if (e.key === "Enter" && !e.shiftKey && document.activeElement === N.composer.el) {
        N.store.getArmed().then((armed) => {
          if (armed) handleSend(e);
        });
      }
    } catch (_) { /* keys must never throw */ }
  }

  /* ---- token refresh scheduling -------------------------------------------- */

  let lastTokenRun = 0;
  let tokenTimer = null;
  function scheduleTokenRefresh(delay) {
    const now = Date.now();
    const wait = delay != null ? delay : Math.max(0, 1500 - (now - lastTokenRun));
    clearTimeout(tokenTimer);
    tokenTimer = setTimeout(() => {
      lastTokenRun = Date.now();
      Nexus().tokens.refresh().catch(() => {});
    }, wait);
  }

  /* ---- observers -------------------------------------------------------------- */

  function startObservers() {
    const N = Nexus();

    // Throttled mutation observer: coalesce bursts into one pass per frame.
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        ensureButton();
        if (location.pathname !== chatSignature) {
          chatSignature = location.pathname;
          N.tokens.onChatChange();
          scheduleTokenRefresh(400);
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Exact usage events from the page-world interceptor.
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const d = event.data;
      if (d && d.type === Nexus().CONST.PAGE.USAGE) {
        N.tokens.noteUsage(d.total_tokens);
        scheduleTokenRefresh(200);
      }
    });
  }

  /* ---- boot --------------------------------------------------------------------- */

  async function boot() {
    const N = Nexus();
    N.theme.watch();
    await N.theme.load().catch(() => N.theme.apply(null));
    N.tokenizer.load().catch(() => {}); // warm up offline data (non-blocking)
    N.slash.setSkills(await N.store.list("skills").catch(() => []));
    injectInterceptor();
    ensureButton();
    startObservers();
    scheduleTokenRefresh(1200);

    // Live-refresh lists when popup edits storage.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const K = N.CONST.KEYS;
      if (changes[K.SKILLS]) N.slash.setSkills(changes[K.SKILLS].newValue || []);
      if (changes[K.PROMPTS] || changes[K.SKILLS] || changes[K.ARMED]) {
        if (N.panel.isOpen()) N.panel.renderList(N.panel.tab);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch(() => {}));
  } else {
    boot().catch(() => {});
  }
})(typeof self !== "undefined" ? self : window);
