/* ==========================================================================
 * src/shared/api-client.js — the ONLY place remote HTTP is described.
 * Namespace: Nexus.api
 *
 * WHY (user requirement): "fetch data off Hugging Face and GitHub through
 * Account tokens instead of browser stuff".
 *   • v11.x scraped raw.githubusercontent.com / resolve URLs with guessed
 *     branch names, relied on the page's own `localStorage.userToken`
 *     (DeepSeek session cookie-style secret read from the DOM world!), and
 *     had no auth for private GitHub repos or gated HF models.
 *   • v12.x talks to the official REST APIs (api.github.com, huggingface.co/
 *     api) using user-supplied account tokens stored in chrome.storage.
 *     Requests are executed by the service worker (see background/net-handlers
 *     .js) so content-script CSP/CORS never applies; this module just builds
 *     request descriptors and wraps the message round-trip.
 *
 * This file is context-agnostic: it exports pure functions that return
 * {url, method, headers} plans; execution happens in the worker.
 * ========================================================================== */
(function (global) {
  "use strict";

  const GITHUB_README_CANDIDATES = [
    // (path, mediaType) tried in order via the contents API
    ["README.md", "application/vnd.github.raw+json"],
    ["readme.md", "application/vnd.github.raw+json"],
    ["Readme.md", "application/vnd.github.raw+json"],
    ".github/README.md",
  ];

  const api = {
    /* ---- request planners (pure; unit-testable without chrome) ---------- */

    githubAuthHeaders(token) {
      const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
      if (token) h.Authorization = `Bearer ${token}`; // fine-grained PATs use Bearer
      return h;
    },

    hfAuthHeaders(token) {
      const h = {};
      if (token) h.Authorization = `Bearer ${token}`; // HF access tokens use Bearer
      return h;
    },

    /** Resolve repo metadata (default branch etc.). GET /repos/{owner}/{repo} */
    ghRepoMeta(owner, repo, token) {
      return {
        url: `${global.Nexus.CONST.API.GITHUB_REST}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        method: "GET",
        headers: this.githubAuthHeaders(token),
      };
    },

    /** Fetch one file's raw bytes from a repo at a (optional) ref. */
    ghFileRaw(owner, repo, path, token, ref) {
      const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      return {
        url: `${global.Nexus.CONST.API.GITHUB_REST}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}${q}`,
        method: "GET",
        headers: { ...this.githubAuthHeaders(token), Accept: "application/vnd.github.raw+json" },
      };
    },

    /** Plan a README fetch: repo meta for default_branch, then candidate paths. */
    ghReadmePlan(owner, repo, token) {
      return {
        kind: "github-readme",
        owner,
        repo,
        token: token || null,
        candidates: GITHUB_README_CANDIDATES.filter((c) => typeof c === "string" || Array.isArray(c))
          .map((c) => (Array.isArray(c) ? { path: c[0], accept: c[1] } : { path: c, accept: "application/vnd.github.raw+json" })),
      };
    },

    /** HF model/dataset metadata. GET /api/models/{id} or /api/datasets/{id}. */
    hfModelMeta(id, token, type = "models") {
      return {
        url: `${global.Nexus.CONST.API.HF_API}/${type}/${encodeURIComponent(id)}`,
        method: "GET",
        headers: this.hfAuthHeaders(token),
      };
    },

    /** HF model card raw file. GET /api/models/{id}/raw/main/README.md */
    hfReadmeRaw(id, token, revision = "main") {
      return {
        url: `${global.Nexus.CONST.API.HF_API}/models/${encodeURIComponent(id)}/raw/${encodeURIComponent(revision)}/README.md`,
        method: "GET",
        headers: this.hfAuthHeaders(token),
      };
    },

    /** Plan an HF README fetch (metadata → default revision → raw card). */
    hfReadmePlan(id, token, type = "models") {
      return { kind: "hf-readme", id, type, token: token || null };
    },

    /* ---- execution wrappers (need chrome.runtime messaging) -------------- */

    /** Send a planned request to the service worker and await its result. */
    async execute(planOrRequest) {
      const C = global.Nexus.CONST;
      const U = global.Nexus.util;
      if (!global.chrome?.runtime?.id) throw new Error("Extension context invalidated.");
      const resp = await U.withTimeout(
        chrome.runtime.sendMessage({ type: C.MSG.NET_API, payload: planOrRequest }),
        C.DEFAULTS.FETCH_TIMEOUT_MS + 5000,
        "net dispatch"
      );
      if (!resp) throw new Error("No response from background worker.");
      if (!resp.ok) throw new Error(resp.error || "Network error.");
      return resp.data; // string body
    },

    /** Convenience: full GitHub README fetch (meta + candidates handled in SW). */
    async fetchGithubReadme(ownerRepoPair, token) {
      const plan = this.ghReadmePlan(...ownerRepoPair, token);
      return this.execute(plan);
    },

    /** Convenience: full HF README fetch. */
    async fetchHfReadme(id, token, type = "models") {
      return this.execute(this.hfReadmePlan(id, token, type));
    },

    /** Parse a GitHub URL or "owner/repo" shorthand into [owner, repo]. */
    parseGithub(input) {
      if (!input) return null;
      const s = input.trim();
      let m = s.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
      if (m) return [m[1], m[2].replace(/\.git$/i, "")];
      m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
      return m ? [m[1], m[2]] : null;
    },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.api = api;
})(typeof self !== "undefined" ? self : window);
