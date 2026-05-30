/**
 * The canvas layer: drifting motes behind everything, and the burst after yes.
 *
 * Both live in one system because they share the expensive part — pre-rendered
 * sprites. Compositing 70 cached bitmaps per frame costs a fraction of building
 * 70 radial gradients per frame, which is what the naive version does and why
 * those pages heat up a laptop.
 */

const MOTE_COUNT = 70;
const MOTE_SPRITE = 64;
const PETAL_SPRITE = 56;
const MAX_PETALS = 260;

/** Gravity on the burst, px/s². Light enough to hang, heavy enough to land. */
const PETAL_GRAVITY = 780;
const PETAL_DRAG = 0.7;

const HEART =
  'M50,86 C24,66 10,52 10,36 C10,22 20,12 33,12 C41,12 47,16 50,22 ' +
  'C53,16 59,12 67,12 C80,12 90,22 90,36 C90,52 76,66 50,86 Z';

export interface FieldOptions {
  /** Colour of the ambient motes. */
  glow: string;
  /** Colours in the burst. */
  petals: readonly string[];
  /** Under reduced motion nothing animates: one still frame, and no burst. */
  reduced: boolean;
}

interface Mote {
  x: number;
  y: number;
  /** Depth, 0.25 (far, small, dim, slow) to 1 (near). */
  z: number;
  r: number;
  phase: number;
  speed: number;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  /** Rotation of the imaginary third axis. Its cosine becomes a horizontal squash. */
  flip: number;
  flipSpeed: number;
  scale: number;
  life: number;
  maxLife: number;
  sprite: HTMLCanvasElement;
}

function sprite(size: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx);
  return canvas;
}

function moteSprite(colour: string): HTMLCanvasElement {
  return sprite(MOTE_SPRITE, (ctx) => {
    const half = MOTE_SPRITE / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(0.35, colour);
    gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, MOTE_SPRITE, MOTE_SPRITE);
  });
}

function petalSprite(colour: string): HTMLCanvasElement {
  return sprite(PETAL_SPRITE, (ctx) => {
    const scale = PETAL_SPRITE / 100;
    const heart = new Path2D(HEART);
    ctx.scale(scale, scale);
    ctx.fillStyle = colour;
    ctx.save();
    ctx.clip(heart);
    ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
  });
}

export class Field {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly options: FieldOptions;
  private readonly motes: Mote[] = [];
  private readonly petals: Petal[] = [];
  private moteImage: HTMLCanvasElement;
  private petalImages: HTMLCanvasElement[];

  private width = 0;
  private height = 0;
  private pointerX: number | null = null;
  private pointerY: number | null = null;
  private heat = 0;
  private clock = 0;

  constructor(canvas: HTMLCanvasElement, options: FieldOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options;
    this.moteImage = moteSprite(options.glow);
    this.petalImages = options.petals.map((colour) => petalSprite(colour));
    this.resize();
  }

