'use client';

import Link from 'next/link';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fromHash } from '@/ask/codec';
import { ask } from '@/ask/config';
import { buildLadder, fillTally } from '@/ask/ladder';
import { themeFor } from '@/ask/themes';
import type { AskConfig, EvasionMode, Rung, Theme } from '@/ask/types';
import { ASK_QUES_VERSION } from '@/ask/version';
import { playChime } from '@/engine/chime';
import { Field } from '@/engine/field';
import { useIsomorphicLayoutEffect, useRafLoop, useReducedMotion } from '@/engine/hooks';
import { createBody, deformation, stepFlee, type Body } from '@/engine/physics';
import styles from './ask-machine.module.css';

interface Point {
  x: number;
  y: number;
}

interface Whisper {
  id: number;
  text: string;
  x: number;
  y: number;
}

const MAX_VISIBLE_WHISPERS = 7;
const WHISPER_COOLDOWN = 680;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isKeyboardKey(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey;
}

function readConfigFromHash(fallback: AskConfig): AskConfig {
  return fromHash(window.location.hash, fallback) ?? fallback;
}

function machineStyle(theme: Theme, rung: Rung, yesScale: number): CSSProperties {
  return {
    '--paper': theme.paper,
    '--paper-deep': theme.paperDeep,
    '--ink': theme.ink,
    '--muted': theme.muted,
    '--glow': theme.glow,
    '--accent': theme.accent,
    '--accent-deep': theme.accentDeep,
    '--on-accent': theme.onAccent,
    '--heat': rung.heat,
    '--beat': `${(1.15 - rung.heat * 0.48).toFixed(2)}s`,
    '--yes-scale': yesScale,
    '--ambient-glow': `${8 + rung.heat * 17}%`,
    '--ambient-accent': `${6 + rung.heat * 12}%`,
    '--yes-shadow': `${14 + rung.heat * 23}%`,
    '--yes-hover-shadow': `${24 + rung.heat * 25}%`,
    '--pulse-scale': (1 + 0.0025 + rung.heat * 0.002).toFixed(4),
  } as CSSProperties;
}

