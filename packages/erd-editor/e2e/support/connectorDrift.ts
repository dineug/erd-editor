import type { ErdEditorPage } from './ErdEditorPage';

/**
 * Starts recording every draw of the scene layer as the furthest any drawn
 * connector end sits from the box of its own table, in stage pixels. At rest
 * that is under a pixel; each read drains the figures, one per draw since the last.
 */
export async function recordConnectorDrift(erd: ErdEditorPage) {
  const { collections } = await erd.value();
  const ends = Object.values(collections.relationshipEntities).map(
    ({ id, start, end }) => [id, start.tableId, end.tableId]
  );

  await erd.page.evaluate(ends => {
    const stage = Reflect.get(window, '__erdStages').canvas;
    const layer = stage.findOne('.scene');
    const draws: number[] = [];
    Reflect.set(window, '__connectorDrift', draws);

    const distance = (point: any, box: any) => {
      const dx = Math.max(box.x - point.x, 0, point.x - box.x - box.width);
      const dy = Math.max(box.y - point.y, 0, point.y - box.y - box.height);
      if (dx || dy) return Math.hypot(dx, dy);
      return Math.min(
        point.x - box.x,
        box.x + box.width - point.x,
        point.y - box.y,
        box.y + box.height - point.y
      );
    };

    const drawScene = layer.drawScene;
    layer.drawScene = function (this: unknown, ...args: unknown[]) {
      let drift = 0;
      for (const [id, startId, endId] of ends) {
        const group = layer
          .find('.relationship')
          .find((node: any) => node.name().split(/\s+/)[1] === id);
        const hit = group?.findOne('.relationship-hit-area');
        const start = layer.findOne(`#table-${startId}`);
        const end = layer.findOne(`#table-${endId}`);
        if (!hit || !start || !end) continue;

        // The hit path's first run goes from the start anchor to the end one.
        const data: string = hit.data();
        const cut = data.indexOf('M', 1);
        const run = cut > 0 ? data.slice(0, cut) : data;
        const numbers = (run.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
        const transform = hit.getAbsoluteTransform();
        const first = transform.point({ x: numbers[0], y: numbers[1] });
        const last = transform.point({
          x: numbers[numbers.length - 2],
          y: numbers[numbers.length - 1],
        });
        const clientRect = { skipShadow: true, skipStroke: true };
        drift = Math.max(
          drift,
          distance(first, start.getClientRect(clientRect)),
          distance(last, end.getClientRect(clientRect))
        );
      }
      draws.push(drift);
      return drawScene.apply(this, args);
    };
  }, ends);

  return () =>
    erd.page.evaluate(() =>
      (Reflect.get(window, '__connectorDrift') as number[]).splice(0)
    );
}
