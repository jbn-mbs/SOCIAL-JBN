import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { PATHS } from "./config";
import type { Library } from "./library";
import type { ReelScript } from "./reel";
import type { FootageMap, ReelProps } from "../remotion/Reel";

/** Render a script to an MP4 (1080x1920, H.264) and return its path. */
export async function renderReel(script: ReelScript, library: Library, outFile: string): Promise<string> {
  const footage: FootageMap = Object.fromEntries(
    library.items.map((i) => [i.id, { file: i.file, kind: i.kind, width: i.width, height: i.height }]));
  const inputProps: ReelProps = {
    script,
    footage,
    music: fs.existsSync(PATHS.music) ? "music.mp3" : null,
  };

  const serveUrl = await bundle({ entryPoint: PATHS.remotionEntry, publicDir: PATHS.publicDir });
  const composition = await selectComposition({ serveUrl, id: "Reel", inputProps });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  let lastLogged = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outFile,
    inputProps,
    // Instagram-friendly: yuv420p H.264 at a sane quality; stays well under Telegram's 50 MB bot upload limit.
    crf: 20,
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== lastLogged) {
        lastLogged = pct;
        console.log(`  rendering ${pct}%`);
      }
    },
  });
  return outFile;
}
