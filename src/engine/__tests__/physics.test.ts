import { describe, expect, it } from 'vitest';
import { createBody, stepFlee } from '@/engine/physics';

const bounds = { width: 800, height: 600, ceiling: 170 };
const home = { x: 400, y: 390 };

describe('No-button physics', () => {
  it('pins a still body exactly to its layout anchor', () => {
    const next = stepFlee({
      body: { ...createBody(10, 20), vx: 80, vy: -40, angle: 0.3, spin: 2 },
      home,
      pointer: { x: 390, y: 380 },
      bounds,
      radius: 30,
      mode: 'still',
      t: 0,
      dt: 1 / 60,
      seed: 1,
    });

    expect(next).toEqual({ x: home.x, y: home.y, vx: 0, vy: 0, angle: 0, spin: 0 });
  });

  it('moves away from a nearby pointer and stays inside its bounds', () => {
    const body = createBody(400, 390);
    const next = stepFlee({
      body,
      home,
      pointer: { x: 370, y: 390 },
      bounds,
      radius: 34,
      mode: 'magnet',
      t: 0,
      dt: 1 / 30,
      seed: 1,
    });

    expect(next.x).toBeGreaterThan(body.x);
    expect(next.x).toBeGreaterThanOrEqual(34);
    expect(next.x).toBeLessThanOrEqual(bounds.width - 34);
    expect(next.y).toBeGreaterThanOrEqual(34);
    expect(next.y).toBeLessThanOrEqual(bounds.height - 34);
  });

  it('is deterministic and never tunnels out during a panic run', () => {
    const run = (): ReturnType<typeof createBody> => {
      let body = createBody(home.x, home.y);
      for (let frame = 0; frame < 600; frame += 1) {
        body = stepFlee({
          body,
          home,
          pointer: frame % 3 === 0 ? { x: 405, y: 390 } : null,
          bounds,
          radius: 38,
          mode: 'panic',
          t: frame / 60,
          dt: frame % 17 === 0 ? 1 : 1 / 60,
          seed: 0.61803398875,
        });
        expect(body.x).toBeGreaterThanOrEqual(38);
        expect(body.x).toBeLessThanOrEqual(bounds.width - 38);
        expect(body.y).toBeGreaterThanOrEqual(38);
        expect(body.y).toBeLessThanOrEqual(bounds.height - 38);
      }
      return body;
    };

    expect(run()).toEqual(run());
  });
});
