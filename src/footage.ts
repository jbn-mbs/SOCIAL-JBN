/**
 * Screenshots of the careerGUIDE dashboards (demo mode) for reels. Run directly with `npm run footage`.
 *
 * Safety: the dashboards can also run on real school data. Capture refuses to run unless the page shows the
 * demo viewer, so a real student's name or scores never ends up in a reel.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { config, PATHS } from "./config";
import type { FootageItem } from "./library";

interface Shot {
  id: string;
  path: string;
  description: string;
  /** Screenshot the card with this heading; omit for the full page. */
  card?: string;
}

export const SHOTS: Shot[] = [
  { id: "school-overview", path: "/institute", description: "Institute dashboard, whole page: student, staff and group numbers, enrolment-to-report funnel, top careers (sample school)" },
  { id: "school-funnel", path: "/institute", card: "From enrolment to career report", description: "Funnel chart: enrolled, started an assessment, completed a module, has a career report" },
  { id: "school-groups", path: "/institute", card: "Groups", description: "Table of class groups with % started, % with report and how many need attention" },
  { id: "teacher-progress", path: "/teacher", card: "Progress by group", description: "Stacked bars per class: has report, in progress, stalled, not started" },
  { id: "teacher-students", path: "/teacher", card: "Students", description: "Teacher's student list sorted by who needs attention first, with status pills and top career match" },
  { id: "counsellor-followup", path: "/counsellor", card: "Students to follow up with", description: "Counsellor's follow-up list: who hasn't started, who stalled, whose answers are flagged" },
  { id: "counsellor-interests", path: "/counsellor", card: "Career interests", description: "Bar chart of students' top career matches across the school" },
  { id: "counsellor-skill-gaps", path: "/counsellor", card: "Skill gaps to work on", description: "Bar chart of the most common skill gaps across students' reports" },
  { id: "parent-view", path: "/parent", description: "Parent dashboard: a child's status, assessments done, top career matches and skills to build" },
  { id: "platform-trend", path: "/admin", card: "Signups and assessment activity per week", description: "Weekly trend lines of modules completed and started" },
];

const DEMO_MARKER = "Demo Viewer";

async function launch(): Promise<Browser> {
  // Prefer the installed Chrome (no download); fall back to Playwright's Chromium if it was installed.
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  const text = await page.locator("body").innerText();
  if (!text.includes(DEMO_MARKER)) {
    throw new Error(`${url} is not in demo mode (no "${DEMO_MARKER}" on the page). Refusing to capture what may be real student data. ` +
      "Run the dashboards with `npm run demo` (or without Supabase env vars) and try again.");
  }
  // Hide the Next.js dev-mode badge so it doesn't appear in footage.
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }" });
  await page.waitForTimeout(1500); // let chart animations finish
}

export async function isDashboardUp(url = config.dashboardUrl): Promise<boolean> {
  try {
    const res = await fetch(url + "/", { signal: AbortSignal.timeout(60_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Capture every shot, write public/footage/captured/*.png and library.json, and return the items. */
export async function captureFootage(baseUrl = config.dashboardUrl): Promise<FootageItem[]> {
  fs.mkdirSync(PATHS.captured, { recursive: true });
  const browser = await launch();
  const items: FootageItem[] = [];
  try {
    // Phone-shaped viewport (below the dashboards' desktop breakpoint, so mobile layout), 1.8x pixels = 1080 px wide.
    const context = await browser.newContext({ viewport: { width: 600, height: 1067 }, deviceScaleFactor: 1.8 });
    const page = await context.newPage();
    let current = "";
    for (const shot of SHOTS) {
      if (shot.path !== current) {
        await open(page, baseUrl + shot.path);
        current = shot.path;
      }
      const file = path.join(PATHS.captured, `${shot.id}.png`);
      if (shot.card) {
        const card = page.locator("article", { has: page.locator("h2", { hasText: shot.card }) }).first();
        if (!(await card.count())) {
          console.warn(`  skipped ${shot.id}: no card "${shot.card}" on ${shot.path}`);
          continue;
        }
        await card.scrollIntoViewIfNeeded();
        // Clip to the viewport width: some cards are wider than a phone screen and scroll sideways.
        const box = await card.boundingBox();
        const vw = page.viewportSize()!.width;
        const scrollY = await page.evaluate(() => window.scrollY);
        if (!box) continue;
        const x = Math.max(0, box.x);
        await page.screenshot({ path: file, fullPage: true, clip: { x, y: box.y + scrollY, width: Math.min(box.width, vw - x), height: box.height } });
      } else {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: file, fullPage: true });
      }
      items.push({ id: shot.id, file: `footage/captured/${shot.id}.png`, kind: "image", description: shot.description });
      console.log(`  captured ${shot.id}`);
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(PATHS.captured, "library.json"), JSON.stringify({ capturedAt: new Date().toISOString(), items }, null, 2));
  return items;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Capturing footage from ${config.dashboardUrl} ...`);
  captureFootage().then((items) => console.log(`Done: ${items.length} shots.`)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
