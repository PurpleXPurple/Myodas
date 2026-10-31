/* ==========================================================================
 * src/shared/storage.js — typed chrome.storage access layer.
 * Namespace: Nexus.store
 *
 * Replaces the scattered `chrome.storage.local.get(...)` calls of v11.x with
 * one module that knows every key, its shape, and its area:
 *   • .local  → user data (prompts, skills, theme, token ledger, settings)
 *   • .session→ secrets (GitHub / Hugging Face account tokens). Session
 *     storage is memory-backed, cleared on browser restart, and — crucially —
 *     NOT readable by other extensions or the page. (v11.x already kept the
 *     HF token in local storage; audit item #12 called this out.)
 * ========================================================================== */
(function (global) {
  "use strict";

  const store = {
    /* ---- generic helpers ------------------------------------------------ */
    async getLocal(key) {
      const res = await chrome.storage.local.get(key);
      return res[key];
    },
    async setLocal(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async removeLocal(key) {
      await chrome.storage.local.remove(key);
    },

    /* ---- tokens (session area) ------------------------------------------ */
    async getToken(which) {
      // which: "gh" | "hf"
      const K = global.Nexus.CONST.KEYS;
      const key = which === "gh" ? K.GH_TOKEN : K.HF_TOKEN;
      const res = await chrome.storage.session.get(key);
      return res[key] || null;
    },
    async setToken(which, value) {
      const K = global.Nexus.CONST.KEYS;
      const key = which === "gh" ? K.GH_TOKEN : K.HF_TOKEN;
      const trimmed = (value || "").trim();
      if (trimmed) await chrome.storage.session.set({ [key]: trimmed });
      else await chrome.storage.session.remove(key);
    },

    /* ---- collections ----------------------------------------------------- */
    async list(kind) {
      // kind: "prompts" | "skills"
      const K = global.Nexus.CONST.KEYS;
      const key = kind === "skills" ? K.SKILLS : K.PROMPTS;
      const items = (await this.getLocal(key)) || [];
      return Array.isArray(items) ? items : [];
    },
    async save(kind, items) {
      const K = global.Nexus.CONST.KEYS;
      const key = kind === "skills" ? K.SKILLS : K.PROMPTS;
      await this.setLocal(key, Array.isArray(items) ? items : []);
    },
    async add(kind, item) {
      const U = global.Nexus.util;
      const items = await this.list(kind);
      const entry = { id: U.uid(), created: Date.now(), ...item };
      items.unshift(entry);
      await this.save(kind, items);
      return entry;
    },
    async remove(kind, id) {
      const K = global.Nexus.CONST.KEYS;
      const items = (await this.list(kind)).filter((i) => i.id !== id);
      await this.save(kind, items);
      const armed = await this.getArmed();
      if (armed && armed.id === id) await this.clearArmed();
      return items;
    },

    /* ---- armed prompt/skill ------------------------------------------------ */
    async getArmed() {
      return this.getLocal(global.Nexus.CONST.KEYS.ARMED);
    },
    async setArmed(item) {
      await this.setLocal(global.Nexus.CONST.KEYS.ARMED, item);
    },
    async clearArmed() {
      await this.removeLocal(global.Nexus.CONST.KEYS.ARMED);
    },

    /* ---- token ledger ------------------------------------------------------ */
    async getLedger() {
      const K = global.Nexus.CONST.KEYS;
      const led = (await this.getLocal(K.TOKEN_STATS)) || { totalTokens: 0, sessions: {} };
      if (typeof led.totalTokens !== "number") led.totalTokens = 0;
      if (!led.sessions || typeof led.sessions !== "object") led.sessions = {};
      return led;
    },
    async recordSession(chatKey, tokens) {
      const led = await this.getLedger();
      if (!(chatKey in led.sessions)) {
        led.sessions[chatKey] = tokens;
        led.totalTokens += tokens;
      } else if (tokens > led.sessions[chatKey]) {
        // Chats grow between refreshes: keep the max ever observed.
        led.totalTokens += tokens - led.sessions[chatKey];
        led.sessions[chatKey] = tokens;
      }
      await this.setLocal(global.Nexus.CONST.KEYS.TOKEN_STATS, led);
      return led;
    },

    /* ---- backup / restore --------------------------------------------------- */
    async exportBackup() {
      const K = global.Nexus.CONST.KEYS;
      const res = await chrome.storage.local.get([K.PROMPTS, K.SKILLS, K.THEME, K.SETTINGS]);
      return { format: "dsnx-backup", version: 2, exportedAt: new Date().toISOString(), data: res };
    },
    async importBackup(doc) {
      const K = global.Nexus.CONST.KEYS;
      if (!doc || doc.format !== "dsnx-backup" || !doc.data) throw new Error("Not a Nexus backup file.");
      const allowed = [K.PROMPTS, K.SKILLS, K.THEME, K.SETTINGS];
      const clean = {};
      for (const key of allowed) if (key in doc.data) clean[key] = doc.data[key];
      await chrome.storage.local.set(clean);
      return Object.keys(clean);
    },
  };

  global.Nexus = global.Nexus || {};
  global.Nexus.store = store;
})(typeof self !== "undefined" ? self : window);
