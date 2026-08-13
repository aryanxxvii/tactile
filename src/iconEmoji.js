const GRAPHEME_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;
const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR = /^\p{Regional_Indicator}$/u;

function graphemes(value) {
  if (GRAPHEME_SEGMENTER) return [...GRAPHEME_SEGMENTER.segment(value)].map(({ segment }) => segment);
  return Array.from(value);
}

export function isEmojiGrapheme(value) {
  const grapheme = String(value || "");
  if (!grapheme) return false;

  // Variation selectors and keycap marks turn otherwise text-presenting
  // symbols into emoji, while the Unicode pictographic properties cover
  // emoji presentation characters, ZWJ sequences, skin tones, and flags.
  if (/\uFE0F|\u20E3/u.test(grapheme)) return true;
  if (EMOJI_PRESENTATION.test(grapheme) || EXTENDED_PICTOGRAPHIC.test(grapheme)) return true;

  const codePoints = [...grapheme];
  return codePoints.length === 2 && codePoints.every((codePoint) => REGIONAL_INDICATOR.test(codePoint));
}

export function normalizeIconEmoji(value) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  return graphemes(input).find(isEmojiGrapheme) || "";
}
