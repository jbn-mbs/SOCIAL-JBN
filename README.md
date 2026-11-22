# careerguide-social

Makes one Instagram reel about careerGUIDE every day and sends the finished video to the manager on Telegram.

```
fact sheet + today's pillar ──> Claude writes the script ──> Remotion renders a 1080x1920 MP4 ──> Telegram: video + caption + script
            ▲                                                       ▲
     content/facts.md                         dashboard screenshots (demo data) + your own clips
```

The manager reviews each reel in Telegram and posts it to Instagram. Nothing is posted automatically.

## Setup (once)

1. **Install:** `npm install` (Node 22+; uses your installed Chrome for screenshots).
2. **Keys:** copy `.env.example` to `.env` and fill in:
   - `ANTHROPIC_API_KEY`: a Claude API key.
   - `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (next section).
3. **Telegram setup:**
   1. In Telegram, message **@BotFather**, send `/newbot`, pick a name. Copy the token into `TELEGRAM_BOT_TOKEN`.
   2. The manager opens the new bot and sends it `/start`. (For a group, add the bot to the group and send any message.)
   3. Run `npm run telegram:test -- --chat-id`. Copy the printed `TELEGRAM_CHAT_ID=...` line into `.env`.
   4. Run `npm run telegram:test`. The manager should get a "bot is connected" message.
4. **Try it:** `npm run daily:sample` renders the built-in sample reel and sends it (no Claude call).
   Then `npm run daily -- --force` makes a real one with Claude.
5. **Schedule it:** `powershell -ExecutionPolicy Bypass -File scripts\install-schedule.ps1 -Time 09:00`
   registers a Windows scheduled task. Output goes to `data\daily.log`. Remove it with `-Remove`.
   The computer must be on at that time; a missed run happens at the next chance.

## Daily run (`npm run daily`)

1. Skips if today's reel was already sent (`--force` overrides).
2. Re-captures dashboard screenshots if they are older than 7 days and the dashboards are reachable.
3. Picks today's pillar from `content/pillars.json` (rotates daily).
4. Claude (Claude Opus 5.5) writes the script as structured JSON, using only `content/facts.md` and the footage
   that exists. The script is validated and clamped (3-7 beats, 15-45 s, unknown footage becomes a text card).
5. Remotion renders `out/YYYY-MM-DD.mp4` in careerGUIDE's look (warm canvas, ink borders, yellow accent).
6. Telegram gets the video with the ready-to-post caption and hashtags, then the beat-by-beat script.
7. If anything fails, the manager gets a short "couldn't be made today" message.

Flags: `--sample` (built-in script, no Claude), `--no-send` (render only), `--force` (run again today).

## Content

- **`content/facts.md`** is the only source of product claims. Keep it accurate; update it when the product changes.
- **`content/pillars.json`** lists the themes the reels rotate through.
- **Footage:**
  - `npm run footage` screenshots the careerGUIDE dashboards at `DASHBOARD_URL` (default `http://localhost:3100`).
    The dashboards must be in **demo mode** (`npm run demo` in careerguide-dashboards); capture refuses to run on
    real data so no real student ever appears in a reel.
  - Your own clips (game recordings, app screens, team videos): put the file in `public/footage/manual/` and
    describe it in `public/footage/manual/manual.json`:
    ```json
    [{ "id": "ambavan-village", "file": "ambavan.mp4", "description": "Ambavan 3D village: a student walking to the map" }]
    ```
    Claude only uses footage whose description matches what a beat says, so write clear descriptions.
    Never add clips that show a real student without written parental consent.
- **Music (optional):** put a royalty-free track at `public/music.mp3`; it plays quietly under every reel.
  Or leave it out and add trending audio in Instagram when posting.

## Development

- `npm run preview` opens Remotion Studio with the sample script to tweak the design (`remotion/Reel.tsx`).
- `npm test` and `npm run typecheck`.
- Cost: one script is a few cents of Claude usage.
