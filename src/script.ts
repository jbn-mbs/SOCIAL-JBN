import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { config, PATHS } from "./config";
import type { FootageItem } from "./library";
import type { Pillar } from "./pillars";
import { MAX_TOTAL_S, MIN_TOTAL_S, normalizeScript, REEL_JSON_SCHEMA, ReelScriptSchema, type ReelScript } from "./reel";

/**
 * Stable instructions (cached across days). Everything that changes daily goes in the user message,
 * after this prefix, so the cache keeps hitting.
 */
const SYSTEM = `You write short vertical video scripts (Instagram Reels) for careerGUIDE, a career guidance platform for school students in India.

Audience: students around Class 9-12, their parents, and school staff. Write for a 15-year-old and their parent: plain, warm, direct. Light Hinglish is fine when natural; never forced.

Format:
- ${MIN_TOTAL_S}-${MAX_TOTAL_S - 5} seconds in total, 3-7 beats, each 2-8 seconds.
- Beat 1 is the hook: a question or surprising statement a student would stop scrolling for. Max 8 words. No footage needed.
- onScreen text: max 7 words, punchy. subtitle: one sentence, max 18 words, adds what the on-screen text doesn't say.
- The video has no voiceover, so the on-screen text and subtitles must carry the whole message.
- footageId: use only ids from the footage list given, and only where the footage actually shows what the beat says. Otherwise use "none" (an animated text card).
- cta: max 6 words, ends with "Link in bio" when it points to the site.
- caption: 1-3 sentences, max 300 characters, no hashtags. hashtags: 4-8, relevant, mixing broad and specific.

Hard rules:
- Every product claim must come from the fact sheet. If it isn't in the fact sheet, don't say it.
- Never promise jobs, admissions, salaries or results. Never invent numbers or testimonials.
- Never describe or name a real student. Dashboard footage shows sample data; when a beat shows it, it is fine to say "sample data".
- No fear about exams or failure as a hook. Encourage, don't scare.
- Don't reuse any hook listed under "recent hooks".`;

export interface ScriptRequest {
  pillar: Pillar;
  footage: FootageItem[];
  recentHooks: string[];
  date: string;
}

export function buildUserMessage({ pillar, footage, recentHooks, date }: ScriptRequest, facts: string): string {
  const footageList = footage.length
    ? footage.map((f) => `- ${f.id}: ${f.description}`).join("\n")
    : "(none available: use \"none\" for every beat)";
  return [
    `<fact_sheet>\n${facts.trim()}\n</fact_sheet>`,
    `<footage>\n${footageList}\n</footage>`,
    `<recent_hooks>\n${recentHooks.length ? recentHooks.map((h) => `- ${h}`).join("\n") : "(none yet)"}\n</recent_hooks>`,
    `Write today's reel (${date}).\nPillar: ${pillar.name} (id "${pillar.id}"). Angle: ${pillar.angle}\nMain audience: ${pillar.audience}.\nSet "pillar" to "${pillar.id}".`,
  ].join("\n\n");
}

/** Ask Claude for today's script, validate it, and make it safe to render. */
export async function writeScript(req: ScriptRequest, client = new Anthropic()): Promise<ReelScript> {
  const facts = fs.readFileSync(PATHS.facts, "utf8");
  const response = await client.beta.messages.create({
    model: config.model,
    max_tokens: 16000,
    // If a safety classifier declines (rare false positive), the API retries on a fallback model instead of failing the day.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: REEL_JSON_SCHEMA } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(req, facts) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined to write today's script (${response.stop_details?.category ?? "no category"}).`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Script was cut off (max_tokens). Try again.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = ReelScriptSchema.parse(JSON.parse(text));
  return normalizeScript(parsed, new Set(req.footage.map((f) => f.id)));
}
