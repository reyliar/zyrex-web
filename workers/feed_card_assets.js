// Binary assets for the Discord feed card. Wrangler turns the wasm into a compiled module
// and the woff files into ArrayBuffers (see the rules in wrangler.workers.toml).
import resvgWasm from "../node_modules/@resvg/resvg-wasm/index_bg.wasm";
import fontRegular from "./fonts/inter-400.woff";
import fontBold from "./fonts/inter-700.woff";

export const cardAssets = { wasm: resvgWasm, fontRegular, fontBold };
