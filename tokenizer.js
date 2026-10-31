let encoder = null;
let isReady = false;

async function loadTokenizer() {
  if (isReady) return;
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@lenml/tokenizer-deepseek_v3@3.7.2/dist/index.mjs');
    encoder = await module.fromPreTrained();
    isReady = true;
    console.log("[Nexus] DeepSeek tokenizer loaded successfully.");
  } catch (err) {
    console.warn("[Nexus] Failed to load DeepSeek tokenizer. Falling back to estimation.", err);
  }
}

async function countTokens(text) {
  if (!text) return 0;
  if (!isReady) await loadTokenizer();
  if (encoder) {
    try {
      const encoded = encoder.encode(text);
      return encoded.length;
    } catch (e) {
      console.warn("[Nexus] Tokenizer encode error, using estimation.", e);
    }
  }
  let count = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) count += 0.6;
    else count += 0.3;
  }
  return Math.ceil(count);
}

window.dsnxCountTokens = countTokens;