/**
 * The daily job (`npm run daily`): pick today's pillar, refresh footage if stale, have Claude write the script,
 * render the reel, and send it to the manager on Telegram. Runs once per day; a second run the same day does
 * nothing unless --force. Flags: --sample (use the built-in script, no Claude call), --force, --no-send.
 */
import path from "node:path";
import { config, PATHS, requireTelegram, today } from "./config";
import { captureFootage, isDashboardUp } from "./footage";
import { appendHistory, loadHistory, recentHooks, sentOn } from "./history";
import { isStale, loadLibrary } from "./library";
import { loadPillars, pillarFor } from "./pillars";
import { normalizeScript, totalSeconds } from "./reel";
import { renderReel } from "./render";
import { SAMPLE_SCRIPT } from "./sample";
import { writeScript } from "./script";
import { sendMessage, sendReel } from "./telegram";

const args = new Set(process.argv.slice(2));
const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function main() {
  const date = today();
  const send = !args.has("--no-send");
  if (send) requireTelegram(); // fail before spending anything if Telegram isn't set up

  const history = loadHistory();
  if (sentOn(date, history) && !args.has("--force")) {
    log(`Reel for ${date} was already sent. Use --force to send another.`);
    return;
  }

  // Footage: refresh dashboard screenshots when they are old, if the demo dashboards are running.
  let library = loadLibrary();
  if (isStale(library, config.footageMaxAgeDays)) {
    if (await isDashboardUp()) {
      log(`Footage is stale; capturing from ${config.dashboardUrl}`);
      try {
        await captureFootage();
        library = loadLibrary();
      } catch (e) {
        log(`Footage capture failed, using existing footage: ${e instanceof Error ? e.message : e}`);
      }
    } else {
      log(`Footage is stale but ${config.dashboardUrl} isn't reachable; using existing footage (${library.items.length} items).`);
    }
  }

  // Script
  let script;
  if (args.has("--sample")) {
    script = normalizeScript(SAMPLE_SCRIPT, new Set(library.items.map((i) => i.id)));
    log("Using the built-in sample script.");
  } else {
    const pillar = pillarFor(date, loadPillars());
    log(`Writing script: pillar "${pillar.name}" with ${library.items.length} footage items`);
    script = await writeScript({ pillar, footage: library.items, recentHooks: recentHooks(history), date });
  }
  log(`Script: "${script.title}" (${totalSeconds(script)}s, ${script.beats.length} beats)`);

  // Render
  const file = path.join(PATHS.out, `${date}${args.has("--sample") ? "-sample" : ""}.mp4`);
  log(`Rendering ${file}`);
  await renderReel(script, library, file);

  // Deliver
  if (send) {
    log("Sending to Telegram");
    await sendReel(file, script, date);
  }
  // Sample runs are tests: they never count as today's reel or feed the "recent hooks" list.
  if (!args.has("--sample")) {
    appendHistory({ date, pillar: script.pillar, title: script.title, hook: script.beats[0].onScreen, file, sentAt: send ? new Date().toISOString() : "" });
  }
  log(send ? "Done: reel sent to the manager." : `Done (not sent): ${file}`);
}

main().catch(async (e) => {
  const msg = e instanceof Error ? e.message : String(e);
  log(`FAILED: ${msg}`);
  // Tell the manager instead of failing silently, if Telegram itself is configured.
  if (!args.has("--no-send") && config.telegram.token && config.telegram.chatId) {
    await sendMessage(`Today's careerGUIDE reel could not be made: ${msg}\nDetails are in data/daily.log on the machine that runs it.`).catch(() => {});
  }
  process.exit(1);
});
