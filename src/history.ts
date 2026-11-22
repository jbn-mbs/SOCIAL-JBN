import fs from "node:fs";
import path from "node:path";
import { PATHS } from "./config";

export interface HistoryEntry {
  date: string;
  pillar: string;
  title: string;
  hook: string;
  file: string;
  sentAt: string;
}

export function loadHistory(file = PATHS.history): HistoryEntry[] {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry, file = PATHS.history) {
  const all = loadHistory(file);
  all.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
}

/** Whether a reel for `date` was actually delivered (render-only runs don't count). */
export const sentOn = (date: string, history: HistoryEntry[]) => history.some((h) => h.date === date && !!h.sentAt);

/** Hooks from the last `n` reels, newest first, so Claude doesn't repeat itself. */
export const recentHooks = (history: HistoryEntry[], n = 20) => history.slice(-n).reverse().map((h) => h.hook);
