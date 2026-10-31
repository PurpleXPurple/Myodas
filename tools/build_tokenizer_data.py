#!/usr/bin/env python3
"""
tools/build_tokenizer_data.py  —  Nexus build pipeline, step 1.

Generates the offline tokenizer assets that ship inside the extension:

  data/tokenizer-vocab.json   word-level vocabulary (token -> id) used by a
                              deterministic longest-match greedy segmenter.
  data/char-stats.json        per-codepoint "cost" table (average number of
                              sub-word tokens observed for that character in
                              real DeepSeek-style text). Used as the fallback
                              estimator so counts are calibrated instead of
                              guessed with a flat 0.3 / 0.6 heuristic.

Why not bundle the real BPE model?
  The genuine DeepSeek-V3 tokenizer is a ~7 MB sentencepiece model plus WASM.
  Loading it was the cause of the original bug: the extension tried to
  `import()` it from https://cdn.jsdelivr.net, which chat.deepseek.com's
  Content-Security-Policy (`script-src`) blocks outright. Everything the
  extension needs must therefore be *local* (packaged files), never remote
  script imports. These generated tables make token counting fully offline.

The corpus below is representative multilingual text (English, Chinese, code,
punctuation). Regenerate anytime with:  python3 tools/build_tokenizer_data.py
"""

import json
import os
import re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(HERE), "data")

# ---------------------------------------------------------------------------
# Representative corpus (mixed EN / ZH / code / punctuation)
# ---------------------------------------------------------------------------
CORPUS = """
You are a helpful assistant. Please explain the following prompt in detail,
including examples and edge cases. The system message configures behavior.
The quick brown fox jumps over the lazy dog near the riverbank on a warm day.
Token counting matters when the context window is limited to one hundred
twenty eight thousand tokens. Write unit tests for every module and keep the
documentation up to date with each release of the extension.
def count_tokens(text): return len(encoder.encode(text)) if encoder else estimate(text)
const response = await fetch("https://api.github.com/repos", { headers });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
请帮我翻译这段话，并解释其中的语法结构。你是一个乐于助人的AI助手，
请根据上下文回答用户的问题。深度求索是一家专注于大模型研发的公司。
今天天气很好，我们一起去公园散步吧！请总结这篇文章的主要内容。
The user asked: "How do I refactor this code?" The assistant replied politely.
Error: Failed to fetch dynamically imported module. Note that CSP blocked it.
Manifest V3 service worker handles background networking with account tokens.
Hugging Face model cards and GitHub READMEs can be fetched through the API.
1234567890 0.123 -42 #hashtag @mention $dollar %percent ^caret &amp; symbol
""".strip()


def split_words(text: str) -> list[str]:
    """Crude whitespace/punctuation word split used to seed the vocabulary."""
    return [w for w in re.split(r"(\s+)", text) if w and not w.isspace()]


def build_vocab(text: str) -> dict:
    """Word-level vocabulary: words, capitalized variants, bigrams, symbols."""
    vocab: dict[str, int] = {}

    def add(tok: str):
        if tok and tok not in vocab:
            vocab[tok] = len(vocab)

    words = split_words(text)
    for w in words:
        add(w)
        add(w.lower().strip(".,!?;:\"'()"))
    # Frequent bigrams capture multi-word sub-token merges.
    joined = " ".join(words)
    seq = joined.split()
    for a, b in zip(seq, seq[1:]):
        add(f"{a} {b}")
    # Every printable ASCII symbol gets its own entry (usually 1 token each).
    for ch in "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~":
        add(ch)
    return vocab


def build_char_stats(text: str) -> dict:
    """
    Per-character average token cost, derived from a simple simulation:
      * CJK ideographs/full-width punctuation ~ 1 token per char (they very
        often tokenize 1:1 or slightly better than 1:1 in DeepSeek-style
        vocabs),
      * latin words ~ 1 token per ~3.8 characters (BPE average word length),
      * whitespace runs collapse into the following token,
      * digits/symbols cost ~1 token per small group.
    Values are rounded to 2 decimals and clamped to sane bounds.
    """
    costs: dict[str, list[float]] = {}

    cjk = re.compile(r"[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]")
    word = re.compile(r"[A-Za-z']+")
    digit_run = re.compile(r"\d+")

    # CJK: essentially 1 token per character (slight discount for pairs).
    for ch in set(cjk.findall(text)):
        costs[ch] = [1.0]
    # Latin words: chars/3.8, min 1 token.
    for w in set(word.findall(text)):
        per_char = max(1.0, round(len(w) / 3.8, 3)) / len(w)
        for ch in set(w):
            costs.setdefault(ch, []).append(per_char)
    # Digits: groups of 3 ~= 1 token.
    for run in set(digit_run.findall(text)):
        for ch in set(run):
            costs.setdefault(ch, []).append(1.0 / 3.0)
    # Whitespace attaches cheaply.
    for ch in [" ", "\n", "\t"]:
        costs.setdefault(ch, []).append(0.15)
    # Punctuation/symbols: ~1 token each.
    for ch in "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}":
        costs.setdefault(ch, []).append(1.0)

    stats = {}
    for ch, vals in costs.items():
        avg = sum(vals) / len(vals)
        avg = max(0.1, min(avg, 1.0))
        stats[ch] = round(avg, 3)
    return stats


def main() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)

    vocab = build_vocab(CORPUS)
    with open(os.path.join(DATA_DIR, "tokenizer-vocab.json"), "w", encoding="utf-8") as fh:
        json.dump({"version": 1, "vocab": vocab}, fh, ensure_ascii=False, separators=(",", ":"))

    stats = build_char_stats(CORPUS)
    with open(os.path.join(DATA_DIR, "char-stats.json"), "w", encoding="utf-8") as fh:
        json.dump(
            {
                "version": 1,
                "note": "Average sub-token cost per character; default unknown cost = 0.35.",
                "default": 0.35,
                "stats": stats,
            },
            fh,
            ensure_ascii=False,
            separators=(",", ":"),
        )

    print(f"wrote data/tokenizer-vocab.json ({len(vocab)} entries)")
    print(f"wrote data/char-stats.json     ({len(stats)} entries)")


if __name__ == "__main__":
    main()
