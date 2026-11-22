import type { ReelScript } from "./reel";

/**
 * A hand-written script used by `npm run daily:sample` (tests rendering and Telegram without calling Claude)
 * and as the preview default. Uses only dashboard footage, which exists after `npm run footage`.
 */
export const SAMPLE_SCRIPT: ReelScript = {
  pillar: "for-schools",
  title: "Which students need a nudge?",
  beats: [
    { seconds: 3, onScreen: "Results day shouldn't be the first warning", subtitle: "", footageId: "none" },
    { seconds: 6, onScreen: "Who needs a nudge?", subtitle: "Counsellors see who hasn't started, who stalled, and whose answers need a second look.", footageId: "counsellor-followup" },
    { seconds: 5, onScreen: "Every class at a glance", subtitle: "Teachers see each group's progress, from not started to career report.", footageId: "teacher-progress" },
    { seconds: 5, onScreen: "What your students want to be", subtitle: "Career interests across the whole school, from students' latest reports.", footageId: "counsellor-interests" },
    { seconds: 4, onScreen: "Sample data shown", subtitle: "Read-only dashboards. Nothing here changes a student's record.", footageId: "none" },
  ],
  cta: "Bring careerGUIDE to your school",
  caption: "A counsellor's view of every student's career journey, before results day. Sample data shown.",
  hashtags: ["#careerguidance", "#schoolcounselling", "#edtech", "#students", "#careers"],
};
