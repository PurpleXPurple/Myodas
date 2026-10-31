(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    
    if (url && (url.includes('/chat/completions') || url.includes('/chat/'))) {
      const clone = response.clone();
      clone.json().then(data => {
        if (data && data.usage && data.usage.total_tokens) {
          window.postMessage({ type: 'DSNX_USAGE', total_tokens: data.usage.total_tokens }, '*');
        }
      }).catch(() => {});
    }
    return response;
  };
})();