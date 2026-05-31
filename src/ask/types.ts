/**
 * The vocabulary of one question.
 *
 * Only `AskConfig` is meant to be authored by hand (see `config.ts`). Everything
 * with a `Resolved` prefix is derived from it at runtime by `ladder.ts`, so that
 * editing the experience never means editing numbers.
 */

/** How the No button behaves at a given rung of the ladder. */
export type EvasionMode =
  /** Pinned to its slot. Stage zero, and every stage under reduced motion. */
  | 'still'
  /** Idles. Drifts a little when approached, comes straight back. */
  | 'drift'
  /** Classic repulsion — pushed away from the pointer, tethered to home. */
  | 'magnet'
  /** Wide sensing radius, loose tether, slips sideways around the cursor. */
  | 'skittish'
  /** Roams the viewport under its own steam. A moving target even untouched. */
  | 'panic'
  /** Stops running. Trembles in place, and gives in when pressed. */
  | 'doomed';

/**
 * One rung as you write it: the label on the No button, and the line that
 * appears under the question once it has been pressed.
 *
 * The optional fields exist for anyone who wants to fight the derived curve.
 * Leaving them out is the intended path.
 */
export interface Refusal {
  /** Label on the No button while sitting at this rung. */
  no: string;
  /** Line shown under the question at this rung. Rung 0 usually leaves it empty. */
  note?: string;
  /** Override the derived Yes multiplier. */
  yesScale?: number;
  /** Override the derived No multiplier. */
  noScale?: number;
  /** Override the derived evasion mode. */
  evasion?: EvasionMode;
  /**
   * Pressing No here answers yes anyway. Defaults to true on the final rung —
   * which is the whole joke, and also the escape hatch that keeps the page
   * finishable by keyboard, by screen reader, and by anyone out of patience.
   */
  surrender?: boolean;
}

/** A rung with every field resolved. Produced by `buildLadder`. */
export interface Rung {
  index: number;
  no: string;
  note: string;
  yesScale: number;
  noScale: number;
  evasion: EvasionMode;
  /** 0 → 1 across the ladder. Drives pulse tempo, glow and background warmth. */
  heat: number;
  surrender: boolean;
}

/** Everything shown after yes. */
export interface Finale {
  /** The answer, large. */
  headline: string;
  /** One line under it. */
  line: string;
  /**
   * Shown when they refused at least once. `{times}` becomes "once", "twice" or
   * "N times"; `{n}` becomes the bare number.
   */
  tally: string;
  /** Shown instead when they said yes on the first ask. */
  tallyFirst: string;
  /** Small closing line. */
  signoff: string;
  /** Label on the button that resets the page. */
  replay: string;
}

/** A colour scheme. Add your own in `themes.ts`. */
export interface Theme {
  /** Human-readable name, shown in the builder. */
  label: string;
  /** Page background, and the deeper tone it vignettes into. */
  paper: string;
  paperDeep: string;
  /** Body and heading colour. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** Drifting motes, and the bloom behind the Yes button. */
  glow: string;
  /** The Yes button. */
  accent: string;
  accentDeep: string;
  /** Text on top of the accent. Chosen for contrast, not for prettiness. */
  onAccent: string;
  /** Colours in the finale burst. */
  petals: readonly string[];
}

export type ThemeName = string;

/** The whole question, as one object. This is the thing you edit. */
export interface AskConfig {
  /** Small line above the question. A name goes well here. */
  eyebrow: string;
  /** The question. This is the `h1`. */
  question: string;
  /** Line under the question before anything has been pressed. Often empty. */
  note: string;
  /** Label on the Yes button. */
  yes: string;
  /** The ladder, in order. Index 0 is what they see first. */
  refusals: Refusal[];
  /** Words that float off when the No button slips a near-miss. */
  whispers: string[];
  finale: Finale;
  /** Key into `THEMES`. Unknown names fall back to the default. */
  theme: ThemeName;
  /** Three synthesised notes on yes. No audio files, no autoplay. */
  chime: boolean;
  /** Browser tab and link preview. */
  meta: {
    title: string;
    description: string;
  };
}
