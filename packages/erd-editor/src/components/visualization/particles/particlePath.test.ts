// AC-71: where a particle is at a moment is a pure function of the time and
// the path alone, so a spec fixes t and reads a coordinate, and the loop that
// moves circles in a frame carries no arithmetic of its own.

import { describe, expect, it } from 'vite-plus/test';

import {
  ANIMATE_DURATION,
  measurePath,
  PARTICLE_COUNT,
  PARTICLE_EDGE_MAX,
  PARTICLE_INTERVAL,
  particlePhase,
  pointAlong,
} from './particlePath';

/** A run long enough that a sixth of it is a whole number. */
const RUN = 600;

/** A bent polyline: a hundred across, then fifty down. */
const BEND = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
];

describe('the particle budget (Gap 4)', () => {
  it('runs six a connector, one six second period, a second apart, on sixty connectors at most', () => {
    expect(PARTICLE_COUNT).toBe(6);
    expect(ANIMATE_DURATION).toBe(6_000);
    expect(PARTICLE_INTERVAL).toBe(1_000);
    expect(PARTICLE_EDGE_MAX).toBe(60);
    // Sixty connectors of six is the most circles one frame moves.
    expect(PARTICLE_EDGE_MAX * PARTICLE_COUNT).toBe(360);
  });
});

describe('particlePhase (AC-71)', () => {
  it('stands the six evenly along the run at t = 0, the first at the PK end', () => {
    expect(particlePhase(0, RUN)).toEqual([0, 500, 400, 300, 200, 100]);
  });

  it('sends the second off the PK end at one second, the first a sixth along by then', () => {
    expect(particlePhase(1_000, RUN)).toEqual([100, 0, 500, 400, 300, 200]);
  });

  it('has the first halfway at three seconds and the fourth just leaving', () => {
    expect(particlePhase(3_000, RUN)).toEqual([300, 200, 100, 0, 500, 400]);
  });

  it('sends each particle off the PK end one second after the one before it', () => {
    for (let index = 0; index < PARTICLE_COUNT; index++) {
      expect(particlePhase(index * PARTICLE_INTERVAL, RUN)[index]).toBe(0);
    }
  });

  it('runs toward the FK end through a period and starts over after it', () => {
    let last = -1;
    for (let t = 0; t < ANIMATE_DURATION; t += 250) {
      const [first] = particlePhase(t, RUN);
      expect(first).toBeGreaterThan(last);
      last = first;
    }

    expect(particlePhase(ANIMATE_DURATION, RUN)).toEqual(particlePhase(0, RUN));
    expect(particlePhase(ANIMATE_DURATION * 7 + 1_000, RUN)).toEqual(
      particlePhase(1_000, RUN)
    );
  });

  it('scales with the run, reads a time before the start the same way, and runs nowhere on no run', () => {
    expect(particlePhase(3_000, 60)).toEqual(
      particlePhase(3_000, RUN).map(distance => distance / 10)
    );
    expect(particlePhase(-1_000, RUN)).toEqual(particlePhase(5_000, RUN));
    expect(particlePhase(1_500, 0)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('is pure: the same moment on the same run answers the same distances', () => {
    expect(particlePhase(4_321, 987)).toEqual(particlePhase(4_321, 987));
  });
});

describe('measurePath and pointAlong (AC-71)', () => {
  it('measures a bent polyline point by point', () => {
    const path = measurePath(BEND);

    expect(path.length).toBe(150);
    expect(path.distances).toEqual([0, 100, 150]);
    expect(path.points).toEqual(BEND);
  });

  it('places a distance on the run, through the bend, and clamps past either end', () => {
    const path = measurePath(BEND);

    expect(pointAlong(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(path, 40)).toEqual({ x: 40, y: 0 });
    expect(pointAlong(path, 100)).toEqual({ x: 100, y: 0 });
    expect(pointAlong(path, 125)).toEqual({ x: 100, y: 25 });
    expect(pointAlong(path, 150)).toEqual({ x: 100, y: 50 });
    expect(pointAlong(path, 999)).toEqual({ x: 100, y: 50 });
    expect(pointAlong(path, -5)).toEqual({ x: 0, y: 0 });
  });

  it('carries the first particle from the PK end to the FK end over one period', () => {
    const path = measurePath(BEND);
    const at = (t: number) =>
      pointAlong(path, particlePhase(t, path.length)[0]);

    expect(at(0)).toEqual(BEND[0]);
    expect(at(3_000)).toEqual({ x: 75, y: 0 });
    expect(at(4_000)).toEqual({ x: 100, y: 0 });
    expect(at(5_000)).toEqual({ x: 100, y: 25 });
    expect(at(ANIMATE_DURATION)).toEqual(BEND[0]);
  });

  it('shares nothing with the points it was handed, and hands back fresh points', () => {
    const given = BEND.map(point => ({ ...point }));
    const path = measurePath(given);

    given[0].x = 999;
    expect(path.points[0]).toEqual({ x: 0, y: 0 });

    const first = pointAlong(path, 0);
    first.x = 999;
    expect(pointAlong(path, 0)).toEqual({ x: 0, y: 0 });
    expect(path.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('answers a lone point, a run through a repeated point, and the origin for no path', () => {
    const lone = measurePath([{ x: 7, y: 9 }]);
    expect(lone.length).toBe(0);
    expect(pointAlong(lone, 0)).toEqual({ x: 7, y: 9 });
    expect(pointAlong(lone, 50)).toEqual({ x: 7, y: 9 });

    const repeated = measurePath([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(repeated.distances).toEqual([0, 0, 10]);
    expect(pointAlong(repeated, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(repeated, 5)).toEqual({ x: 5, y: 0 });

    expect(pointAlong(measurePath([]), 3)).toEqual({ x: 0, y: 0 });
  });
});
