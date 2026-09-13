import { Group } from 'konva/lib/Group';
import type { Layer } from 'konva/lib/Layer';
import { Circle } from 'konva/lib/shapes/Circle';
import { Stage } from 'konva/lib/Stage';

import type { Point } from '@/internal-types';

import type { ParticleEdge } from './particleEdges';
import {
  PARTICLE_COUNT,
  PARTICLE_RX,
  PARTICLE_RY,
  particleGradient,
  particlePhase,
  pointAlong,
  tangentAt,
} from './particlePath';

/** The time and the frame a loop runs on, so a spec can freeze a phase or count frames. */
export type ParticleClock = {
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
};

/** The clock every shipped loop runs on: wall time and the browser's own animation frame. */
export const particleClock: ParticleClock = {
  now: () => performance.now(),
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: handle => cancelAnimationFrame(handle),
};

export type ParticleLoop = {
  /** The lit connectors to run particles on and the colour to paint them; an empty list clears the layer. */
  setEdges(edges: ParticleEdge[], fill: string): void;
  /** Where the scene layers stand, so the circles land over the connectors they ride. */
  setPlacement(origin: Point, zoomLevel: number): void;
  /** Cancels the frame out, if any, and takes every circle off the layer. */
  stop(): void;
};

/** The name every group of one connector's particles carries, beside the connector's own id. */
export const PARTICLE_GROUP_NAME = 'particle-edge';

/**
 * One requestAnimationFrame loop that owns the drawing of one layer. It runs
 * a frame only while there is something to move or clear, so a scene with
 * nothing lit costs no frame, and the view has one loop for as long as the layer lives.
 */
export function createParticleLoop(
  layer: Layer,
  clock: ParticleClock = particleClock
): ParticleLoop {
  const groups: Array<{ group: Group; circles: Circle[] }> = [];
  const startedAt = clock.now();
  let edges: ParticleEdge[] = [];
  let fill = '';
  let painted = '';
  let origin: Point = { x: 0, y: 0 };
  let zoomLevel = 1;
  let handle: number | null = null;
  let drawn = false;
  let stopped = false;

  const schedule = () => {
    if (handle !== null || stopped) return;
    handle = clock.requestFrame(frame);
  };

  // Added to the layer behind the host's ledger on purpose, and the reason
  // the layer's template must stay childless: a reconcile of this layer would
  // read them as children it never booked and drop every one of them.
  const addGroup = () => {
    const group = new Group({ listening: false });
    const circles: Circle[] = [];
    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const circle = new Circle({
        radius: PARTICLE_RY,
        scaleX: PARTICLE_RX / PARTICLE_RY,
        listening: false,
        ...particleGradient(fill),
      });
      group.add(circle);
      circles.push(circle);
    }
    layer.add(group);
    groups.push({ group, circles });
  };

  const repaint = () => {
    if (fill === painted) return;
    painted = fill;
    const gradient = particleGradient(fill);
    for (const { circles } of groups) {
      for (const circle of circles) circle.setAttrs(gradient);
    }
  };

  const place = () => {
    if (layer.x() !== origin.x || layer.y() !== origin.y) {
      layer.position(origin);
    }
    if (layer.scaleX() !== zoomLevel || layer.scaleY() !== zoomLevel) {
      layer.scale({ x: zoomLevel, y: zoomLevel });
    }
  };

  function frame() {
    handle = null;
    // The gate's own guard: a layer no Stage owns has nowhere to draw, and
    // nothing promises the layer outlives this loop by a frame.
    if (!(layer.getStage() instanceof Stage)) {
      edges.length && schedule();
      return;
    }

    while (groups.length < edges.length) addGroup();
    while (groups.length > edges.length) groups.pop()?.group.destroy();
    repaint();
    place();

    const elapsed = clock.now() - startedAt;
    edges.forEach((edge, index) => {
      const { group, circles } = groups[index];
      const name = `${PARTICLE_GROUP_NAME} ${edge.id}`;
      group.name() === name || group.name(name);

      const distances = particlePhase(elapsed, edge.path.length);
      circles.forEach((circle, at) => {
        circle.position(pointAlong(edge.path, distances[at]));
        circle.rotation(tangentAt(edge.path, distances[at]));
      });
    });

    // Drawn here rather than through batchDraw, which would wait for the next
    // frame after this one, and never through the commit gate, which never
    // learns of this layer.
    layer.draw();
    drawn = edges.length > 0;
    drawn && schedule();
  }

  return {
    setEdges(next, nextFill) {
      if (stopped) return;
      edges = next;
      fill = nextFill;
      (edges.length || drawn) && schedule();
    },
    setPlacement(nextOrigin, nextZoomLevel) {
      if (stopped) return;
      origin = { x: nextOrigin.x, y: nextOrigin.y };
      zoomLevel = nextZoomLevel;
      drawn && schedule();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (handle !== null) {
        clock.cancelFrame(handle);
        handle = null;
      }
      groups.splice(0).forEach(({ group }) => group.destroy());
      edges = [];
      // A layer still on its Stage keeps the last frame until something
      // draws it, so the circles leave the screen with the loop.
      drawn && layer.getStage() instanceof Stage && layer.draw();
      drawn = false;
    },
  };
}
