'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MAX_REFUSALS, MAX_TEXT, fromHash, pack, unpack, toHash } from '@/ask/codec';
import { ask } from '@/ask/config';
import { THEMES } from '@/ask/themes';
import type { AskConfig, Refusal } from '@/ask/types';
import { ASK_QUES_VERSION } from '@/ask/version';
import styles from './make-form.module.css';

export interface Draft {
  eyebrow: string;
  question: string;
  note: string;
  yes: string;
  refusals: string;
  headline: string;
  line: string;
  signoff: string;
  theme: string;
  chime: boolean;
}

function escapeRow(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|');
}

function refusalLines(refusals: readonly Refusal[]): string {
  return refusals.map(({ no, note }) => `${escapeRow(no)} | ${escapeRow(note ?? '')}`).join('\n');
}

export function draftFrom(config: AskConfig): Draft {
  return {
    eyebrow: config.eyebrow,
    question: config.question,
    note: config.note,
    yes: config.yes,
    refusals: refusalLines(config.refusals),
    headline: config.finale.headline,
    line: config.finale.line,
    signoff: config.finale.signoff,
    theme: config.theme,
    chime: config.chime,
  };
}

function normalize(value: string): string {
  return (
    value
      // oxlint-disable-next-line no-control-regex -- Match codec control normalization.
      .replace(/[\u0000-\u001F\u007F-\u009F]/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

export function parseRefusals(value: string): Refusal[] {
  return value
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const parts = ['', ''];
      let side = 0;
      for (let i = 0; i < line.length; i += 1) {
        const character = line[i] ?? '';
        const next = line[i + 1];
        if (character === '\\' && (next === '\\' || next === '|')) {
          parts[side] += next;
          i += 1;
        } else if (character === '|' && side === 0) side = 1;
        else parts[side] += character;
      }
      return { no: normalize(parts[0] ?? ''), note: normalize(parts[1] ?? '') };
    });
}

export function draftErrors(draft: Draft): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(draft)) {
    if (typeof value !== 'string' || key === 'refusals') continue;
    const text = normalize(value);
    const cap = key === 'theme' ? 32 : MAX_TEXT;
    if (text.length > cap) errors.push(`${key}: ${text.length}/${cap} characters`);
    if (!text && !['eyebrow', 'note'].includes(key)) errors.push(`${key}: required`);
  }
  const rows = parseRefusals(draft.refusals);
  if (!rows.length) errors.push('Refusals: at least one labelled row is required');
  if (rows.length > MAX_REFUSALS) errors.push(`Refusals: ${rows.length}/${MAX_REFUSALS} rows`);
  rows.forEach((row, i) => {
    if (!row.no) errors.push(`Row ${i + 1}: label required`);
    for (const [field, text] of Object.entries(row)) {
      if (text.length > MAX_TEXT)
        errors.push(`Row ${i + 1} ${field}: ${text.length}/${MAX_TEXT} characters`);
    }
  });
  return errors;
}

export function loadQuestion(text: string): AskConfig {
  if (new TextEncoder().encode(text).length > 128 * 1024) throw new Error('Paste exceeds 128 KiB');
  const input = text.trim();
  let hash = input;
  if (!input.startsWith('#')) {
    const url = new URL(input);
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new Error('Use an HTTP(S) question URL');
    hash = url.hash;
  }
  if (!/^#a=[A-Za-z0-9_-]+$/u.test(hash) || hash.length - 3 > 65536) {
    throw new Error('Use one #a= payload, at most 65,536 characters');
  }
  const payload = hash.slice(3).replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='));
  const raw: unknown = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    ),
  );
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Invalid question fields');
  const fields = raw as Record<string, unknown>;
  for (const key of ['e', 'q', 'n', 'y', 't']) {
    const value = fields[key];
    if (
      value !== undefined &&
      (typeof value !== 'string' || normalize(value).length > (key === 't' ? 32 : MAX_TEXT))
    )
      throw new Error(`Invalid ${key} field`);
  }
  for (const [key, count, textCap] of [
    ['w', 24, 40],
    ['f', 6, MAX_TEXT],
    ['m', 2, MAX_TEXT],
  ] as const) {
    const values = fields[key];
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.length > count ||
        values.some(
          (value: unknown) => typeof value !== 'string' || normalize(value).length > textCap,
        ))
    )
      throw new Error(`Invalid ${key} fields`);
  }
  const rows = fields.r;
  if (
    rows !== undefined &&
    (!Array.isArray(rows) ||
      rows.length > MAX_REFUSALS ||
      rows.some(
        (row: unknown) =>
          !Array.isArray(row) ||
          row.length < 1 ||
          row.length > 2 ||
          row.some(
            (value: unknown) => typeof value !== 'string' || normalize(value).length > MAX_TEXT,
          ) ||
          !normalize(row[0] as string),
      ))
  )
    throw new Error('Invalid refusal rows');
  if (fields.c !== undefined && fields.c !== 0 && fields.c !== 1)
    throw new Error('Invalid chime field');
  const config = fromHash(hash, ask);
  if (!config) throw new Error('Invalid or unsupported question link');
  return config;
}

