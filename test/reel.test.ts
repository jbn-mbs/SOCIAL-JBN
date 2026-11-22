import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeScript, totalSeconds, MAX_TOTAL_S, MIN_TOTAL_S, END_CARD_S, type ReelScript } from "../src/reel";
import { pillarFor } from "../src/pillars";
import { recentHooks, sentOn } from "../src/history";
import { today } from "../src/config";
import { buildUserMessage } from "../src/script";

const base: ReelScript = {
  pillar: "games", title: " Test ", cta: "Link in bio", caption: "Hi", hashtags: ["careers", "#careers", "#class 10", "#"],
  beats: [
    { seconds: 3, onScreen: "Hook", subtitle: "", footageId: "none" },
    { seconds: 5, onScreen: "A", subtitle: "a", footageId: "known" },
    { seconds: 5, onScreen: "B", subtitle: "b", footageId: "unknown" },
  ],
};

test("normalizeScript swaps unknown footage for a text card and tidies hashtags", () => {
  const s = normalizeScript(base, new Set(["known"]));
  assert.equal(s.beats[1].footageId, "known");
  assert.equal(s.beats[2].footageId, "none");
  assert.deepEqual(s.hashtags, ["#careers", "#class10"]);
  assert.equal(s.title, "Test");
});

test("normalizeScript keeps the total between the limits", () => {
  const long = { ...base, beats: Array.from({ length: 9 }, (_, i) => ({ seconds: 20, onScreen: `b${i}`, subtitle: "", footageId: "none" })) };
  const s = normalizeScript(long, new Set());
  assert.equal(s.beats.length, 7);
  assert.ok(totalSeconds(s) - END_CARD_S <= MAX_TOTAL_S);
  const short = { ...base, beats: base.beats.map((b) => ({ ...b, seconds: 1 })) };
  assert.ok(totalSeconds(normalizeScript(short, new Set())) - END_CARD_S >= MIN_TOTAL_S);
});

test("normalizeScript rejects scripts with too few beats", () => {
  assert.throws(() => normalizeScript({ ...base, beats: base.beats.slice(0, 2) }, new Set()), /at least 3/);
});

test("pillarFor rotates daily and is stable within a day", () => {
  const pillars = ["a", "b", "c"].map((id) => ({ id, name: id, angle: "", audience: "" }));
  const days = ["2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"].map((d) => pillarFor(d, pillars).id);
  assert.notEqual(days[0], days[1]);
  assert.equal(days[0], days[3]);
  assert.equal(pillarFor("2026-11-22", pillars).id, days[0]);
});

test("history helpers", () => {
  const h = [1, 2, 3].map((n) => ({ date: `2026-11-0${n}`, pillar: "p", title: "t", hook: `hook ${n}`, file: "f", sentAt: "x" }));
  assert.ok(sentOn("2026-11-02", h));
  assert.ok(!sentOn("2026-11-09", h));
  assert.ok(!sentOn("2026-11-01", [{ ...h[0], sentAt: "" }]), "a render-only run doesn't count as sent");
  assert.deepEqual(recentHooks(h, 2), ["hook 3", "hook 2"]);
});

test("today() uses the configured time zone", () => {
  // 20:00 UTC on the 21st is already the 22nd in India.
  assert.equal(today(new Date("2026-11-21T20:00:00Z"), "Asia/Kolkata"), "2026-11-22");
  assert.equal(today(new Date("2026-11-21T20:00:00Z"), "UTC"), "2026-11-21");
});

test("the prompt carries facts, footage ids, recent hooks and the pillar", () => {
  const msg = buildUserMessage({
    pillar: { id: "games", name: "Games, not forms", angle: "games angle", audience: "students" },
    footage: [{ id: "teacher-progress", file: "x.png", kind: "image", description: "bars" }],
    recentHooks: ["Old hook"], date: "2026-11-22",
  }, "FACT ONE");
  for (const part of ["FACT ONE", "teacher-progress: bars", "- Old hook", 'Set "pillar" to "games"']) assert.ok(msg.includes(part), part);
});
