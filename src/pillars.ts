import fs from "node:fs";
import { PATHS } from "./config";

export interface Pillar {
  id: string;
  name: string;
  angle: string;
  audience: string;
}

export function loadPillars(): Pillar[] {
  const pillars = JSON.parse(fs.readFileSync(PATHS.pillars, "utf8")) as Pillar[];
  if (!pillars.length) throw new Error("content/pillars.json is empty.");
  return pillars;
}

/**
 * Today's pillar: rotate through the list by day number, so consecutive days always differ and every
 * pillar comes round once per cycle. Deterministic, so a re-run on the same day picks the same pillar.
 */
export function pillarFor(date: string, pillars: Pillar[]): Pillar {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return pillars[day % pillars.length];
}
