/**
 * The reel script: what Claude writes, what the video template renders, and what the manager reads on Telegram.
 * No Node imports here, because the Remotion bundle (browser) imports this file too.
 */
import { z } from "zod";

export const MIN_BEAT_S = 2;
export const MAX_BEAT_S = 8;
export const MIN_TOTAL_S = 15;
export const MAX_TOTAL_S = 45;
export const END_CARD_S = 3;
export const FPS = 30;

export const BeatSchema = z.object({
  /** How long this beat stays on screen. */
  seconds: z.number(),
  /** Big text on screen: max ~7 words. */
  onScreen: z.string(),
  /** One sentence shown as a subtitle under the footage. */
  subtitle: z.string(),
  /** A footage id from the library, or "none" for an animated text card. */
  footageId: z.string(),
});

export const ReelScriptSchema = z.object({
  pillar: z.string(),
  title: z.string(),
  beats: z.array(BeatSchema),
  /** End card call to action, e.g. "Find your fit. Link in bio". */
  cta: z.string(),
  /** The Instagram caption to post with the reel. */
  caption: z.string(),
  hashtags: z.array(z.string()),
});

export type Beat = z.infer<typeof BeatSchema>;
export type ReelScript = z.infer<typeof ReelScriptSchema>;

/** JSON Schema for Claude's structured output (objects closed, every field required). */
export const REEL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pillar", "title", "beats", "cta", "caption", "hashtags"],
  properties: {
    pillar: { type: "string" },
    title: { type: "string", description: "Internal title for the manager, max 8 words" },
    beats: {
      type: "array",
      description: "3 to 7 beats. The first beat is the hook.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["seconds", "onScreen", "subtitle", "footageId"],
        properties: {
          seconds: { type: "integer", description: `${MIN_BEAT_S} to ${MAX_BEAT_S}` },
          onScreen: { type: "string", description: "Big on-screen text, max 7 words" },
          subtitle: { type: "string", description: "One short sentence, max 18 words" },
          footageId: { type: "string", description: "An id from the footage list, or \"none\"" },
        },
      },
    },
    cta: { type: "string", description: "End card call to action, max 6 words" },
    caption: { type: "string", description: "Instagram caption without hashtags, max 300 characters" },
    hashtags: { type: "array", items: { type: "string" }, description: "4 to 8 hashtags, each starting with #" },
  },
} as const;

/**
 * Make a parsed script safe to render: clamp beat lengths, keep 3-7 beats, swap unknown footage for a
 * text card, trim the total into range, and tidy hashtags. Throws if nothing usable is left.
 */
export function normalizeScript(raw: ReelScript, footageIds: Set<string>): ReelScript {
  let beats = raw.beats
    .filter((b) => b.onScreen.trim() || b.subtitle.trim())
    .slice(0, 7)
    .map((b) => ({
      seconds: Math.min(MAX_BEAT_S, Math.max(MIN_BEAT_S, Math.round(b.seconds) || 4)),
      onScreen: b.onScreen.trim(),
      subtitle: b.subtitle.trim(),
      footageId: footageIds.has(b.footageId) ? b.footageId : "none",
    }));
  if (beats.length < 3) throw new Error(`Script has ${beats.length} usable beats; need at least 3.`);

  // Shrink the longest beats until the reel fits; pad the last beat if it is too short.
  const total = () => beats.reduce((n, b) => n + b.seconds, 0);
  while (total() > MAX_TOTAL_S) {
    const longest = beats.reduce((a, b) => (b.seconds > a.seconds ? b : a));
    if (longest.seconds <= MIN_BEAT_S) break;
    longest.seconds--;
  }
  if (total() < MIN_TOTAL_S) beats[beats.length - 1].seconds += MIN_TOTAL_S - total();
  beats = beats.map((b) => ({ ...b }));

  const hashtags = [...new Set(raw.hashtags.map((h) => "#" + h.replace(/^#+/, "").replace(/\s+/g, "")).filter((h) => h.length > 1))].slice(0, 8);
  return { ...raw, title: raw.title.trim(), cta: raw.cta.trim(), caption: raw.caption.trim(), beats, hashtags };
}

export const totalSeconds = (s: ReelScript) => s.beats.reduce((n, b) => n + b.seconds, 0) + END_CARD_S;
