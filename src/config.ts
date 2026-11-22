import path from "node:path";
import { fileURLToPath } from "node:url";

/** Project root (the folder holding package.json), derived from this file so it works from any cwd. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PATHS = {
  facts: path.join(ROOT, "content", "facts.md"),
  pillars: path.join(ROOT, "content", "pillars.json"),
  publicDir: path.join(ROOT, "public"),
  captured: path.join(ROOT, "public", "footage", "captured"),
  manual: path.join(ROOT, "public", "footage", "manual"),
  music: path.join(ROOT, "public", "music.mp3"),
  out: path.join(ROOT, "out"),
  history: path.join(ROOT, "data", "history.json"),
  remotionEntry: path.join(ROOT, "remotion", "index.ts"),
};

export const config = {
  /** Claude model that writes the scripts. */
  model: process.env.REEL_MODEL || "claude-opus-5-5",
  /** Where the careerGUIDE dashboards run in demo mode (footage source). */
  dashboardUrl: (process.env.DASHBOARD_URL || "http://localhost:3100").replace(/\/$/, ""),
  /** Re-capture dashboard screenshots when they are older than this. */
  footageMaxAgeDays: Number(process.env.FOOTAGE_MAX_AGE_DAYS || 7),
  /** "Today" is decided in this time zone (the manager's). */
  timeZone: process.env.REEL_TIMEZONE || "Asia/Kolkata",
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  },
};

/** Today's date as YYYY-MM-DD in the configured time zone. */
export function today(now = new Date(), timeZone = config.timeZone): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function requireTelegram() {
  const { token, chatId } = config.telegram;
  if (!token || !chatId) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env (see README: 'Telegram setup').");
  }
  return { token, chatId };
}
