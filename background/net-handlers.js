/* ==========================================================================
 * src/background/net-handlers.js — service-worker side of the network layer.
 * Executed via importScripts() from background.js (MV3 classic worker).
 * Depends on: Nexus.CONST, Nexus.util, Nexus.api (imported first).
 *
 * All remote HTTP for GitHub / Hugging Face happens HERE, using account
 * tokens from chrome.storage.session. Content scripts and popups only ever
 * send request *plans* over chrome.runtime messaging. Benefits:
 *   • No CSP constraints (workers aren't document pages).
 *   • Auth headers attach to exactly the two allowed API origins — a token
 *     can never leak to another domain (audit item #10: v11.x forwarded
 *     arbitrary URLs from content scripts with arbitrary headers).
 *   • Single place for timeouts, status mapping, and rate-limit errors.
 * ========================================================================== */

(function () {
  "use strict";

  const ALLOWED_ORIGINS = [
    "https://api.github.com/",
    "https://huggingface.co/",
  ];

  function isAllowedUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && ALLOWED_ORIGINS.some((p) => u.origin + "/" === p || url.startsWith(p));
    } catch {
      return false;
    }
  }

  async function httpGet(request) {
    // `request` = {url, method?, headers?} produced by Nexus.api planners.
    if (!isAllowedUrl(request.url)) {
      throw new Error("Blocked: request target is not an approved API origin.");
    }
    const res = await Nexus.util.withTimeout(
      fetch(request.url, {
        method: request.method || "GET",
        headers: request.headers || {},
        credentials: "omit", // never attach browser cookies to third-party APIs
        redirect: "follow",
      }),
      Nexus.CONST.DEFAULTS.FETCH_TIMEOUT_MS,
      request.url
    );
    if (res.status === 401) throw new Error("Unauthorized — check your account token (401).");
    if (res.status === 403) throw new Error("Forbidden or rate-limited by the API (403).");
    if (res.status === 404) throw new Error("Not found (404).");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  /* ---- plan executors ---------------------------------------------------- */

  async function runGithubReadme(plan) {
    const A = Nexus.api;
    let branch = null;
    try {
      const metaText = await httpGet(A.ghRepoMeta(plan.owner, plan.repo, plan.token));
      const meta = JSON.parse(metaText);
      branch = meta.default_branch || null; // authoritative — no more guessing
    } catch (err) {
      // Repo metadata failed (private + no token, renamed, or offline).
      throw new Error(err.message.includes("401") || err.message.includes("403")
        ? `GitHub access denied for ${plan.owner}/${plan.repo}: ${err.message}`
        : `Could not resolve repository ${plan.owner}/${plan.repo}: ${err.message}`);
    }

    const refs = [branch, "main", "master"].filter(Boolean);
    const tried = [];
    for (const ref of refs) {
      for (const cand of plan.candidates) {
        const key = `${ref}/${cand.path}`;
        if (tried.includes(key)) continue;
        tried.push(key);
        try {
          const text = await httpGet(A.ghFileRaw(plan.owner, plan.repo, cand.path, plan.token, ref));
          if (text && text.trim().length > 0) return text;
        } catch (_) { /* try next candidate */ }
      }
    }
    throw new Error(`No README found in ${plan.owner}/${plan.repo}.`);
  }

  async function runHfReadme(plan) {
    const A = Nexus.api;
    let revision = "main";
    try {
      const metaText = await httpGet(A.hfModelMeta(plan.id, plan.token, plan.type));
      const meta = JSON.parse(metaText);
      if (meta.sha) revision = "main"; // metadata OK; raw endpoint accepts main/revision tags
      if (typeof meta.cardSha === "string" && meta.cardSha) revision = "main";
    } catch (err) {
      if (/40[13]/.test(err.message)) {
        throw new Error(`Hugging Face access denied for ${plan.id} (gated repo?). ${err.message}`);
      }
      // Metadata unavailable — still try the raw endpoint below.
    }
    try {
      const text = await httpGet(A.hfReadmeRaw(plan.id, plan.token, revision));
      if (text && text.trim().length > 0) return text;
    } catch (err) {
      throw new Error(`Could not fetch model card for ${plan.id}: ${err.message}`);
    }
    throw new Error(`README.md is empty for ${plan.id}.`);
  }

  /* ---- message router ----------------------------------------------------- */

  self.__dsnxNetRouter = function handleNetMessage(message) {
    // Returns a promise resolving to {ok, data|error}; caller wraps sendResponse.
    const C = Nexus.CONST;
    const payload = message.payload || {};

    if (message.type === C.MSG.NET_API) {
      if (payload.kind === "github-readme") return runGithubReadme(payload).then((data) => ({ ok: true, data }));
      if (payload.kind === "hf-readme") return runHfReadme(payload).then((data) => ({ ok: true, data }));
      // Plain planned request (already validated inside httpGet).
      if (payload.url) return httpGet(payload).then((data) => ({ ok: true, data }));
      return Promise.resolve({ ok: false, error: "Unrecognized network request." });
    }
    return null; // not handled here
  };
})();
