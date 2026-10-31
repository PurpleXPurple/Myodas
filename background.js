chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "fetch") {
    fetch(request.url, { headers: request.headers || {} })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      })
      .then((text) => sendResponse({ ok: true, data: text }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (request.type === "fetchHFReadme") {
    (async () => {
      const id = request.repoId;
      const token = request.token;
      let branch = 'main';
      try {
        const apiRes = await fetch(`https://huggingface.co/api/models/${id}`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data.default_branch) branch = data.default_branch;
        }
      } catch (_) {}
      const candidates = [
        `https://huggingface.co/${id}/resolve/${branch}/README.md`,
        `https://huggingface.co/${id}/resolve/main/README.md`,
        `https://huggingface.co/${id}/resolve/master/README.md`
      ];
      for (const url of candidates) {
        try {
          const res = await fetch(url, { headers: token ? { "Authorization": `Bearer ${token}` } : {} });
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 0) return sendResponse({ ok: true, data: text });
          }
        } catch (_) {}
      }
      sendResponse({ ok: false, error: "Could not find README.md." });
    })();
    return true;
  }
});