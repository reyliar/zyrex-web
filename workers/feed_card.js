// The Discord feed announcement is a rendered image, not an embed: a small X-style card
// carrying the author, the post text and a snapshot of its counters. Animated media is
// re-encoded as a GIF so stickers and GIFs keep playing inside the card.
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { parseGIF, decompressFrames } from "gifuct-js";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { emojiRuns, hasEmoji, twemojiCodes } from "./emoji.js";

const CARD_WIDTH = 1200;
const PAD = 54;
const CONTENT_WIDTH = CARD_WIDTH - PAD * 2;
const MEDIA_MAX_HEIGHT = 420;
const MEDIA_MIN_HEIGHT = 180;
const MEDIA_GAP = 26;
const MEDIA_RADIUS = 22;
const TEXT_LIMIT = 420;
const BODY_FONT_SIZE = 34;
const EMOJI_LIMIT = 24;
// Every GIF frame carries a whole card, so animated cards are encoded smaller and shorter:
// a 1200px / 30 frame GIF is ~1.6 MB and clients paint it while it is still downloading.
const GIF_CARD_WIDTH = 760;
const GIF_MAX_FRAMES = 24;
const GIF_COLORS = 256;
const MIN_FRAME_DELAY = 30;
const MAX_FRAME_DELAY = 200;

let wasmReady = null;

const el = (type, style, children) => ({ type, props: { style, children } });
const img = (src, style) => ({ type: "img", props: { src, style } });

const CHECK_BADGE = "data:image/svg+xml;base64," + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#3b82f6"/>' +
  '<path d="M6.6 12.4l3.4 3.4 7-7.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
);

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function truncate(value, limit) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).trimEnd() + "…";
}

// Media markers never belong on the card; only the words do. Posts are markdown, so the
// syntax is stripped here as well.
export function feedCardText(post) {
  return truncate(String((post && post.text) || "")
    .replace(/!\[(?:sticker:[^\]]*|gif)\]\([^)]*\)/gi, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\((?:https?:\/\/[^\s)]*)\)/gi, "$1")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/\s+\n/g, "\n"), TEXT_LIMIT);
}

// Dimensions come from the bytes so the media is never cropped or stretched.
export function imageSize(bytes, type = "") {
  const head = bytes || new Uint8Array();
  try {
    if (head[0] === 0x89 && head[1] === 0x50) {
      return {
        width: ((head[16] << 24) | (head[17] << 16) | (head[18] << 8) | head[19]) >>> 0,
        height: ((head[20] << 24) | (head[21] << 16) | (head[22] << 8) | head[23]) >>> 0,
      };
    }
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) {
      return { width: head[6] | (head[7] << 8), height: head[8] | (head[9] << 8) };
    }
    if (head[0] === 0xff && head[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < head.length) {
        if (head[offset] !== 0xff) { offset += 1; continue; }
        const marker = head[offset + 1];
        const length = (head[offset + 2] << 8) | head[offset + 3];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: (head[offset + 5] << 8) | head[offset + 6], width: (head[offset + 7] << 8) | head[offset + 8] };
        }
        offset += 2 + length;
      }
    }
    if (head[0] === 0x52 && head[1] === 0x49 && head[8] === 0x57 && head[9] === 0x45) {
      const chunk = String.fromCharCode(head[12], head[13], head[14], head[15]);
      if (chunk === "VP8X") {
        return {
          width: 1 + (head[24] | (head[25] << 8) | (head[26] << 16)),
          height: 1 + (head[27] | (head[28] << 8) | (head[29] << 16)),
        };
      }
      if (chunk === "VP8 ") {
        return { width: (head[26] | (head[27] << 8)) & 0x3fff, height: (head[28] | (head[29] << 8)) & 0x3fff };
      }
      if (chunk === "VP8L") {
        const bits = head[21] | (head[22] << 8) | (head[23] << 16) | (head[24] << 24);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
  } catch (_) {}
  return { width: 0, height: 0 };
}

export function isGif(bytes) {
  return Boolean(bytes && bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46);
}

function mediaBox(width, height) {
  const safeWidth = width > 0 ? width : 16;
  const safeHeight = height > 0 ? height : 9;
  const fit = Math.min(CONTENT_WIDTH / safeWidth, MEDIA_MAX_HEIGHT / safeHeight);
  let w = Math.round(safeWidth * fit);
  let h = Math.round(safeHeight * fit);
  if (h < MEDIA_MIN_HEIGHT) {
    const up = MEDIA_MIN_HEIGHT / h;
    w = Math.round(w * up);
    h = Math.round(h * up);
  }
  if (w > CONTENT_WIDTH) {
    const down = CONTENT_WIDTH / w;
    w = Math.round(w * down);
    h = Math.round(h * down);
  }
  return { width: w, height: h };
}

