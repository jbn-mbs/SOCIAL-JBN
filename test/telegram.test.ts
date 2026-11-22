import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.TELEGRAM_BOT_TOKEN = "123:SECRET";
process.env.TELEGRAM_CHAT_ID = "-1001";

const { sendReel, videoCaption, scriptMessage } = await import("../src/telegram");
const { SAMPLE_SCRIPT } = await import("../src/sample");

test("sendReel uploads the video with caption, then sends the script", async () => {
  const file = path.join(os.tmpdir(), "reel-test.mp4");
  fs.writeFileSync(file, Buffer.from("fake mp4"));
  const calls: { url: string; body: unknown }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body });
    return new Response(JSON.stringify({ ok: true, result: {} }));
  }) as unknown as typeof fetch;

  await sendReel(file, SAMPLE_SCRIPT, "2026-11-22", { fetchImpl: fakeFetch });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/bot123:SECRET\/sendVideo$/);
  const form = calls[0].body as FormData;
  assert.equal(form.get("chat_id"), "-1001");
  assert.ok(String(form.get("caption")).includes(SAMPLE_SCRIPT.caption));
  assert.ok(form.get("video") instanceof Blob);
  assert.match(calls[1].url, /sendMessage$/);
  assert.ok(String(JSON.parse(calls[1].body as string).text).includes("Script ("));
});

test("Telegram errors don't leak the bot token", async () => {
  const file = path.join(os.tmpdir(), "reel-test.mp4");
  const failing = (async () => new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }))) as unknown as typeof fetch;
  await assert.rejects(sendReel(file, SAMPLE_SCRIPT, "2026-11-22", { fetchImpl: failing }), (e: Error) =>
    e.message.includes("chat not found") && !e.message.includes("SECRET"));
});

test("captions respect Telegram's limits", () => {
  const huge = { ...SAMPLE_SCRIPT, caption: "x".repeat(5000) };
  assert.ok(videoCaption(huge, "2026-11-22").length <= 1024);
  assert.ok(scriptMessage({ ...huge, beats: huge.beats.map((b) => ({ ...b, subtitle: "y".repeat(2000) })) }).length <= 4096);
});
