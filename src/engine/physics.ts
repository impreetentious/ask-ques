import type { EvasionMode } from '@/ask/types';

/**
 * The flight of the No button.
 *
 * One pure function, integrated once per frame. No randomness: the wander is two
 * detuned sine pairs driven by elapsed time and a per-button seed, which roams
 * far more convincingly than white noise and — usefully — makes every frame
 * reproducible in tests.
 *
 * Units are pixels and seconds throughout. Mass is 1, so force is acceleration.
 */

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radians. The button leans into its own turns. */
  angle: number;
  /** Angular velocity, used to damp the lean rather than snap it. */
  spin: number;
}

export interface Bounds {
  width: number;
  height: number;
  /**
   * The button will not settle above this line. Without it, a panicking button
   * parks itself on top of the question and nobody can read what they are being
   * asked. A one-sided spring, so it can still fly through on the way past.
   */
  ceiling: number;
}

export interface Tuning {
  /** Distance at which the pointer starts to be felt. */
  repelRadius: number;
  /** Acceleration at zero distance, tapering to nothing at the radius. */
  repelStrength: number;
  /** How much of the escape is sideways rather than straight back. */
  slip: number;
  /** Spring constant pulling it home. Low values let it roam. */
  spring: number;
  /** Exponential velocity decay per second. */
  damping: number;
  maxSpeed: number;
  /** Amplitude of the self-driven roam. */
  wander: number;
  /** Fraction of speed kept when it hits an edge. */
  restitution: number;
}

export const MODE_TUNING: Record<EvasionMode, Tuning> = {
  still: {
    repelRadius: 0,
    repelStrength: 0,
    slip: 0,
    spring: 0,
    damping: 0,
    maxSpeed: 0,
    wander: 0,
    restitution: 0,
  },
  drift: {
    repelRadius: 130,
    repelStrength: 1800,
    slip: 0.35,
    spring: 7,
    damping: 3.4,
    maxSpeed: 700,
    wander: 26,
    restitution: 0.4,
  },
  magnet: {
    repelRadius: 190,
    repelStrength: 5200,
    slip: 0.7,
    spring: 4.5,
    damping: 2.9,
    maxSpeed: 1250,
    wander: 60,
    restitution: 0.5,
  },
  skittish: {
    repelRadius: 260,
    repelStrength: 8000,
    slip: 1,
    spring: 2.2,
    damping: 2.5,
    maxSpeed: 1750,
    wander: 150,
    restitution: 0.55,
  },
  panic: {
    repelRadius: 360,
    repelStrength: 13_000,
    slip: 1.25,
    spring: 0.55,
    damping: 2,
    maxSpeed: 2400,
    wander: 460,
    restitution: 0.62,
  },
  doomed: {
    repelRadius: 0,
    repelStrength: 0,
    slip: 0,
    spring: 42,
    damping: 5,
    maxSpeed: 520,
    wander: 240,
    restitution: 0.3,
  },
};

export interface FleeInput {
  body: Body;
  /** Where its layout slot is. The spring pulls here. */
  home: { x: number; y: number };
  /** Null when there is no pointer on screen — untouched, it still roams. */
  pointer: { x: number; y: number } | null;
  bounds: Bounds;
  /** Half-extent used for edge collision, so it never clips off screen. */
  radius: number;
  mode: EvasionMode;
  /** Seconds since the page settled. Drives the wander. */
  t: number;
  dt: number;
  /** Per-button constant so two buttons would not roam in lockstep. */
  seed: number;
}

/** A long frame must not teleport the button through a wall. */
const MAX_DT = 1 / 30;

/** Below this the repulsion direction is meaningless, so it gets a nudge instead. */
const MIN_DISTANCE = 0.001;

/** Maximum lean, radians. Beyond this it reads as broken rather than lively. */
const MAX_LEAN = 0.42;

export function createBody(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, angle: 0, spin: 0 };
}

/**
 * Chooses which way round the pointer to slip: whichever side leaves more room
 * before the nearest edge. This is the difference between a button that dodges
 * and a button that can be herded into a corner and trapped.
 */
function slipSign(
  bx: number,
  by: number,
  nx: number,
  ny: number,
  bounds: Bounds,
  probe: number,
): number {
  const clearance = (sx: number, sy: number): number => {
    const px = bx + sx * probe;
    const py = by + sy * probe;
    return Math.min(px, bounds.width - px, py, bounds.height - py);
  };
  // Perpendiculars to (nx, ny), one each way.
  return clearance(-ny, nx) >= clearance(ny, -nx) ? 1 : -1;
}

