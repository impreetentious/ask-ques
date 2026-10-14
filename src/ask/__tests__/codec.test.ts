import {
  configFromDraft,
  draftFrom,
  draftErrors,
  loadQuestion,
  parseRefusals,
} from '@/ui/make-form';
import { describe, expect, it } from 'vitest';
import { MAX_REFUSALS, fromHash, toHash, unpack } from '@/ask/codec';
import { ask } from '@/ask/config';
import type { AskConfig } from '@/ask/types';

function customQuestion(): AskConfig {
  return {
    ...ask,
    eyebrow: 'Para Priya',
    question: '¿Quieres tomar café conmigo? ☕',
    note: 'No pressure. Except for the very tiny button.',
    yes: 'Claro',
    refusals: [
      { no: 'No' },
      { no: 'Todavía no', note: 'Entiendo. El botón no tanto.' },
      { no: 'fine, yes', note: 'A reasonable conclusion.' },
    ],
    whispers: ['casi', 'otra vez'],
    finale: {
      ...ask.finale,
      headline: 'Perfecto.',
      line: 'Café pronto.',
    },
    theme: 'orbit',
    chime: false,
    meta: {
      title: 'Café?',
      description: 'A little coffee question.',
    },
  };
}

describe('question hash codec', () => {
  it('round-trips a unicode question without a network-sized payload', () => {
    const config = customQuestion();
    const hash = toHash(config);

    expect(hash).toMatch(/^#a=[A-Za-z0-9_-]+$/u);
    expect(fromHash(hash, ask)).toEqual(config);
  });

  it('rejects malformed and incompatible input without throwing', () => {
    expect(unpack('not base64url', ask)).toBeNull();
    expect(fromHash('#a=', ask)).toBeNull();
    expect(fromHash('#else=entirely', ask)).toBeNull();
    expect(fromHash('#a=eyJ2IjoyfQ', ask)).toBeNull();
  });

  it('flattens multi-line input to one line without joining words', () => {
    const decoded = fromHash(
      toHash({
        ...ask,
        question: 'Two lines,\nnot one word',
        note: '  spaced\tout  ',
        finale: { ...ask.finale, line: 'Line one.\r\nLine two.' },
      }),
      ask,
    );

    expect(decoded?.question).toBe('Two lines, not one word');
    expect(decoded?.note).toBe('spaced out');
    expect(decoded?.finale.line).toBe('Line one. Line two.');
  });

  it('caps a link that arrives with more rungs than the ladder allows', () => {
    const decoded = fromHash(
      toHash({
        ...ask,
        refusals: Array.from({ length: MAX_REFUSALS + 6 }, (_, index) => ({ no: `no ${index}` })),
      }),
      ask,
    );

    expect(decoded?.refusals).toHaveLength(MAX_REFUSALS);
    expect(decoded?.refusals.at(-1)?.no).toBe(`no ${MAX_REFUSALS - 1}`);
  });

  it('uses safe fallbacks for missing optional content', () => {
    const hash = toHash({
      ...ask,
      question: 'Will this still work?',
      refusals: [],
      whispers: [],
      yes: '',
      finale: { ...ask.finale, headline: '' },
    });
    const decoded = fromHash(hash, ask);

    expect(decoded?.question).toBe('Will this still work?');
    expect(decoded?.refusals).toEqual(ask.refusals);
    expect(decoded?.whispers).toEqual(ask.whispers);
    expect(decoded?.yes).toBe(ask.yes);
    expect(decoded?.finale.headline).toBe(ask.finale.headline);
  });
});

describe('lossless builder imports', () => {
  it('preserves escaped rows, unknown themes and hidden metadata until the question changes', () => {
    const custom = customQuestion();
    custom.refusals = [{ no: 'no | maybe \\later', note: 'pipe | and \\slash' }];
    custom.theme = 'unlisted';
    custom.meta.title = 'An unchanged custom title';
    const baseline = loadQuestion(`https://example.com/${toHash(custom)}`);
    const draft = draftFrom(baseline);
    expect(draftErrors(draft)).toEqual([]);
    expect(configFromDraft(draft, baseline)).toEqual(baseline);
    expect(fromHash(toHash(configFromDraft(draft, baseline)), ask)).toEqual(baseline);
    expect(configFromDraft({ ...draft, question: 'Edited question' }, baseline).meta.title).toBe(
      'Edited question',
    );
  });
  it('counts every row and reports every malformed row without deleting the draft', () => {
    const draft = draftFrom(ask);
    draft.refusals = Array.from({ length: 25 }, (_, i) => `row ${i}`).join('\r\n');
    expect(parseRefusals(draft.refusals)).toHaveLength(25);
    expect(draftErrors(draft)).toContain('Refusals: 25/24 rows');
    draft.refusals = ' | note\nlabel | ';
    expect(draftErrors(draft)).toContain('Row 1: label required');
    draft.refusals = ' \n';
    expect(draftErrors(draft)).toContain('Refusals: at least one labelled row is required');
  });
  it('normalizes Unicode and controls before validating complete values', () => {
    const draft = draftFrom(ask);
    draft.refusals = ` ${'é'.repeat(240)} | \n`;
    draft.eyebrow = '';
    draft.note = '';
    expect(draftErrors(draft)).toEqual([]);
    draft.refusals = `${'é'.repeat(241)} | note`;
    expect(draftErrors(draft)).toContain('Row 1 no: 241/240 characters');
    draft.question = '';
    expect(draftErrors(draft)).toContain('question: required');
  });
  it('refuses protocols, fragment extras, invalid versions and both paste caps', () => {
    for (const input of [
      '',
      'file:///tmp/#a=abc',
      '#a=abc&x=1',
      '#a=abc',
      '#a=' + 'A'.repeat(65537),
      ' '.repeat(128 * 1024 + 1),
    ]) {
      expect(() => loadQuestion(input)).toThrow();
    }
    expect(loadQuestion(`  ${toHash(ask)}  `)).toEqual(fromHash(toHash(ask), ask));
  });
});
