'use client';

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void): () => void {
  const query = globalThis.matchMedia?.(REDUCED_MOTION);
  if (!query) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function motionSnapshot(): boolean {
  return globalThis.matchMedia?.(REDUCED_MOTION).matches ?? false;
}

/** Server prerender assumes motion is fine; the first client frame corrects it. */
function motionServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, motionSnapshot, motionServerSnapshot);
}

/**
 * `useLayoutEffect` that does not warn during the build-time prerender. The
 * flying button needs its position settled before paint, so plain `useEffect`
 * would show it at the origin for one frame.
 */
export const useIsomorphicLayoutEffect =
  typeof globalThis.document === 'undefined' ? useEffect : useLayoutEffect;

/**
 * A requestAnimationFrame loop with a clamped delta and a monotonic clock.
 *
 * The callback is held in a ref so that changing it — which happens on every
 * state change — does not tear down and restart the loop.
 */
export function useRafLoop(callback: (dt: number, elapsed: number) => void, active: boolean): void {
  const held = useRef(callback);

  useEffect(() => {
    held.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    let last = performance.now();
    let elapsed = 0;

    const tick = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      elapsed += dt;
      held.current(dt, elapsed);
      frame = requestAnimationFrame(tick);
    };

    // Coming back to a backgrounded tab must not deliver one enormous frame.
    const resync = (): void => {
      last = performance.now();
    };

    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', resync);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [active]);
}
