import React from "react";
import { Composition } from "remotion";
import { FPS, totalSeconds } from "../src/reel";
import { SAMPLE_SCRIPT } from "../src/sample";
import { Reel, type ReelProps } from "./Reel";

/** The one composition. Its length follows the script; `npm run preview` opens it with the sample script. */
export function RemotionRoot() {
  return (
    <Composition
      id="Reel"
      component={Reel}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={totalSeconds(SAMPLE_SCRIPT) * FPS}
      defaultProps={{ script: SAMPLE_SCRIPT, footage: {}, music: null } satisfies ReelProps}
      calculateMetadata={({ props }) => ({ durationInFrames: totalSeconds(props.script) * FPS })}
    />
  );
}
