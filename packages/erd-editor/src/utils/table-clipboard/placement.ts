import { START_ADD } from '@/constants/layout';
import { Memo, Point, Settings, Table } from '@/internal-types';
import { nextPoint, nextZIndex } from '@/utils';

export type PlacementEntity = {
  sourceId: string;
  ui: {
    x: number;
    y: number;
    zIndex?: number;
  };
};

export type PlacementSource = {
  ui: {
    x: number;
    y: number;
  };
};

export type PlacementPoint = {
  x: number;
  y: number;
  zIndex: number;
};

export type ResolvePlacementConfig = {
  entities: PlacementEntity[];
  offset: Point;
  escapeCollision: boolean;
  settings: Settings;
  tables: Table[];
  memos: Memo[];
  findSource: (sourceId: string) => PlacementSource | undefined | null;
};

const toKey = ({ x, y }: Point) => `${x},${y}`;

const compareId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const toZIndex = (entity: PlacementEntity) => entity.ui.zIndex ?? 0;

export function resolvePlacement({
  entities,
  offset,
  escapeCollision,
  settings,
  tables,
  memos,
  findSource,
}: ResolvePlacementConfig): Map<string, PlacementPoint> {
  const placement = new Map<string, PlacementPoint>();
  if (entities.length === 0) return placement;

  const taken = new Set([...tables, ...memos].map(({ ui }) => toKey(ui)));
  const points = new Map<string, Point>();
  const absent: PlacementEntity[] = [];

  for (const entity of entities) {
    const source = findSource(entity.sourceId);

    if (source) {
      points.set(entity.sourceId, {
        x: source.ui.x + offset.x,
        y: source.ui.y + offset.y,
      });
    } else {
      absent.push(entity);
    }
  }

  if (absent.length !== 0) {
    const anchor = nextPoint(settings, tables, memos);
    const originRef = absent.reduce((acc, entity) =>
      entity.ui.x < acc.ui.x ||
      (entity.ui.x === acc.ui.x && entity.ui.y < acc.ui.y)
        ? entity
        : acc
    );

    for (const entity of absent) {
      points.set(entity.sourceId, {
        x: anchor.x + (entity.ui.x - originRef.ui.x),
        y: anchor.y + (entity.ui.y - originRef.ui.y),
      });
    }
  }

  if (escapeCollision) {
    const ordered = [...entities].sort((a, b) =>
      compareId(a.sourceId, b.sourceId)
    );

    for (const { sourceId } of ordered) {
      const point = points.get(sourceId);
      if (!point) continue;

      while (taken.has(toKey(point))) {
        point.x += START_ADD;
        point.y += START_ADD;
      }

      taken.add(toKey(point));
    }
  }

  const baseZIndex = nextZIndex(tables, memos);
  const stacked = [...entities].sort(
    (a, b) => toZIndex(a) - toZIndex(b) || compareId(a.sourceId, b.sourceId)
  );

  stacked.forEach(({ sourceId }, index) => {
    const point = points.get(sourceId);
    if (!point) return;

    placement.set(sourceId, {
      x: point.x,
      y: point.y,
      zIndex: baseZIndex + index,
    });
  });

  return placement;
}