export function AskMachine({ initialConfig = ask }: { initialConfig?: AskConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [rungIndex, setRungIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [noPresses, setNoPresses] = useState(0);
  const [yesScale, setYesScale] = useState(1);
  const [noReady, setNoReady] = useState(false);
  const [whispers, setWhispers] = useState<Whisper[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yesButtonRef = useRef<HTMLButtonElement>(null);
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const noSlotRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<Field | null>(null);
  const homeRef = useRef<Point | null>(null);
  const bodyRef = useRef<Body | null>(null);
  const pointerRef = useRef<Point | null>(null);
  const keyboardIntentRef = useRef(false);
  const keyboardFocusRef = useRef(false);
  const whisperLastRef = useRef(0);
  const whisperCursorRef = useRef(0);
  const whisperIdRef = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moveFocusRef = useRef(false);

  const reduced = useReducedMotion();
  const ladder = useMemo(() => buildLadder(config.refusals), [config.refusals]);
  const rung: Rung = ladder[Math.min(rungIndex, ladder.length - 1)] ?? {
    index: 0,
    no: 'No',
    note: '',
    yesScale: 1,
    noScale: 1,
    evasion: 'still',
    heat: 0,
    surrender: true,
  };
  const theme = themeFor(config.theme);
  // The authored opening line belongs to the untouched page. Once the ladder is
  // moving, every rung brings its own.
  const note = rung.index === 0 ? rung.note || config.note : rung.note;

  // A shared link is static HTML plus a hash. Reading it after hydration keeps
  // the server render deterministic while still making the link self-contained.
  useEffect(() => {
    const syncFromHash = (): void => {
      setConfig(readConfigFromHash(initialConfig));
      setRungIndex(0);
      setNoPresses(0);
      setAnswered(false);
      setWhispers([]);
      bodyRef.current = null;
      homeRef.current = null;
      setNoReady(false);
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [initialConfig]);

  // A shared question should also carry its own tab title after the client has
  // unpacked the hash. The default metadata remains in the static document.
  useEffect(() => {
    const applyMetadata = (): void => {
      document.title = config.meta.title;
      const description = document.querySelector('meta[name="description"]');
      description?.setAttribute('content', config.meta.description);
      // The browser chrome follows the theme the link chose, not the built-in one.
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.paper);
    };

    applyMetadata();
    // Next can reconcile the build-time title after this client component. Watch
    // that short head reconciliation window so a hash-backed question retains
    // its own title without changing the static HTML used for the default page.
    const observer = new MutationObserver(() => {
      const description = document.querySelector('meta[name="description"]');
      if (
        document.title !== config.meta.title ||
        description?.getAttribute('content') !== config.meta.description
      ) {
        applyMetadata();
      }
    });
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [config.meta.description, config.meta.title, theme.paper]);

  useEffect(() => {
    const markKeyboard = (event: KeyboardEvent): void => {
      if (isKeyboardKey(event)) keyboardIntentRef.current = true;
    };
    const markPointer = (): void => {
      keyboardIntentRef.current = false;
    };

    window.addEventListener('keydown', markKeyboard, true);
    window.addEventListener('pointerdown', markPointer, true);
    return () => {
      window.removeEventListener('keydown', markKeyboard, true);
      window.removeEventListener('pointerdown', markPointer, true);
    };
  }, []);

  const applyNoTransform = useCallback(
    (body: Body, mode: EvasionMode): void => {
      const button = noButtonRef.current;
      if (!button) return;
      const shape = deformation(body, mode);
      const along = rung.noScale * shape.along;
      const across = rung.noScale * shape.across;
      button.style.transform = [
        `translate3d(${body.x.toFixed(2)}px, ${body.y.toFixed(2)}px, 0)`,
        'translate(-50%, -50%)',
        `rotate(${body.angle.toFixed(4)}rad)`,
        `scale(${along.toFixed(4)}, ${across.toFixed(4)})`,
      ].join(' ');
    },
    [rung.noScale],
  );

  const measureHome = useCallback((): void => {
    const slot = noSlotRef.current;
    const button = noButtonRef.current;
    if (!slot || !button) return;

    const rect = slot.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const home = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    homeRef.current = home;

    const mode = reduced || keyboardFocusRef.current ? 'still' : rung.evasion;
    if (bodyRef.current === null || mode === 'still') bodyRef.current = createBody(home.x, home.y);
    applyNoTransform(bodyRef.current, mode);
    setNoReady(true);
  }, [applyNoTransform, reduced, rung.evasion]);

  useIsomorphicLayoutEffect(() => {
    measureHome();
    const slot = noSlotRef.current;
    const button = noButtonRef.current;
    if (!slot || !button) return;

    const onResize = (): void => measureHome();
    const observer = new ResizeObserver(onResize);
    observer.observe(slot);
    observer.observe(button);
    window.addEventListener('resize', onResize);
    // The button is fixed and its slot is not, so a scroll moves one and not the
    // other. Only reachable on a viewport short enough to scroll, but there the
    // tether would otherwise pull towards a slot that has moved on.
    window.addEventListener('scroll', onResize, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [measureHome]);

  const fitYesButton = useCallback((): void => {
    const button = yesButtonRef.current;
    if (!button) return;
    const available = Math.max(1, window.innerWidth - 40);
    const fitted = Math.min(rung.yesScale, available / Math.max(1, button.offsetWidth));
    const next = clamp(fitted, 0.4, rung.yesScale);
    setYesScale((previous) => (Math.abs(previous - next) < 0.001 ? previous : next));
  }, [rung.yesScale]);

  useIsomorphicLayoutEffect(() => {
    fitYesButton();
    const button = yesButtonRef.current;
    if (!button) return;

    const observer = new ResizeObserver(fitYesButton);
    observer.observe(button);
    window.addEventListener('resize', fitYesButton);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitYesButton);
    };
  }, [fitYesButton]);

  /**
   * What the canvas effect needs to read without being restarted for it. A new
   * `Field` re-seeds every mote, so depending on per-rung values directly would
   * make the whole background jump on each press of No.
   */
  const latestRef = useRef({ measureHome, heat: rung.heat });
  useEffect(() => {
    latestRef.current = { measureHome, heat: rung.heat };
  }, [measureHome, rung.heat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const field = new Field(canvas, { glow: theme.glow, petals: theme.petals, reduced });
    fieldRef.current = field;
    field.setHeat(latestRef.current.heat);
    field.frame(0);

    const resize = (): void => {
      field.resize();
      field.frame(0);
      latestRef.current.measureHome();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      field.dispose();
      if (fieldRef.current === field) fieldRef.current = null;
    };
  }, [reduced, theme.glow, theme.petals]);

  // Escalation reaches the motes too: they rise faster, larger and brighter as
  // the ladder heats up. Cheap, and it is the only thing tying the two layers.
  useEffect(() => {
    fieldRef.current?.setHeat(rung.heat);
  }, [rung.heat]);

  const addWhisper = useCallback(
    (body: Body, radius: number): void => {
      const pointer = pointerRef.current;
      if (reduced || !pointer || config.whispers.length === 0) return;
      if (performance.now() - whisperLastRef.current < WHISPER_COOLDOWN) return;
      if (Math.hypot(pointer.x - body.x, pointer.y - body.y) > radius + 96) return;

      whisperLastRef.current = performance.now();
      const text = config.whispers[whisperCursorRef.current % config.whispers.length];
      whisperCursorRef.current += 1;
      if (!text) return;

      const angle = Math.atan2(body.y - pointer.y, body.x - pointer.x);
      const distance = radius + 18;
      const whisper = {
        id: whisperIdRef.current,
        text,
        x: body.x + Math.cos(angle) * distance,
        y: body.y + Math.sin(angle) * distance,
      };
      whisperIdRef.current += 1;
      setWhispers((current) => [...current.slice(-(MAX_VISIBLE_WHISPERS - 1)), whisper]);
    },
    [config.whispers, reduced],
  );

  useRafLoop((dt, elapsed) => {
    fieldRef.current?.frame(dt);
    if (answered) return;

    const body = bodyRef.current;
    const home = homeRef.current;
    const button = noButtonRef.current;
    if (!body || !home || !button) return;

    const mode = reduced || keyboardFocusRef.current ? 'still' : rung.evasion;
    const radius =
      Math.max(button.offsetWidth, button.offsetHeight) * Math.max(rung.noScale, 0.24) * 0.5 + 8;
    const ceiling = Math.max(radius + 16, Math.min(home.y - 96, window.innerHeight * 0.48));
    const next = stepFlee({
      body,
      home,
      pointer: pointerRef.current,
      bounds: { width: window.innerWidth, height: window.innerHeight, ceiling },
      radius,
      mode,
      t: elapsed,
      dt,
      seed: 0.61803398875,
    });
    bodyRef.current = next;
    applyNoTransform(next, mode);
    if (mode !== 'still') addWhisper(next, radius);
  }, !reduced);

  const clearPointer = useCallback((): void => {
    pointerRef.current = null;
    fieldRef.current?.setPointer(null, null);
  }, []);

  /**
   * A finger has no hover to leave. Without this the button keeps fleeing from
   * the spot it was last tapped, and parks itself off-centre for good.
   */
  const releasePointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (event.pointerType !== 'mouse') clearPointer();
    },
    [clearPointer],
  );

  const trackPointer = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    const pointer = { x: event.clientX, y: event.clientY };
    pointerRef.current = pointer;
    fieldRef.current?.setPointer(pointer.x, pointer.y);
  }, []);

  const finish = useCallback((): void => {
    if (answered) return;
    moveFocusRef.current = true;
    setAnswered(true);
    setWhispers([]);
    if (config.chime) playChime();
    fieldRef.current?.burst(130);
  }, [answered, config.chime]);

  const advanceNo = useCallback((): void => {
    if (rung.surrender) {
      setNoPresses((count) => count + 1);
      finish();
      return;
    }

    setNoPresses((count) => count + 1);
    setRungIndex((index) => Math.min(index + 1, ladder.length - 1));
  }, [finish, ladder.length, rung.surrender]);

  const replay = useCallback((): void => {
    moveFocusRef.current = true;
    setAnswered(false);
    setRungIndex(0);
    setNoPresses(0);
    setWhispers([]);
    bodyRef.current = null;
    keyboardFocusRef.current = false;
    requestAnimationFrame(measureHome);
  }, [measureHome]);

  const holdForKeyboard = useCallback((): void => {
    if (!keyboardIntentRef.current) return;
    keyboardFocusRef.current = true;
    const home = homeRef.current;
    if (!home) return;
    const body = createBody(home.x, home.y);
    bodyRef.current = body;
    applyNoTransform(body, 'still');
  }, [applyNoTransform]);

  const releaseKeyboardHold = useCallback((): void => {
    keyboardFocusRef.current = false;
  }, []);

  /**
   * Answering unmounts the button that was just pressed, which would drop focus
   * to the top of the document and make a keyboard user walk back down. The new
   * headline takes it instead — silently for a mouse, with a ring for a key.
   */
  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    headingRef.current?.focus();
  });

  // The headline is announced by taking focus, so the live region carries the
  // line under it rather than saying the same word twice.
  const liveText = answered
    ? config.finale.line
    : note || 'The question is waiting for your answer.';
  const tally =
    noPresses > 0 ? fillTally(config.finale.tally, noPresses) : config.finale.tallyFirst;

  return (
    <main
      className={styles.machine}
      style={machineStyle(theme, rung, yesScale)}
      onPointerMove={trackPointer}
      onPointerLeave={clearPointer}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
    >
      <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      <div className={styles.topline}>
        <span className={styles.brand}>Ask Ques</span>
        <Link className={styles.makeLink} href="/make">
          Make one
        </Link>
      </div>

      <section className={styles.content} aria-labelledby="question">
        {answered ? (
          <div className={styles.finale}>
            <p className={styles.eyebrow}>The answer has been recorded</p>
            <h1 ref={headingRef} tabIndex={-1} id="question" className={styles.finaleHeadline}>
              {config.finale.headline}
            </h1>
            <p className={styles.finaleLine}>{config.finale.line}</p>
            <p className={styles.tally}>{tally}</p>
            <p className={styles.signoff}>{config.finale.signoff}</p>
            <button type="button" className={styles.replayButton} onClick={replay}>
              {config.finale.replay}
            </button>
          </div>
        ) : (
          <>
            {config.eyebrow ? <p className={styles.eyebrow}>{config.eyebrow}</p> : null}
            <h1 ref={headingRef} tabIndex={-1} id="question" className={styles.question}>
              {config.question}
            </h1>
            <p id="ask-note" className={styles.note} aria-hidden={note === ''}>
              {note || '\u00a0'}
            </p>
            <div className={styles.actionRow}>
              <button
                ref={yesButtonRef}
                type="button"
                className={styles.yesButton}
                onClick={finish}
              >
                {config.yes}
              </button>
              <span ref={noSlotRef} className={styles.noSlot} aria-hidden="true" />
            </div>
          </>
        )}
      </section>

      {!answered ? (
        <button
          ref={noButtonRef}
          type="button"
          className={styles.noButton}
          data-ready={noReady}
          aria-describedby="ask-note"
          onClick={advanceNo}
          onFocus={holdForKeyboard}
          onBlur={releaseKeyboardHold}
        >
          {rung.no}
        </button>
      ) : null}

      <div className={styles.whispers} aria-hidden="true">
        {whispers.map((whisper) => (
          <span
            key={whisper.id}
            className={styles.whisper}
            style={{ left: whisper.x, top: whisper.y }}
            onAnimationEnd={() =>
              setWhispers((current) => current.filter((candidate) => candidate.id !== whisper.id))
            }
          >
            {whisper.text}
          </span>
        ))}
      </div>

      <p className={styles.liveRegion} aria-live="polite" aria-atomic="true">
        {liveText}
      </p>
      <p className={styles.version}>v{ASK_QUES_VERSION}</p>
    </main>
  );
}
