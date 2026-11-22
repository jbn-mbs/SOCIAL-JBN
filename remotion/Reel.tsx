import React from "react";
import {
  AbsoluteFill, Html5Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { END_CARD_S, type Beat, type ReelScript } from "../src/reel";

/** Footage the template can show, keyed by footage id. `file` is relative to public/. */
export type FootageMap = Record<string, { file: string; kind: "image" | "video"; width?: number; height?: number }>;

export interface ReelProps {
  script: ReelScript;
  footage: FootageMap;
  /** Background music relative to public/, or null for silence. */
  music: string | null;
  [key: string]: unknown;
}

// careerGUIDE look: warm canvas, ink borders, hard shadows, yellow accent.
const C = { bg: "#f5e9dc", card: "#ffffff", ink: "#121212", muted: "#4a4a4a", brand: "#f4b400", brandSoft: "#fff3d6", blue: "#5b9fd4" };
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const FRAME = { width: 940, height: 1060 };

function Logo({ size }: { size: number }) {
  return (
    <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, color: C.ink, letterSpacing: -size * 0.03 }}>
      CareerGuide<span style={{ color: C.brand }}>.</span>
    </span>
  );
}

function Sticker({ text, size, frame, fps, delay = 0 }: { text: string; size: number; frame: number; fps: number; delay?: number }) {
  const pop = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160 } });
  return (
    <div style={{
      transform: `scale(${0.85 + 0.15 * pop}) rotate(${(1 - pop) * -3}deg)`, opacity: pop,
      background: C.card, border: `7px solid ${C.ink}`, borderRadius: 28, boxShadow: `12px 12px 0 0 ${C.ink}`,
      padding: "26px 40px", fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.ink,
      textAlign: "center", maxWidth: 960,
    }}>
      {text}
    </div>
  );
}

function Subtitle({ text, frame, fps }: { text: string; frame: number; fps: number }) {
  const show = interpolate(frame, [0.25 * fps, 0.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      opacity: show, transform: `translateY(${(1 - show) * 20}px)`,
      background: C.brand, border: `6px solid ${C.ink}`, borderRadius: 22, boxShadow: `8px 8px 0 0 ${C.ink}`,
      padding: "20px 30px", fontFamily: FONT, fontWeight: 700, fontSize: 46, lineHeight: 1.2, color: C.ink,
      textAlign: "center", maxWidth: 960,
    }}>
      {text}
    </div>
  );
}

function Footage({ item, frame, durationInFrames }: { item: FootageMap[string]; frame: number; durationInFrames: number }) {
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const src = staticFile(item.file);
  const ratio = item.width && item.height ? item.height / item.width : null;
  const tall = ratio != null && ratio > (FRAME.height / FRAME.width) * 1.15;
  // Short, wide images (charts) get a frame that fits them instead of floating in white space.
  const height = ratio != null && !tall ? Math.min(FRAME.height, Math.round(FRAME.width * ratio) + 40) : FRAME.height;
  const style: React.CSSProperties = { width: "100%", height: "100%", display: "block" };
  return (
    <div style={{
      width: FRAME.width, height, overflow: "hidden", background: C.card, border: `7px solid ${C.ink}`, borderRadius: 36,
      boxShadow: `14px 14px 0 0 ${C.ink}`,
    }}>
      {item.kind === "video" ? (
        <OffthreadVideo src={src} muted style={{ ...style, objectFit: "cover" }} />
      ) : tall ? (
        // Tall screenshot: pan from top to (at most) 60% down, so the beat ends on more of the page.
        <Img src={src} style={{ ...style, objectFit: "cover", objectPosition: `50% ${t * 60}%` }} />
      ) : (
        <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: C.card }}>
          <Img src={src} style={{ width: "96%", height: "96%", objectFit: "contain", transform: `scale(${1 + t * 0.06})` }} />
        </div>
      )}
    </div>
  );
}

function BeatScene({ beat, footage, index }: { beat: Beat; footage: FootageMap; index: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const item = beat.footageId !== "none" ? footage[beat.footageId] : undefined;
  const isHook = index === 0;

  if (!item) {
    // Text card: big statement centred, subtitle under it.
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60, padding: 60 }}>
        <Sticker text={beat.onScreen} size={isHook ? 104 : 92} frame={frame} fps={fps} />
        {beat.subtitle && <Subtitle text={beat.subtitle} frame={frame} fps={fps} />}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "110px 60px 90px", gap: 46 }}>
      <Sticker text={beat.onScreen} size={isHook ? 76 : 66} frame={frame} fps={fps} />
      <Footage item={item} frame={frame} durationInFrames={durationInFrames} />
      {beat.subtitle && <Subtitle text={beat.subtitle} frame={frame} fps={fps} />}
    </AbsoluteFill>
  );
}

function EndCard({ cta }: { cta: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 70 }}>
      <div style={{ transform: `scale(${0.8 + 0.2 * pop})`, opacity: pop }}><Logo size={130} /></div>
      <Sticker text={cta} size={78} frame={frame} fps={fps} delay={8} />
      <p style={{ fontFamily: FONT, fontSize: 40, fontWeight: 600, color: C.muted, margin: 0 }}>Career guidance, built as games</p>
    </AbsoluteFill>
  );
}

function ProgressBar() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top: 40, left: 60, right: 60, height: 14, borderRadius: 7, border: `4px solid ${C.ink}`, background: C.card, overflow: "hidden" }}>
      <div style={{ width: `${(frame / durationInFrames) * 100}%`, height: "100%", background: C.blue }} />
    </div>
  );
}

export function Reel({ script, footage, music }: ReelProps) {
  const { fps, durationInFrames } = useVideoConfig();
  let from = 0;
  const scenes = script.beats.map((beat, i) => {
    const frames = Math.round(beat.seconds * fps);
    const el = (
      <Sequence key={i} from={from} durationInFrames={frames}>
        <BeatScene beat={beat} footage={footage} index={i} />
      </Sequence>
    );
    from += frames;
    return el;
  });
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Faint dotted canvas texture */}
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${C.ink}14 2px, transparent 2px)`, backgroundSize: "36px 36px" }} />
      {scenes}
      <Sequence from={from} durationInFrames={END_CARD_S * fps}><EndCard cta={script.cta} /></Sequence>
      <ProgressBar />
      {music && (
        <Html5Audio src={staticFile(music)} volume={(f) =>
          interpolate(f, [0, fps, durationInFrames - fps, durationInFrames], [0, 0.35, 0.35, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      )}
    </AbsoluteFill>
  );
}
