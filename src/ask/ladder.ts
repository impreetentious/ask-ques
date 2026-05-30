import type { EvasionMode, Refusal, Rung } from './types';

/**
 * Turns the authored ladder — a list of two-string rungs — into fully resolved
 * ones. The point of deriving rather than authoring the numbers is that the edit
 * surface stays verbal: add a line, and the curve reshapes around it.
 */

/** Yes grows superlinearly, so the last third of the ladder feels like a landslide. */
const YES_GAIN = 2.1;
const YES_CURVE = 1.35;

/** No shrinks nearly linearly — a sublinear curve reads as sudden and mean. */
const NO_LOSS = 0.82;
const NO_CURVE = 0.9;

/** Floor on the No button so it stays a legible, tappable target to the end. */
const MIN_NO_SCALE = 0.16;

/** A ladder must exist even if someone empties the array. */
const FALLBACK: Refusal = { no: 'No' };

/**
 * Escalation thresholds over normalised ladder position. The last rung is always
 * `doomed` regardless — it is the one that gives in.
 */
function modeFor(p: number, isLast: boolean): EvasionMode {
  if (isLast) return 'doomed';
  if (p <= 0) return 'still';
  if (p < 0.3) return 'drift';
  if (p < 0.55) return 'magnet';
  if (p < 0.8) return 'skittish';
  return 'panic';
}

export function buildLadder(refusals: readonly Refusal[]): Rung[] {
  const source = refusals.length > 0 ? refusals : [FALLBACK];
  const last = source.length - 1;

  return source.map((refusal, index) => {
    // A one-rung ladder has no progression to normalise; it sits at the end.
    const p = last === 0 ? 1 : index / last;
    const isLast = index === last;

    return {
      index,
      no: refusal.no,
      note: refusal.note ?? '',
      yesScale: refusal.yesScale ?? 1 + YES_GAIN * Math.pow(p, YES_CURVE),
      noScale: Math.max(MIN_NO_SCALE, refusal.noScale ?? 1 - NO_LOSS * Math.pow(p, NO_CURVE)),
      evasion: refusal.evasion ?? modeFor(p, isLast),
      heat: p,
      surrender: refusal.surrender ?? isLast,
    };
  });
}

/** English counting for the finale tally. Falls back to digits past three. */
export function countWord(n: number): string {
  if (n === 1) return 'once';
  if (n === 2) return 'twice';
  if (n === 3) return 'three times';
  return `${n} times`;
}

/** Fills `{n}` and `{times}` in a tally line. */
export function fillTally(template: string, n: number): string {
  return template.replaceAll('{times}', countWord(n)).replaceAll('{n}', String(n));
}
