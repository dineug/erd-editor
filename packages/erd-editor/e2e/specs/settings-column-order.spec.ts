import { expect, test } from '../support/fixtures';
import { dragListInPage, framesOutOfOrder } from '../support/listDrag';

test.describe('settings column order', () => {
  test('a fast drag paints the rows in the order they hold on every frame', async ({
    erd,
    page,
  }) => {
    await erd.toolbarButton('Settings').click();
    const rows = '[draggable="true"][data-id]';
    await expect(erd.host.locator(rows)).toHaveCount(7);

    // The last row to the top in 300ms, then held for longer than the 0.3s
    // flip, the way a quick flick up the list and a pause at the top go.
    const run = await page.evaluate(dragListInPage, {
      rows,
      from: 6,
      to: 0,
      travel: 300,
      hold: 700,
    });

    expect(run.frames.at(-1)?.order).toEqual([
      run.initial[6],
      ...run.initial.slice(0, 6),
    ]);
    expect(framesOutOfOrder(run)).toHaveLength(0);
  });
});
