// Emoji helpers for the Discord card. Satori has no emoji font, so colour emoji are
// drawn as Twemoji images: the text is split into text/emoji runs and each emoji maps to
// the file names Twemoji ships (with and without the FE0F variation selector).
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const MODIFIERS = /[\u{1F3FB}-\u{1F3FF}\u{FE0E}\u{FE0F}]/u;
const REGIONAL = /[\u{1F1E6}-\u{1F1FF}]/u;
const KEYCAP = /[\u20E3]/u;

function isEmojiStart(cp) {
  return PICTOGRAPHIC.test(cp) || REGIONAL.test(cp);
}

// Splits a string into { type: "text" | "emoji", value } runs. ZWJ sequences, skin tone
// modifiers, keycaps and flags stay as one emoji.
export function emojiRuns(value) {
  const text = String(value == null ? "" : value);
  const points = Array.from(text);
  const runs = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer) { runs.push({ type: "text", value: buffer }); buffer = ""; }
  };

  while (index < points.length) {
    const current = points[index];
    // Keycaps ("1\uFE0F\u20E3", "#\u20E3") start with an ASCII character.
    if (/[0-9#*]/.test(current)) {
      let cursor = index + 1;
      let candidate = current;
      if (points[cursor] === "\uFE0F") { candidate += points[cursor]; cursor += 1; }
      if (points[cursor] === "\u20E3") {
        candidate += points[cursor];
        flush();
        runs.push({ type: "emoji", value: candidate });
        index = cursor + 1;
        continue;
      }
    }
    if (!isEmojiStart(current)) { buffer += current; index += 1; continue; }
    let emoji = current;
    index += 1;
    // Flags: two regional indicators.
    if (REGIONAL.test(current) && index < points.length && REGIONAL.test(points[index])) {
      emoji += points[index];
      index += 1;
    }
    while (index < points.length) {
      const next = points[index];
      if (MODIFIERS.test(next) || KEYCAP.test(next)) { emoji += next; index += 1; continue; }
      if (next === "\u200D" && index + 1 < points.length) {
        emoji += next + points[index + 1];
        index += 2;
        continue;
      }
      break;
    }
    flush();
    runs.push({ type: "emoji", value: emoji });
  }
  flush();
  return runs;
}

export function hasEmoji(value) {
  return emojiRuns(value).some(run => run.type === "emoji");
}

// Twemoji file names: lowercase hex codepoints joined by "-". ZWJ sequences and flags are
// published without FE0F, single symbols are published with it, so both are tried.
export function twemojiCodes(emoji) {
  const points = Array.from(String(emoji || "")).map(char => char.codePointAt(0));
  if (!points.length) return [];
  const hex = value => value.toString(16).toLowerCase();
  const without = points.filter(point => point !== 0xfe0f);
  const withVariation = points;
  const candidates = [];
  const joined = list => list.map(hex).join("-");
  if (without.includes(0x200d) || without.some(point => point >= 0x1f1e6 && point <= 0x1f1ff)) {
    candidates.push(joined(without), joined(withVariation));
  } else {
    candidates.push(joined(withVariation), joined(without));
  }
  return Array.from(new Set(candidates));
}