  resize(): void {
    const { canvas, ctx } = this;
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    // Beyond 2× the extra pixels are invisible and the fill cost is real.
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(this.width * dpr);
    canvas.height = Math.round(this.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seed();
  }

  /** Lays out the motes. Re-run on resize so density follows the viewport. */
  private seed(): void {
    this.motes.length = 0;
    const count = Math.round(MOTE_COUNT * Math.min(1.4, Math.max(0.5, this.width / 1200)));
    for (let i = 0; i < count; i += 1) {
      this.motes.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z: 0.25 + Math.random() * 0.75,
        r: 5 + Math.random() * 26,
        phase: Math.random() * Math.PI * 2,
        speed: 8 + Math.random() * 26,
      });
    }
  }

  setPointer(x: number | null, y: number | null): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  setHeat(heat: number): void {
    this.heat = Math.min(1, Math.max(0, heat));
  }

  /** Throws a burst from just above centre. No-op under reduced motion. */
  burst(count: number): void {
    if (this.options.reduced || this.petalImages.length === 0) return;
    const room = MAX_PETALS - this.petals.length;
    const total = Math.min(count, room);
    const originX = this.width / 2;
    const originY = this.height * 0.46;

    for (let i = 0; i < total; i += 1) {
      // Biased upward: a full circle looks like an explosion, a fan looks like joy.
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const speed = 420 + Math.random() * 1180;
      const image = this.petalImages[i % this.petalImages.length];
      if (!image) continue;
      const maxLife = 3.2 + Math.random() * 2.4;
      this.petals.push({
        x: originX + (Math.random() - 0.5) * 120,
        y: originY + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 7,
        flip: Math.random() * Math.PI * 2,
        flipSpeed: 1.6 + Math.random() * 4.2,
        scale: 0.32 + Math.random() * 0.85,
        life: maxLife,
        maxLife,
        sprite: image,
      });
    }
  }

  frame(dt: number): void {
    const { ctx } = this;
    if (!ctx) return;
    const step = this.options.reduced ? 0 : Math.min(dt, 1 / 30);
    this.clock += step;

    ctx.clearRect(0, 0, this.width, this.height);
    this.drawMotes(ctx, step);
    this.drawPetals(ctx, step);
  }

  private drawMotes(ctx: CanvasRenderingContext2D, dt: number): void {
    const rise = 1 + this.heat * 0.8;
    const parallaxX = this.pointerX === null ? 0 : this.pointerX - this.width / 2;
    const parallaxY = this.pointerY === null ? 0 : this.pointerY - this.height / 2;

    ctx.globalCompositeOperation = 'lighter';
    for (const mote of this.motes) {
      if (dt > 0) {
        mote.y -= mote.speed * mote.z * rise * dt;
        mote.x += Math.sin(this.clock * 0.4 + mote.phase) * 14 * mote.z * dt;
        if (mote.y < -mote.r * 2) {
          mote.y = this.height + mote.r * 2;
          mote.x = Math.random() * this.width;
        }
      }
      const size = mote.r * mote.z * (1 + this.heat * 0.25) * 2;
      const x = mote.x + parallaxX * mote.z * 0.022;
      const y = mote.y + parallaxY * mote.z * 0.012;
      ctx.globalAlpha = (0.05 + mote.z * 0.13) * (1 + this.heat * 0.5);
      ctx.drawImage(this.moteImage, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawPetals(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.petals.length - 1; i >= 0; i -= 1) {
      const petal = this.petals[i];
      if (!petal) continue;

      if (dt > 0) {
        petal.vy += PETAL_GRAVITY * dt;
        const drag = Math.exp(-PETAL_DRAG * dt);
        petal.vx *= drag;
        petal.vy *= drag;
        petal.x += petal.vx * dt;
        petal.y += petal.vy * dt;
        petal.rot += petal.spin * dt;
        petal.flip += petal.flipSpeed * dt;
        petal.life -= dt;
      }

      if (petal.life <= 0 || petal.y > this.height + 120) {
        this.petals.splice(i, 1);
        continue;
      }

      const size = PETAL_SPRITE * petal.scale;
      // The last stretch of life fades, so nothing pops out of existence.
      ctx.globalAlpha = Math.min(1, petal.life / Math.min(1.1, petal.maxLife));
      ctx.save();
      ctx.translate(petal.x, petal.y);
      ctx.rotate(petal.rot);
      // Squashing one axis by the cosine of an imaginary spin reads as a tumble.
      ctx.scale(Math.max(0.12, Math.abs(Math.cos(petal.flip))), 1);
      ctx.drawImage(petal.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** True while there is still something moving worth a frame for. */
  get busy(): boolean {
    return this.petals.length > 0;
  }

  dispose(): void {
    this.motes.length = 0;
    this.petals.length = 0;
    this.moteImage.width = 0;
    this.petalImages = [];
    this.moteImage = document.createElement('canvas');
  }
}
