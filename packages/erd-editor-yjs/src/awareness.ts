import type { Awareness } from 'y-protocols/awareness';

import { isFollowing, isTracker, TRACKER_TYPES } from '@/classify';
import { copyJson, isRecord } from '@/json';
import type { CollaborationPort, PortAction } from '@/port';

export const AWARENESS_FIELD = 'erd';

/** Where the sender looks: its origin, zoom and tab, which nothing reads yet. */
export type Screen = {
  origin: { x: number; y: number };
  zoom: number;
  canvasType: string;
};

/** The binding's field in its Awareness state. */
export type PresenceState = {
  editorId: string;
  nickname: string;
  /** The last action of each tracker the store sent, as it sent it. */
  trackers: Partial<Record<string, PortAction>>;
  /**
   * How many times each tracker went out, so one sent again as it was, the
   * heartbeat its expiry waits on, still reaches the others.
   */
  beats: Partial<Record<string, number>>;
  screen: Screen;
  compactor?: true;
};

export type Presence = {
  /** Takes the trackers, the screen and the sender's name off an outbound batch. */
  publish: (actions: PortAction[]) => void;
  setScreen: (screen: Screen) => void;
  /** Takes the state out of the election among compactors. */
  withdraw: () => void;
  /** Clears this binding's field and stops listening; another editor's cursor stays to its expiry. */
  destroy: () => void;
};

export type PresenceOptions = {
  screen: Screen;
  /** Marks the state as a compacting binding's, for the election among them. */
  compactor?: boolean;
};

const DEFAULT_SCREEN: Screen = {
  origin: { x: 0, y: 0 },
  zoom: 1,
  canvasType: 'ERD',
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** The screen a value opens on, the settings it saves, or the default where it holds none. */
export function screenOf(runtimeValue: string): Screen {
  let settings: unknown;
  try {
    settings = (JSON.parse(runtimeValue) as { settings?: unknown })?.settings;
  } catch {
    return DEFAULT_SCREEN;
  }
  if (!isRecord(settings)) return DEFAULT_SCREEN;

  const { originX, originY, zoomLevel, canvasType } = settings;
  return {
    origin:
      isFiniteNumber(originX) && isFiniteNumber(originY)
        ? { x: originX, y: originY }
        : DEFAULT_SCREEN.origin,
    zoom: isFiniteNumber(zoomLevel) ? zoomLevel : DEFAULT_SCREEN.zoom,
    canvasType:
      typeof canvasType === 'string' ? canvasType : DEFAULT_SCREEN.canvasType,
  };
}

/** The screen after one of the five viewport and tab actions, the steps added where they stand. */
export function nextScreen(
  screen: Screen,
  { type, payload }: PortAction
): Screen {
  const value = isRecord(payload) ? payload : {};
  const { origin, zoom } = screen;

  switch (type) {
    case 'settings.scrollTo':
      return isFiniteNumber(value.originX) && isFiniteNumber(value.originY)
        ? { ...screen, origin: { x: value.originX, y: value.originY } }
        : screen;
    case 'settings.streamScrollTo':
      return isFiniteNumber(value.movementX) && isFiniteNumber(value.movementY)
        ? {
            ...screen,
            origin: {
              x: origin.x + value.movementX,
              y: origin.y + value.movementY,
            },
          }
        : screen;
    case 'settings.changeZoomLevel':
      return isFiniteNumber(value.value)
        ? { ...screen, zoom: value.value }
        : screen;
    case 'settings.streamZoomLevel':
      return isFiniteNumber(value.value)
        ? { ...screen, zoom: zoom + value.value }
        : screen;
    case 'settings.changeCanvasType':
      return typeof value.value === 'string'
        ? { ...screen, canvasType: value.value }
        : screen;
    default:
      return screen;
  }
}

const isPresenceState = (value: unknown): value is PresenceState =>
  isRecord(value) &&
  typeof value.editorId === 'string' &&
  value.editorId !== '' &&
  isRecord(value.trackers);

type RemotePresence = { editorId: string; seen: Record<string, string> };

/**
 * Carries the store's presence through Awareness, never the log: its trackers
 * out, the others' trackers in each time they are sent, and a client that
 * leaves, by the editor id it showed, forgotten at once rather than at its expiry.
 */
export function createPresence(
  awareness: Awareness,
  port: CollaborationPort,
  options: PresenceOptions
): Presence {
  const remote = new Map<number, RemotePresence>();
  let local: PresenceState = {
    editorId: port.editorId() ?? '',
    nickname: '',
    trackers: {},
    beats: {},
    screen: options.screen,
    ...(options.compactor ? { compactor: true as const } : {}),
  };

  const write = () => awareness.setLocalStateField(AWARENESS_FIELD, local);

  const leave = (clientId: number) => {
    const known = remote.get(clientId);
    if (!known) return;
    remote.delete(clientId);
    // An element bound again to another Y.Doc of the room shows its id from a
    // new client, which may arrive before the old one goes.
    for (const other of remote.values()) {
      if (other.editorId === known.editorId) return;
    }
    port.forgetPeer(known.editorId);
  };

  const take = (clientId: number, value: unknown) => {
    if (!isPresenceState(value)) {
      leave(clientId);
      return;
    }
    if (remote.get(clientId)?.editorId !== value.editorId) leave(clientId);

    const known = remote.get(clientId) ?? {
      editorId: value.editorId,
      seen: {},
    };
    remote.set(clientId, known);

    const beats = isRecord(value.beats) ? value.beats : {};
    const fresh: PortAction[] = [];
    for (const type of TRACKER_TYPES) {
      const action = value.trackers[type];
      if (!isRecord(action) || action.type !== type) continue;

      const sent = JSON.stringify([beats[type], action]);
      if (known.seen[type] === sent) continue;
      known.seen[type] = sent;
      fresh.push(action);
    }
    if (fresh.length) port.receive(fresh);
  };

  const onChange = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    const states = awareness.getStates();
    for (const clientId of added.concat(updated)) {
      if (clientId === awareness.clientID) continue;
      take(clientId, states.get(clientId)?.[AWARENESS_FIELD]);
    }
    for (const clientId of removed) leave(clientId);
  };

  const publish = (actions: PortAction[]) => {
    let next = local;
    for (const action of actions) {
      const editorId = action.meta?.editorId;
      const nickname = action.meta?.nickname;
      if (typeof editorId === 'string' && editorId !== next.editorId) {
        next = { ...next, editorId };
      }
      if (typeof nickname === 'string' && nickname !== next.nickname) {
        next = { ...next, nickname };
      }
      if (isTracker(action.type)) {
        next = {
          ...next,
          trackers: {
            ...next.trackers,
            [action.type]: copyJson(action),
          },
          beats: {
            ...next.beats,
            [action.type]: (next.beats[action.type] ?? 0) + 1,
          },
        };
      } else if (isFollowing(action.type)) {
        next = { ...next, screen: nextScreen(next.screen, action) };
      }
    }
    if (next === local) return;
    local = next;
    write();
  };

  awareness.on('change', onChange);
  awareness.getStates().forEach((state, clientId) => {
    if (clientId !== awareness.clientID) take(clientId, state[AWARENESS_FIELD]);
  });
  write();

  return {
    publish,
    setScreen: screen => {
      local = { ...local, screen };
      write();
    },
    withdraw: () => {
      if (!local.compactor) return;
      local = { ...local };
      delete local.compactor;
      write();
    },
    destroy: () => {
      awareness.off('change', onChange);
      remote.clear();
      awareness.setLocalStateField(AWARENESS_FIELD, null);
    },
  };
}
