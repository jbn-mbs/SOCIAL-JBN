/**
 * Telegram Bot API delivery: the finished reel goes to the manager's chat with its caption and script.
 * CLI: `npm run telegram:test` sends a test message; `npm run telegram:test -- --chat-id` lists chats that messaged the bot.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, requireTelegram } from "./config";
import { totalSeconds, type ReelScript } from "./reel";

type Fetch = typeof fetch;

const CAPTION_MAX = 1024; // Telegram limit for media captions
const MESSAGE_MAX = 4096; // Telegram limit for text messages

interface TgResponse<T> { ok: boolean; result?: T; description?: string }

async function call<T>(method: string, body: FormData | Record<string, unknown>, token: string, fetchImpl: Fetch): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: isForm ? undefined : { "content-type": "application/json" },
    body: isForm ? body : JSON.stringify(body),
  });
  const json = (await res.json()) as TgResponse<T>;
  // Never include the token in errors: it would end up in logs.
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result as T;
}

const clip = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1) + "…");

/** The short text under the video: what it is and the ready-to-post caption. */
export function videoCaption(script: ReelScript, date: string): string {
  const post = `${script.caption}\n\n${script.hashtags.join(" ")}`;
  return clip(`Today's reel (${date}): ${script.title}\n\nCaption to post:\n${post}`, CAPTION_MAX);
}

/** The follow-up message: the beat-by-beat script and a reminder to review before posting. */
export function scriptMessage(script: ReelScript): string {
  const beats = script.beats.map((b, i) => {
    const shot = b.footageId === "none" ? "text card" : b.footageId;
    return `${i + 1}. [${b.seconds}s, ${shot}] ${b.onScreen}${b.subtitle ? `\n   ${b.subtitle}` : ""}`;
  }).join("\n");
  return clip(
    `Script (${totalSeconds(script)}s, pillar: ${script.pillar})\n\n${beats}\nEnd card: ${script.cta}\n\n` +
    "Please check every claim before posting. Reply here if anything needs changing.",
    MESSAGE_MAX);
}

export async function sendMessage(text: string, opts: { fetchImpl?: Fetch } = {}) {
  const { token, chatId } = requireTelegram();
  return call("sendMessage", { chat_id: chatId, text: clip(text, MESSAGE_MAX) }, token, opts.fetchImpl ?? fetch);
}

/** Send the reel and its script to the manager. */
export async function sendReel(file: string, script: ReelScript, date: string, opts: { fetchImpl?: Fetch } = {}) {
  const { token, chatId } = requireTelegram();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const size = fs.statSync(file).size;
  if (size > 50 * 1024 * 1024) throw new Error(`Reel is ${(size / 1048576).toFixed(1)} MB; Telegram bots can upload at most 50 MB.`);

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", videoCaption(script, date));
  form.append("supports_streaming", "true");
  form.append("width", "1080");
  form.append("height", "1920");
  form.append("duration", String(totalSeconds(script)));
  form.append("video", await fs.openAsBlob(file, { type: "video/mp4" }), path.basename(file));
  await call("sendVideo", form, token, fetchImpl);
  await call("sendMessage", { chat_id: chatId, text: scriptMessage(script) }, token, fetchImpl);
}

/** Chats that have messaged the bot recently: how to find the manager's chat id. */
export async function listChats(fetchImpl: Fetch = fetch) {
  const token = config.telegram.token;
  if (!token) throw new Error("Set TELEGRAM_BOT_TOKEN in .env first.");
  const updates = await call<{ message?: { chat: { id: number; type: string; title?: string; first_name?: string; username?: string } } }[]>(
    "getUpdates", {}, token, fetchImpl);
  const chats = new Map<number, string>();
  for (const u of updates) {
    const c = u.message?.chat;
    if (c) chats.set(c.id, c.title ?? [c.first_name, c.username && `@${c.username}`].filter(Boolean).join(" "));
  }
  return [...chats.entries()].map(([id, name]) => ({ id, name }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const run = async () => {
    if (process.argv.includes("--chat-id")) {
      const chats = await listChats();
      if (!chats.length) console.log("No chats yet. Ask the manager to open the bot in Telegram and send it /start, then run this again.");
      for (const c of chats) console.log(`TELEGRAM_CHAT_ID=${c.id}   (${c.name})`);
      return;
    }
    await sendMessage("careerGUIDE reels bot is connected. The daily reel will arrive in this chat.");
    console.log("Test message sent.");
  };
  run().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