export function configFromDraft(draft: Draft, baseline: AskConfig): AskConfig {
  return {
    ...baseline,
    eyebrow: normalize(draft.eyebrow),
    question: normalize(draft.question),
    note: normalize(draft.note),
    yes: normalize(draft.yes),
    refusals: parseRefusals(draft.refusals),
    finale: {
      ...baseline.finale,
      headline: normalize(draft.headline),
      line: normalize(draft.line),
      signoff: normalize(draft.signoff),
    },
    theme: normalize(draft.theme),
    chime: draft.chime,
    meta: {
      ...baseline.meta,
      title: draft.question === baseline.question ? baseline.meta.title : normalize(draft.question),
    },
  };
}

/**
 * The site root as seen from this page, so a link works at a domain root and at
 * an exported subpath alike. `.html` is matched too: a plain static host serves
 * the exported builder at `/make.html` rather than `/make`.
 */
function rootUrl(hash: string): string {
  const root = window.location.pathname.replace(/\/make(?:\.html)?\/?$/u, '/') || '/';
  return `${window.location.origin}${root}${hash}`;
}

// The page URL stays fixed while editing; the server has no browser location.
const subscribeToLocation = () => () => {};
const readRootUrl = () => rootUrl('');
const serverRootUrl = () => '';

export function MakeForm() {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(ask));
  const [baseline, setBaseline] = useState<AskConfig>(ask);
  const [paste, setPaste] = useState('');
  const [importError, setImportError] = useState('');
  const [pending, setPending] = useState<AskConfig | null>(null);
  const generation = useRef(0);
  const root = useSyncExternalStore(subscribeToLocation, readRootUrl, serverRootUrl);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'select'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const errors = useMemo(() => draftErrors(draft), [draft]);
  const config = useMemo(() => configFromDraft(draft, baseline), [draft, baseline]);
  const preview = useMemo(
    () => (errors.length ? null : unpack(pack(config), ask)),
    [config, errors],
  );
  const hash = useMemo(() => toHash(config), [config]);
  const refusalCount = useMemo(() => parseRefusals(draft.refusals).length, [draft.refusals]);

  const shareUrl = root && !errors.length ? `${root}${hash}` : '';

  const update = <Key extends keyof Draft>(key: Key, value: Draft[Key]): void => {
    generation.current += 1;
    setCopyState('idle');
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const copy = async (): Promise<void> => {
    if (!shareUrl) return;
    const selected = generation.current;
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (selected === generation.current) setCopyState('copied');
    } catch {
      if (selected !== generation.current) return;
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopyState('select');
    }
  };

  const install = (next: AskConfig): void => {
    generation.current += 1;
    setCopyState('idle');
    setBaseline(next);
    setDraft(draftFrom(next));
    setPending(null);
    setImportError('');
  };
  const replace = (next: AskConfig): void => {
    if (JSON.stringify(draft) !== JSON.stringify(draftFrom(baseline))) setPending(next);
    else install(next);
  };
  const reset = (): void => replace(ask);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          Ask Ques
        </Link>
        <span className={styles.kicker}>A question, made shareable</span>
      </header>

      <section className={styles.intro} aria-labelledby="make-title">
        <p className={styles.eyebrow}>No account. No database. No tracking.</p>
        <h1 id="make-title">Make the question yours.</h1>
        <p>
          Your words are packed into the link below. They stay in this browser until you choose to
          send that link.
        </p>
      </section>

      <section className={styles.share} aria-label="Load an existing question">
        <label className={styles.field}>
          Question URL or #a= fragment
          <textarea
            aria-label="Question URL or fragment"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            try {
              replace(loadQuestion(paste));
            } catch (error) {
              setImportError(error instanceof Error ? error.message : String(error));
            }
          }}
        >
          Load question
        </button>
        {importError && <p role="alert">{importError}</p>}
        {pending && (
          <fieldset aria-label="Replace edited question">
            <p>Replace your edited draft?</p>
            <button type="button" onClick={() => install(pending)}>
              Replace draft
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Cancel
            </button>
          </fieldset>
        )}
      </section>
      <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <fieldset className={styles.fieldset}>
          <legend>The question</legend>
          <label className={styles.field}>
            <span>
              Small line above it <em>optional</em>
            </span>
            <input
              aria-label="Small line above it"
              value={draft.eyebrow}
              onChange={(event) => update('eyebrow', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Question</span>
            <textarea
              aria-label="Question"
              value={draft.question}
              rows={2}
              onChange={(event) => update('question', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>
              Opening line under it <em>optional</em>
            </span>
            <input
              aria-label="Opening line under it"
              value={draft.note}
              onChange={(event) => update('note', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Yes button</span>
            <input
              aria-label="Yes button"
              value={draft.yes}
              onChange={(event) => update('yes', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>The no ladder</legend>
          <p className={styles.help}>
            One refusal per line. Add <code>| a note</code> after a label if you want a new line of
            copy at that rung. The final line gives in when it is pressed.
          </p>
          <label className={styles.field}>
            <span>
              Refusals{' '}
              <em>
                {refusalCount}/{MAX_REFUSALS}
              </em>
            </span>
            <textarea
              className={styles.ladder}
              aria-label="Refusals"
              value={draft.refusals}
              rows={11}
              onChange={(event) => update('refusals', event.target.value)}
              spellCheck="true"
            />
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>The ending</legend>
          <label className={styles.field}>
            <span>Big answer</span>
            <input
              aria-label="Big answer"
              value={draft.headline}
              onChange={(event) => update('headline', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Line underneath</span>
            <textarea
              aria-label="Line underneath"
              value={draft.line}
              rows={2}
              onChange={(event) => update('line', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Sign-off</span>
            <input
              aria-label="Sign-off"
              value={draft.signoff}
              onChange={(event) => update('signoff', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>The feeling</legend>
          <label className={styles.field}>
            <span>Theme</span>
            <select
              aria-label="Theme"
              value={draft.theme}
              onChange={(event) => update('theme', event.target.value)}
            >
              {!Object.hasOwn(THEMES, draft.theme) && (
                <option value={draft.theme}>{draft.theme} (unavailable)</option>
              )}
              {Object.entries(THEMES).map(([name, theme]) => (
                <option key={name} value={name}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              aria-label="Play a small chime when they say yes"
              checked={draft.chime}
              onChange={(event) => update('chime', event.target.checked)}
            />
            <span>Play a small chime when they say yes</span>
          </label>
        </fieldset>
      </form>

      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {preview && (
        <section className={styles.share} aria-label="Encoded question preview">
          <p>{preview.eyebrow}</p>
          <h2>{preview.question}</h2>
          <p>{preview.note}</p>
          <p>Yes: {preview.yes}</p>
          <ol>
            {preview.refusals.map((row, index) => (
              <li key={index}>
                {row.no}
                {row.note ? ` | ${row.note}` : ''}
              </li>
            ))}
          </ol>
          <p>
            {preview.finale.headline} · {preview.finale.line} · {preview.finale.signoff}
          </p>
        </section>
      )}
      <section className={styles.share} aria-labelledby="share-title">
        <div>
          <p className={styles.eyebrow}>Ready when you are</p>
          <h2 id="share-title">Your shareable link</h2>
        </div>
        <label className={styles.linkField}>
          <span className={styles.srOnly}>Your shareable link</span>
          <input
            aria-label="Your shareable link"
            ref={inputRef}
            value={shareUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" disabled={!shareUrl} onClick={() => void copy()}>
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </button>
        </label>
        {copyState === 'select' ? (
          <p className={styles.copyHint}>The link is selected; copy it with your usual shortcut.</p>
        ) : null}
        <div className={styles.shareActions}>
          <a
            className={styles.openLink}
            href={shareUrl || undefined}
            target="_blank"
            rel="noreferrer"
          >
            Open your question <span aria-hidden="true">↗</span>
          </a>
          <button type="button" className={styles.reset} onClick={reset}>
            Start over
          </button>
        </div>
      </section>

      <footer className={styles.footer}>Ask Ques · v{ASK_QUES_VERSION}</footer>
    </main>
  );
}