export function stepFlee(input: FleeInput): Body {
  const { body, home, pointer, bounds, radius, mode, seed } = input;
  const tuning = MODE_TUNING[mode];

  if (mode === 'still') {
    return { x: home.x, y: home.y, vx: 0, vy: 0, angle: 0, spin: 0 };
  }

  const dt = Math.min(Math.max(input.dt, 0), MAX_DT);
  const t = input.t;

  let ax = 0;
  let ay = 0;

  // ── Pointer repulsion, plus the sideways slip ──────────────────────────────
  if (pointer && tuning.repelRadius > 0) {
    const dx = body.x - pointer.x;
    const dy = body.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < tuning.repelRadius) {
      // Directly on top of the pointer there is no direction to flee, so pick one.
      const safe = Math.max(distance, MIN_DISTANCE);
      const nx = distance < MIN_DISTANCE ? 1 : dx / safe;
      const ny = distance < MIN_DISTANCE ? 0 : dy / safe;
      const falloff = Math.pow(1 - distance / tuning.repelRadius, 1.6);
      const push = tuning.repelStrength * falloff;
      const sign = slipSign(body.x, body.y, nx, ny, bounds, tuning.repelRadius);

      ax += push * (nx + tuning.slip * sign * -ny);
      ay += push * (ny + tuning.slip * sign * nx);
    }
  }

  // ── Tether ─────────────────────────────────────────────────────────────────
  ax += (home.x - body.x) * tuning.spring;
  ay += (home.y - body.y) * tuning.spring;

  // ── Self-driven roam: two detuned sines per axis, so it never repeats ──────
  if (tuning.wander > 0) {
    ax += tuning.wander * (Math.sin(t * 1.7 + seed) * 0.6 + Math.sin(t * 0.53 + seed * 2.3) * 0.4);
    ay +=
      tuning.wander *
      (Math.cos(t * 1.31 + seed * 1.7) * 0.6 + Math.cos(t * 0.61 + seed * 0.9) * 0.4);
  }

  // ── Keep clear of the question ─────────────────────────────────────────────
  if (body.y < bounds.ceiling) {
    ay += (bounds.ceiling - body.y) * 6;
  }

  // ── Integrate ──────────────────────────────────────────────────────────────
  let vx = body.vx + ax * dt;
  let vy = body.vy + ay * dt;

  const decay = Math.exp(-tuning.damping * dt);
  vx *= decay;
  vy *= decay;

  const speed = Math.hypot(vx, vy);
  if (speed > tuning.maxSpeed && speed > 0) {
    const scale = tuning.maxSpeed / speed;
    vx *= scale;
    vy *= scale;
  }

  let x = body.x + vx * dt;
  let y = body.y + vy * dt;

  // ── Walls ──────────────────────────────────────────────────────────────────
  const minX = radius;
  const maxX = Math.max(radius, bounds.width - radius);
  const minY = radius;
  const maxY = Math.max(radius, bounds.height - radius);

  if (x < minX) {
    x = minX;
    vx = Math.abs(vx) * tuning.restitution;
  } else if (x > maxX) {
    x = maxX;
    vx = -Math.abs(vx) * tuning.restitution;
  }
  if (y < minY) {
    y = minY;
    vy = Math.abs(vy) * tuning.restitution;
  } else if (y > maxY) {
    y = maxY;
    vy = -Math.abs(vy) * tuning.restitution;
  }

  // ── Lean into the turn ─────────────────────────────────────────────────────
  const target =
    tuning.maxSpeed > 0
      ? Math.max(-MAX_LEAN, Math.min(MAX_LEAN, (vx / tuning.maxSpeed) * MAX_LEAN * 2.4))
      : 0;
  const spin = (body.spin + (target - body.angle) * 26 * dt) * Math.exp(-9 * dt);
  const angle = body.angle + spin * dt;

  return { x, y, vx, vy, angle, spin };
}

/**
 * Squash and stretch, derived from velocity rather than stored. Returned as a
 * pair of scale factors along and across the direction of travel.
 */
export function deformation(body: Body, mode: EvasionMode): { along: number; across: number } {
  const max = MODE_TUNING[mode].maxSpeed;
  if (max <= 0) return { along: 1, across: 1 };
  const t = Math.min(1, Math.hypot(body.vx, body.vy) / max);
  return { along: 1 + t * 0.18, across: 1 - t * 0.12 };
}
