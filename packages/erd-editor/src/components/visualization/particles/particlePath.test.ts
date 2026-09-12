// AC-71: where a particle is at a moment is a pure function of the time and
// the path alone, so a spec fixes t and reads a coordinate, and the loop that
// moves circles in a frame carries no arithmetic of its own.

import { describe, expect, it } from 'vite-plus/test';

import { VIEW_ROUTE_ARC } from '@/utils/draw-relationship';
import { arcPolyline } from '@/utils/draw-relationship/arcCorner';

import {
  ANIMATE_DURATION,
  measurePath,
  PARTICLE_COUNT,
  PARTICLE_EDGE_ALPHA,
  PARTICLE_EDGE_MAX,
  PARTICLE_INTERVAL,
  PARTICLE_RX,
  PARTICLE_RY,
  particleGradient,
  particlePhase,
  pointAlong,
  TANGENT_WINDOW,
  tangentAt,
  withAlpha,
} from './particlePath';

/** A run long enough that a sixth of it is a whole number. */
const RUN = 600;

/** A bent polyline: a hundred across, then fifty down. */
const BEND = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
];

/** Six decimals: the eased distances are irrational where the linear ones were whole. */
const along = (distances: number[]): number[] =>
  distances.map(distance => Math.round(distance * 1e6) / 1e6);

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
  it('stands the six a second of the period apart at t = 0, which the easing makes an uneven distance', () => {
    expect(along(particlePhase(0, RUN))).toEqual([
      0, 566.321508, 460.93511, 300, 139.06489, 33.678492,
    ]);

    // Still a second apart in time: each stands where the one before it stood
    // a second ago. The gaps in distance are what the easing makes uneven,
    // widest at the middle of the run and narrowest at its two ends.
    const now = particlePhase(0, RUN);
    const second = particlePhase(-PARTICLE_INTERVAL, RUN);
    for (let index = 1; index < PARTICLE_COUNT; index++) {
      expect(now[index]).toBe(second[index - 1]);
    }
    expect(now[2] - now[3]).toBeGreaterThan(now[1] - now[2]);
  });

  it('sends the second off the PK end at one second, the first eased a little way along by then', () => {
    expect(along(particlePhase(1_000, RUN))).toEqual([
      33.678492, 0, 566.321508, 460.93511, 300, 139.06489,
    ]);
  });

  it('has the first halfway at three seconds and the fourth just leaving', () => {
    expect(along(particlePhase(3_000, RUN))).toEqual([
      300, 139.06489, 33.678492, 0, 566.321508, 460.93511,
    ]);
  });

  it('leaves the PK end slowly, runs fastest in the middle and slows into the FK end (AC-32)', () => {
    const first = (t: number) => particlePhase(t, RUN)[0];
    const covered = (from: number) => first(from + 1_000) - first(from);

    // Six equal seconds of a six second run: even speed would cover a sixth in
    // each, and the eased run covers a third of that in the first and better
    // than twice it in the middle.
    expect(covered(0)).toBeLessThan(RUN / 6);
    expect(covered(2_500)).toBeGreaterThan(RUN / 6);
    expect(RUN - first(5_000)).toBeCloseTo(covered(0), 6);
    expect(covered(2_500)).toBeGreaterThan(covered(0) * 2);
    expect(first(3_000)).toBe(RUN / 2);
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
    particlePhase(3_000, 60).forEach((distance, index) => {
      expect(distance).toBeCloseTo(particlePhase(3_000, RUN)[index] / 10, 9);
    });
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
    expect(at(4_000).x).toBeCloseTo(100, 6);
    expect(at(4_000).y).toBeCloseTo(15.233778, 6);
    expect(at(5_000).x).toBeCloseTo(100, 6);
    expect(at(5_000).y).toBeCloseTo(41.580377, 6);
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

/** The corner a view bends, measured: a run in, a quarter circle, a run out. */
const BENT = measurePath(
  arcPolyline(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    VIEW_ROUTE_ARC
  )
);

describe('tangentAt (AC-30)', () => {
  it('reads the direction of a straight run, either way round the corner', () => {
    expect(tangentAt(BENT, 40)).toBeCloseTo(0, 9);
    expect(tangentAt(BENT, BENT.length - 40)).toBeCloseTo(90, 9);
  });

  it('turns through the bend without one step of nothing, and none of them wide (AC-30)', () => {
    // Thirty samples from one window before the arc to one window after it.
    // Wider than that and a whole window falls inside a straight run, which
    // reads the same twice over and would pass a per-run measurement too.
    const from = BENT.distances[1] - TANGENT_WINDOW;
    const to = BENT.distances[BENT.distances.length - 2] + TANGENT_WINDOW;
    const samples: number[] = [];
    for (let index = 0; index < 30; index++) {
      samples.push(tangentAt(BENT, from + ((to - from) * index) / 29));
    }

    const steps: number[] = [];
    for (let index = 1; index < samples.length; index++) {
      steps.push(Math.abs(samples[index] - samples[index - 1]));
    }

    // A per-run reading gives twenty-four exact zeros out of these twenty-nine
    // and jumps 22.5 degrees between them. The window measures 4.708 degrees
    // at its widest and 1.158 at its narrowest.
    expect(Math.min(...steps)).toBeGreaterThan(0);
    expect(Math.max(...steps)).toBeLessThan(8);
    expect(Math.max(...steps)).toBeCloseTo(4.708, 2);
    expect(Math.min(...steps)).toBeCloseTo(1.158, 2);
  });

  it('measures one window either side of the point, and reads the path alone', () => {
    // At the first bend point, where the window is exactly one chord either
    // side and lands on the two vertices around it: the quarter turn is cut
    // into four, so the chord through them is the arc's own 22.5 degrees.
    const bend = BENT.distances[2];
    const before = pointAlong(BENT, bend - TANGENT_WINDOW);
    const after = pointAlong(BENT, bend + TANGENT_WINDOW);
    const snapshot = JSON.stringify(BENT);

    const cut = pointAlong(BENT, BENT.distances[1]);
    const third = pointAlong(BENT, BENT.distances[3]);
    expect(before.x).toBeCloseTo(cut.x, 9);
    expect(before.y).toBeCloseTo(cut.y, 9);
    expect(after.x).toBeCloseTo(third.x, 9);
    expect(after.y).toBeCloseTo(third.y, 9);
    expect(tangentAt(BENT, bend)).toBeCloseTo(22.5, 6);
    // A run reading answers one of the two chords meeting there instead.
    expect(tangentAt(BENT, bend)).not.toBeCloseTo(11.25, 6);
    expect(tangentAt(BENT, bend)).not.toBeCloseTo(33.75, 6);
    expect(JSON.stringify(BENT)).toBe(snapshot);
  });

  it('falls to the direction of the run it sits in where the window doubles back on itself', () => {
    const doubled = measurePath([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 0 },
    ]);

    expect(tangentAt(doubled, 2)).toBe(0);
    expect(tangentAt(measurePath([{ x: 7, y: 9 }]), 0)).toBe(0);
  });
});

describe('the particle shape and its fill (AC-30, AC-31)', () => {
  it('is longer along the run than it is thick across it', () => {
    expect(PARTICLE_RX).toBe(5);
    expect(PARTICLE_RY).toBe(1.2);
    expect(PARTICLE_RX / PARTICLE_RY).toBeGreaterThan(4);
  });

  it('fades from its colour at the centre to the same colour at the edge', () => {
    const gradient = particleGradient('#0090ff');

    expect(gradient.fill).toBe('#0090ff');
    expect(gradient.fillPriority).toBe('radial-gradient');
    expect(gradient.fillRadialGradientStartPoint).toEqual({ x: 0, y: 0 });
    expect(gradient.fillRadialGradientStartRadius).toBe(0);
    expect(gradient.fillRadialGradientEndPoint).toEqual({ x: 0, y: 0 });
    expect(gradient.fillRadialGradientEndRadius).toBe(PARTICLE_RY);
    expect(gradient.fillRadialGradientColorStops).toEqual([
      0,
      '#0090ff',
      1,
      '#0090ff66',
    ]);
  });

  it('writes the edge alpha as a channel, and leaves a colour it cannot read alone', () => {
    expect(PARTICLE_EDGE_ALPHA).toBe(0.4);
    expect(withAlpha('#0090ff', 0.4)).toBe('#0090ff66');
    expect(withAlpha('#FFFFFF', 1)).toBe('#FFFFFFff');
    expect(withAlpha('#000000', 0)).toBe('#00000000');
    expect(withAlpha('rgb(0, 144, 255)', 0.4)).toBe('rgb(0, 144, 255)');
  });
});
