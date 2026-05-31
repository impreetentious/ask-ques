'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toHash } from '@/ask/codec';
import { ask } from '@/ask/config';
import { THEMES } from '@/ask/themes';
import type { AskConfig, Refusal } from '@/ask/types';
import { ASK_QUES_VERSION } from '@/ask/version';
import styles from './make-form.module.css';

interface Draft {
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

function refusalLines(refusals: readonly Refusal[]): string {
  return refusals
    .map((refusal) => (refusal.note ? `${refusal.no} | ${refusal.note}` : refusal.no))
    .join('\n');
}

function draftFrom(config: AskConfig): Draft {
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

function parseRefusals(value: string): Refusal[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((line) => {
      const separator = line.indexOf('|');
      if (separator === -1) return { no: line };
      const no = line.slice(0, separator).trim();
      const note = line.slice(separator + 1).trim();
      return note ? { no, note } : { no };
    })
    .filter((refusal) => refusal.no !== '');
}

function configFromDraft(draft: Draft): AskConfig {
  const refusals = parseRefusals(draft.refusals);
  return {
    eyebrow: draft.eyebrow,
    question: draft.question.trim() || ask.question,
    note: draft.note,
    yes: draft.yes.trim() || ask.yes,
    refusals: refusals.length > 0 ? refusals : ask.refusals,
    whispers: ask.whispers,
    finale: {
      ...ask.finale,
      headline: draft.headline.trim() || ask.finale.headline,
      line: draft.line.trim() || ask.finale.line,
      signoff: draft.signoff.trim() || ask.finale.signoff,
    },
    theme: draft.theme,
    chime: draft.chime,
    meta: {
      title: draft.question.trim() || ask.meta.title,
      description: ask.meta.description,
    },
  };
}

function rootUrl(hash: string): string {
  const root = window.location.pathname.replace(/\/make\/?$/u, '/') || '/';
  return `${window.location.origin}${root}${hash}`;
}

export function MakeForm() {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(ask));
  const [shareUrl, setShareUrl] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'select'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const config = useMemo(() => configFromDraft(draft), [draft]);
  const hash = useMemo(() => toHash(config), [config]);
  const refusalCount = useMemo(() => parseRefusals(draft.refusals).length, [draft.refusals]);

  useEffect(() => {
    setShareUrl(rootUrl(hash));
    setCopyState('idle');
  }, [hash]);

  const update = <Key extends keyof Draft>(key: Key, value: Draft[Key]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const copy = async (): Promise<void> => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopyState('select');
    }
  };

  const reset = (): void => {
    setDraft(draftFrom(ask));
  };

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

      <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <fieldset className={styles.fieldset}>
          <legend>The question</legend>
          <label className={styles.field}>
            <span>
              Small line above it <em>optional</em>
            </span>
            <input
              value={draft.eyebrow}
              onChange={(event) => update('eyebrow', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Question</span>
            <textarea
              value={draft.question}
              rows={2}
              maxLength={240}
              onChange={(event) => update('question', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>
              Opening line under it <em>optional</em>
            </span>
            <input value={draft.note} onChange={(event) => update('note', event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Yes button</span>
            <input
              value={draft.yes}
              maxLength={80}
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
              Refusals <em>{refusalCount}/24</em>
            </span>
            <textarea
              className={styles.ladder}
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
              value={draft.headline}
              onChange={(event) => update('headline', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Line underneath</span>
            <textarea
              value={draft.line}
              rows={2}
              onChange={(event) => update('line', event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Sign-off</span>
            <input
              value={draft.signoff}
              onChange={(event) => update('signoff', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>The feeling</legend>
          <label className={styles.field}>
            <span>Theme</span>
            <select value={draft.theme} onChange={(event) => update('theme', event.target.value)}>
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
              checked={draft.chime}
              onChange={(event) => update('chime', event.target.checked)}
            />
            <span>Play a small chime when they say yes</span>
          </label>
        </fieldset>
      </form>

      <section className={styles.share} aria-labelledby="share-title">
        <div>
          <p className={styles.eyebrow}>Ready when you are</p>
          <h2 id="share-title">Your shareable link</h2>
        </div>
        <label className={styles.linkField}>
          <span className={styles.srOnly}>Your shareable link</span>
          <input
            ref={inputRef}
            value={shareUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" onClick={() => void copy()}>
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </button>
        </label>
        {copyState === 'select' ? (
          <p className={styles.copyHint}>The link is selected—copy it with your usual shortcut.</p>
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