function baseStyle(padding) {
  return {
    display: "flex", flexDirection: "column", width: `${CARD_WIDTH}px`,
    backgroundColor: "#000000", color: "#e7e9ea", fontFamily: "Inter", ...padding,
  };
}

function bodyNode(body) {
  return el("div", { display: "flex", marginTop: "30px", fontSize: `${BODY_FONT_SIZE}px`, lineHeight: 1.45, whiteSpace: "pre-wrap" }, body);
}

// Satori has no emoji font, so a post with emoji is laid out as words: text runs plus
// Twemoji images sized like the font. Plain text keeps the simple, well-wrapped path.
async function textTree(text, resolveEmoji) {
  const value = String(text == null ? "" : text);
  if (!hasEmoji(value) || typeof resolveEmoji !== "function") return bodyNode(value);

  const lines = value.split("\n");
  const emojiNodes = new Map();
  let used = 0;
  for (const line of lines) {
    for (const run of emojiRuns(line)) {
      if (run.type !== "emoji" || emojiNodes.has(run.value) || used >= EMOJI_LIMIT) continue;
      used += 1;
      emojiNodes.set(run.value, await resolveEmoji(run.value).catch(() => ""));
    }
  }

  const lineNodes = lines.map(line => {
    const words = [];
    let current = [];
    for (const run of emojiRuns(line)) {
      if (run.type === "emoji") { current.push(run); continue; }
      for (const part of run.value.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          if (current.length) { words.push(current); current = []; }
        } else {
          current.push({ type: "text", value: part });
        }
      }
    }
    if (current.length) words.push(current);
    if (!words.length) return el("div", { display: "flex", height: `${Math.round(BODY_FONT_SIZE * 0.9)}px` }, "");
    return el("div", { display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: "10px", rowGap: "4px" },
      words.map(word => el("div", { display: "flex", alignItems: "center" },
        word.map(run => {
          if (run.type !== "emoji") return el("div", { display: "flex" }, run.value);
          const source = emojiNodes.get(run.value) || "";
          if (!source) return el("div", { display: "flex" }, run.value);
          return img(source, { width: `${Math.round(BODY_FONT_SIZE * 1.02)}px`, height: `${Math.round(BODY_FONT_SIZE * 1.02)}px` });
        }))));
  });

  return el("div", { display: "flex", flexDirection: "column", marginTop: "30px", fontSize: `${BODY_FONT_SIZE}px`, lineHeight: 1.45, rowGap: "4px" }, lineNodes);
}

function headerTree(author, body) {
  const name = String((author && author.name) || "Zyrex member").slice(0, 60);
  const handle = String((author && author.handle) || "").slice(0, 40);
  return el("div", baseStyle({ padding: "46px 54px 0" }), [
    el("div", { display: "flex", alignItems: "flex-start", gap: "20px", width: "100%" }, [
      el("div", {
        display: "flex", width: "92px", height: "92px", borderRadius: "9999px", overflow: "hidden",
        backgroundColor: "#16181c", alignItems: "center", justifyContent: "center",
        fontSize: "38px", fontWeight: 700, color: "#ffffff",
      }, author && author.avatar ? [img(author.avatar, { width: "92px", height: "92px" })] : name.slice(0, 1).toUpperCase()),
      el("div", { display: "flex", flexDirection: "column", gap: "2px", flex: 1 }, [
        el("div", { display: "flex", alignItems: "center", gap: "10px" }, [
          el("div", { display: "flex", fontSize: "34px", fontWeight: 700, color: "#e7e9ea" }, name),
          author && author.is_admin ? img(CHECK_BADGE, { width: "30px", height: "30px" }) : null,
        ].filter(Boolean)),
        el("div", { display: "flex", fontSize: "26px", color: "#71767b" }, handle ? `@${handle}` : "Zyrex member"),
      ]),
      el("div", { display: "flex", marginLeft: "auto", fontSize: "30px", color: "#71767b" }, "···"),
    ]),
    body,
  ]);
}

function countLine(counts) {
  const parts = [];
  if (counts && Number(counts.likes)) parts.push(`${Number(counts.likes)} likes`);
  if (counts && Number(counts.views)) parts.push(`${Number(counts.views)} views`);
  if (counts && Number(counts.replies)) parts.push(`${Number(counts.replies)} replies`);
  return parts.join(" · ");
}

function footerTree(footer, counts) {
  return el("div", baseStyle({ padding: "30px 54px 42px" }), [
    el("div", { display: "flex", alignItems: "center", fontSize: "22px", color: "#71767b", gap: "14px" }, [
      el("div", { display: "flex" }, footer),
      el("div", { display: "flex", marginLeft: "auto" }, countLine(counts)),
    ]),
  ]);
}

