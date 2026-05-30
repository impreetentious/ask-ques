import { describe, expect, it } from 'vitest';
import { buildLadder, countWord, fillTally } from '@/ask/ladder';
import { ask } from '@/ask/config';

describe('escalation ladder', () => {
  it('derives monotonic sizes, heat and a surrender rung', () => {
    const ladder = buildLadder(ask.refusals);

    expect(ladder).toHaveLength(ask.refusals.length);
    expect(ladder[0]?.evasion).toBe('still');
    expect(ladder.at(-1)?.evasion).toBe('doomed');
    expect(ladder.at(-1)?.surrender).toBe(true);

    for (let index = 1; index < ladder.length; index += 1) {
      const previous = ladder[index - 1];
      const current = ladder[index];
      expect(current?.yesScale).toBeGreaterThanOrEqual(previous?.yesScale ?? 0);
      expect(current?.noScale).toBeLessThanOrEqual(previous?.noScale ?? Infinity);
      expect(current?.heat).toBeGreaterThanOrEqual(previous?.heat ?? 0);
    }
  });

  it('honours deliberate overrides while retaining the authored copy', () => {
    const ladder = buildLadder([
      { no: 'Perhaps', yesScale: 1.3, noScale: 0.72, evasion: 'panic', surrender: true },
    ]);

    expect(ladder).toEqual([
      expect.objectContaining({
        no: 'Perhaps',
        yesScale: 1.3,
        noScale: 0.72,
        evasion: 'panic',
        surrender: true,
      }),
    ]);
  });

  it('has graceful fallback wording and natural tally text', () => {
    expect(buildLadder([])).toEqual([
      expect.objectContaining({ no: 'No', evasion: 'doomed', surrender: true }),
    ]);
    expect(countWord(1)).toBe('once');
    expect(countWord(2)).toBe('twice');
    expect(fillTally('Tried {times} ({n}).', 4)).toBe('Tried 4 times (4).');
  });
});
