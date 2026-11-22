import fs from "node:fs";
import path from "node:path";
import { PATHS } from "./config";

/** One piece of footage a script can use. `file` is relative to public/ (Remotion's staticFile root). */
export interface FootageItem {
  id: string;
  file: string;
  kind: "image" | "video";
  description: string;
  /** Pixel size, when known (PNG). Lets the template pan tall screenshots instead of shrinking them. */
  width?: number;
  height?: number;
}

export interface Library {
  items: FootageItem[];
  /** When the captured screenshots were taken (ISO), or null if never. */
  capturedAt: string | null;
}

const VIDEO = /\.(mp4|mov|webm)$/i;
const IMAGE = /\.(png|jpe?g|webp)$/i;

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Captured dashboard screenshots (public/footage/captured/library.json, written by `npm run footage`) plus
 * anything the team adds by hand (public/footage/manual/manual.json + files). Entries whose file is missing are dropped.
 */
export function loadLibrary(): Library {
  const captured = readJson<{ capturedAt: string | null; items: FootageItem[] }>(
    path.join(PATHS.captured, "library.json"), { capturedAt: null, items: [] });
  const manual = readJson<{ id: string; file: string; description: string }[]>(path.join(PATHS.manual, "manual.json"), [])
    .filter((m) => m && m.id && m.file && m.description)
    .map((m): FootageItem => ({
      id: m.id,
      file: `footage/manual/${m.file}`,
      kind: VIDEO.test(m.file) ? "video" : "image",
      description: m.description,
    }));

  const items = [...captured.items, ...manual]
    .filter((i) => (VIDEO.test(i.file) || IMAGE.test(i.file)) && fs.existsSync(path.join(PATHS.publicDir, i.file)))
    .map((i) => ({ ...i, ...pngSize(path.join(PATHS.publicDir, i.file)) }));
  return { items, capturedAt: captured.capturedAt };
}

/** Width and height from a PNG header (bytes 16-23 of the IHDR chunk); {} for anything else. */
export function pngSize(file: string): { width?: number; height?: number } {
  if (!/\.png$/i.test(file)) return {};
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    if (buf.toString("ascii", 12, 16) !== "IHDR") return {};
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}

export function isStale(lib: Library, maxAgeDays: number, now = new Date()): boolean {
  if (!lib.capturedAt) return true;
  return now.getTime() - Date.parse(lib.capturedAt) > maxAgeDays * 86_400_000;
}