function mediaTree(dataUrl, box, options = {}) {
  const picture = img(dataUrl, {
    width: `${box.width}px`, height: `${box.height}px`,
    borderRadius: `${MEDIA_RADIUS}px`, objectFit: "cover",
  });
  // A video post shows its poster with a play badge, so the card still says "video".
  const badge = options.video
    ? el("div", {
      position: "absolute", bottom: "14px", right: "14px", display: "flex",
      alignItems: "center", justifyContent: "center", width: "78px", height: "78px",
      borderRadius: "39px", background: "rgba(0, 0, 0, 0.6)", color: "#ffffff", fontSize: "40px",
      paddingLeft: "6px",
    }, "▶")
    : null;
  return el("div", { display: "flex", marginTop: `${MEDIA_GAP}px`, width: "100%", justifyContent: "center" }, [
    el("div", { display: "flex", position: "relative", width: `${box.width}px`, height: `${box.height}px` }, [picture, badge].filter(Boolean)),
  ]);
}

async function renderSvg(tree, fonts) {
  const svg = await satori(tree, { width: CARD_WIDTH, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: CARD_WIDTH } }).render();
}

function paste(dst, dstWidth, src, srcWidth, srcHeight, dx, dy) {
  for (let y = 0; y < srcHeight; y += 1) {
    const targetY = dy + y;
    if (targetY < 0) continue;
    const srcRow = y * srcWidth * 4;
    dst.set(src.subarray(srcRow, srcRow + srcWidth * 4), (targetY * dstWidth + dx) * 4);
  }
}

// Box filter: the card is composed at 1200px, then averaged down for the GIF.
function downscaleRgba(source, width, height, targetWidth) {
  const scale = targetWidth / width;
  const targetHeight = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.min(height - 1, Math.floor(y / scale));
    const y1 = Math.max(y0 + 1, Math.min(height, Math.floor((y + 1) / scale)));
    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.min(width - 1, Math.floor(x / scale));
      const x1 = Math.max(x0 + 1, Math.min(width, Math.floor((x + 1) / scale)));
      let r = 0, g = 0, b = 0, count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const s = (sy * width + sx) * 4;
          r += source[s]; g += source[s + 1]; b += source[s + 2]; count += 1;
        }
      }
      const d = (y * targetWidth + x) * 4;
      out[d] = r / count; out[d + 1] = g / count; out[d + 2] = b / count; out[d + 3] = 255;
    }
  }
  return { pixels: out, width: targetWidth, height: targetHeight };
}

// GIF frames are partial and may be transparent. A transparent pixel means "keep what the
// previous frame painted", so the sheet is never cleared: copying the patch as-is turned
// every transparent pixel black, which is what made stickers and GIFs look noisy.
export function paintFrame(sheet, previous, frame, width) {
  if (previous && Number(previous.disposalType) >= 2) {
    const dims = previous.dims || { top: 0, left: 0, width: 0, height: 0 };
    for (let y = 0; y < dims.height; y += 1) {
      const start = ((dims.top + y) * width + dims.left) * 4;
      sheet.fill(0, start, start + dims.width * 4);
    }
  }
  const patch = frame.patch || new Uint8ClampedArray(0);
  const dims = frame.dims || { top: 0, left: 0, width: 0, height: 0 };
  if (!patch.length) return;
  for (let y = 0; y < dims.height; y += 1) {
    const rowFrom = y * dims.width * 4;
    const rowTo = ((dims.top + y) * width + dims.left) * 4;
    for (let x = 0; x < dims.width; x += 1) {
      const from = rowFrom + x * 4;
      if (patch[from + 3] === 0) continue;
      const to = rowTo + x * 4;
      sheet[to] = patch[from];
      sheet[to + 1] = patch[from + 1];
      sheet[to + 2] = patch[from + 2];
      sheet[to + 3] = 255;
    }
  }
}

function roundMask(width, height, radius) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      if (dx >= radius || dy >= radius) { mask[y * width + x] = 1; continue; }
      const ox = radius - dx;
      const oy = radius - dy;
      mask[y * width + x] = ox * ox + oy * oy <= radius * radius ? 1 : 0;
    }
  }
  return mask;
}

function scaleFrame(source, sourceWidth, sourceHeight, targetWidth, targetHeight, mask) {
  const out = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const sx = sourceWidth / targetWidth;
  const sy = sourceHeight / targetHeight;
  for (let y = 0; y < targetHeight; y += 1) {
    const srcY = Math.min(sourceHeight - 1, Math.floor(y * sy));
    for (let x = 0; x < targetWidth; x += 1) {
      const srcX = Math.min(sourceWidth - 1, Math.floor(x * sx));
      const s = (srcY * sourceWidth + srcX) * 4;
      const d = (y * targetWidth + x) * 4;
      const opaque = mask ? mask[y * targetWidth + x] : 1;
      out[d] = source[s] * opaque;
      out[d + 1] = source[s + 1] * opaque;
      out[d + 2] = source[s + 2] * opaque;
      out[d + 3] = 255;
    }
  }
  return out;
}

