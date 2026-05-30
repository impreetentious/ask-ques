import type { AskConfig } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THIS IS THE FILE YOU EDIT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every word on the page is below. Nothing else needs touching to ask a
 * different question — the button sizes, the escalation and the physics are all
 * derived from where a line sits in `refusals`, not written down.
 *
 * Rules of thumb:
 *   • `refusals` is the ladder, top to bottom. Index 0 is what loads.
 *   • Each press of No moves down one rung. The last rung gives in when pressed,
 *     so the page can always be finished — including by keyboard.
 *   • Six to twelve rungs feels right. Fewer than four and the escalation has no
 *     room to breathe; more than fourteen and it outstays the joke.
 *
 * To change the words without redeploying, open `/make` instead. It writes the
 * whole thing into a link.
 */
export const ask: AskConfig = {
  /** Small line above the question. Put a name here if you like. */
  eyebrow: 'A question, asked properly',

  /** The question. Keep it short — it is set very large. */
  question: 'Will you be my valentine?',

  /** Line under the question before anything is pressed. Empty reads best. */
  note: '',

  /** The right answer. */
  yes: 'Yes',

  /**
   * The ladder. `no` is the label on the No button; `note` is the line that
   * appears under the question once that rung is reached.
   */
  refusals: [
    { no: 'No' },
    { no: 'No', note: 'Odd. Let’s try that once more.' },
    { no: 'No, thank you', note: 'Politeness noted. Still the wrong button.' },
    { no: 'Still no', note: 'That button is starting to look nervous.' },
    { no: 'no', note: 'It has gone lowercase. Rarely a good sign.' },
    { no: 'n-no', note: 'You are not doing this for the right reasons.' },
    { no: 'no?', note: 'Was that a question?' },
    { no: 'hm', note: 'It is reconsidering. You could too.' },
    { no: '…', note: 'The no has run out of things to say.' },
    { no: 'fine, yes', note: 'Even the no says yes now. Your move.' },
  ],

  /** Shed one at a time when the No button slips a near-miss. Keep them tiny. */
  whispers: [
    'nope',
    'missed',
    'not today',
    'warmer',
    'eek',
    'so close',
    'wrong button',
    'hm',
    'nearly',
    'no thank you',
  ],

  /** Everything after yes. */
  finale: {
    headline: 'Yes.',
    line: 'Recorded, witnessed, and entirely non-refundable.',
    /** `{times}` → "once" / "twice" / "seven times". `{n}` → the bare number. */
    tally: 'You tried to say no {times} first. Noted, and forgiven.',
    tallyFirst: 'First ask, no hesitation. Show-off.',
    signoff: 'Happy Valentine’s Day.',
    replay: 'Ask again',
  },

  /** One of the keys in `themes.ts`: midnight · ember · bloom · orbit. */
  theme: 'midnight',

  /** Three synthesised notes when they say yes. No files, no autoplay. */
  chime: true,

  /** Browser tab, and the link preview when you send it. */
  meta: {
    title: 'Will you be my valentine?',
    description: 'A question with only one working answer.',
  },
};