function decodeGifFrames(bytes) {
  try {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const parsed = parseGIF(buffer);
    const frames = decompressFrames(parsed, true);
    if (!frames || frames.length < 2) return null;
    return { width: parsed.lsd.width, height: parsed.lsd.height, frames };
  } catch (_) {
    return null;
  }
}

async function renderAnimated(options, fonts, animation) {
  const body = await textTree(options.text || "(media only)", options.emoji);
  const header = await renderSvg(headerTree(options.author, body), fonts);
  const footer = await renderSvg(footerTree(options.footer, options.counts), fonts);
  const box = mediaBox(animation.width, animation.height);
  const totalHeight = header.height + MEDIA_GAP + box.height + footer.height;
  const canvas = new Uint8ClampedArray(CARD_WIDTH * totalHeight * 4);
  for (let index = 3; index < canvas.length; index += 4) canvas[index] = 255;
  paste(canvas, CARD_WIDTH, header.pixels, header.width, header.height, 0, 0);
  paste(canvas, CARD_WIDTH, footer.pixels, footer.width, footer.height, 0, header.height + MEDIA_GAP + box.height);

  const mask = roundMask(box.width, box.height, MEDIA_RADIUS);
  const mediaX = PAD + Math.round((CONTENT_WIDTH - box.width) / 2);
  const mediaY = header.height + MEDIA_GAP;
  const sheet = new Uint8ClampedArray(animation.width * animation.height * 4);
  const encoder = GIFEncoder();
  const total = Math.min(animation.frames.length, GIF_MAX_FRAMES);
  // One global palette for every frame: frames that carry their own local colour table
  // get re-encoded by Discord against the global one, which turns photos into noise.
  let palette = null;
  let encodedWidth = 0;
  let encodedHeight = 0;
  let previous = null;
  for (let index = 0; index < total; index += 1) {
    const frame = animation.frames[index];
    paintFrame(sheet, previous, frame, animation.width);
    const scaled = scaleFrame(sheet, animation.width, animation.height, box.width, box.height, mask);
    previous = frame;
    paste(canvas, CARD_WIDTH, scaled, box.width, box.height, mediaX, mediaY);
    const shrunk = downscaleRgba(canvas, CARD_WIDTH, totalHeight, GIF_CARD_WIDTH);
    encodedWidth = shrunk.width;
    encodedHeight = shrunk.height;
    if (!palette) palette = quantize(shrunk.pixels, GIF_COLORS, { format: "rgb565" });
    const indexed = applyPalette(shrunk.pixels, palette, "rgb565");
    encoder.writeFrame(indexed, shrunk.width, shrunk.height, {
      ...(index === 0 ? { palette } : {}),
      delay: Math.min(Math.max(Number(frame.delay) || 60, MIN_FRAME_DELAY), MAX_FRAME_DELAY),
      repeat: 0,
    });
  }
  encoder.finish();
  return { bytes: encoder.bytes(), contentType: "image/gif", extension: "gif", width: encodedWidth, height: encodedHeight };
}

export async function renderFeedCardAttachment(options, assets) {
  if (!wasmReady) {
    wasmReady = initWasm(assets.wasm).catch(() => {
      wasmReady = null;
      throw new Error("Card renderer unavailable");
    });
  }
  await wasmReady;
  const fonts = [
    { name: "Inter", data: assets.fontRegular, weight: 400, style: "normal" },
    { name: "Inter", data: assets.fontBold, weight: 700, style: "normal" },
  ];

  const mediaBytes = options.media && options.media.bytes ? new Uint8Array(options.media.bytes) : null;
  const animation = mediaBytes && isGif(mediaBytes) ? decodeGifFrames(mediaBytes) : null;
  if (animation) return renderAnimated(options, fonts, animation);

  const size = imageSize(mediaBytes || new Uint8Array(), options.media && options.media.type);
  const box = mediaBox(size.width, size.height);
  const dataUrl = mediaBytes ? `data:${(options.media && options.media.type) || "image/jpeg"};base64,${bytesToBase64(mediaBytes)}` : "";
  const body = await textTree(options.text || "(media only)", options.emoji);
  const tree = el("div", baseStyle({ padding: "46px 54px 42px" }), [
    headerTree(options.author, body),
    dataUrl ? mediaTree(dataUrl, box, { video: Boolean(options.video) }) : null,
    footerTree(options.footer, options.counts),
  ].filter(Boolean));
  const png = await renderSvg(tree, fonts).then(rendered => rendered.asPng());
  return { bytes: png, contentType: "image/png", extension: "png" };
}
