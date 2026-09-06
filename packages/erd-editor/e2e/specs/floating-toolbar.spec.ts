import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { twoTables } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

/** constants/layout.ts — the strip the toolbar takes off the top of the host. */
const TOOLBAR_HEIGHT = 30;

const tools = (erd: ErdEditorPage) => erd.host.locator('.floating-toolbar');

const button = (erd: ErdEditorPage, name: string) =>
  tools(erd).locator(`[title^="${name}"]`);

/**
 * The tools over the canvas: which of the two a press means, the notation the
 * next relationship is drawn in, and the mode that takes the chrome away. Every
 * one of them is a button and a chord, and both have to land in the same state.
 */
test.describe('the floating toolbar', () => {
  test('names each button and the first chord bound to it', async ({ erd }) => {
    await erd.seed(twoTables());

    await expect(tools(erd)).toHaveCount(1);
    await expect(button(erd, 'Hand')).toHaveAttribute('title', 'Hand (Space)');
    await expect(button(erd, 'Select')).toHaveAttribute(
      'title',
      'Select (Space)'
    );

    // The chord itself is platform-shaped, so what is pinned is that the title
    // opens with the name and carries the key the binding ends on.
    const zen = await button(erd, 'Zen Mode').getAttribute('title');
    expect(zen).toMatch(/^Zen Mode \(.*Z\)$/);
  });

  test('toggles the hand tool from the button and from Space alike', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    const canvas = erd.host.locator('[data-testid="erd-canvas"]');

    await expect(canvas).toHaveCSS('pointer-events', 'auto');

    await button(erd, 'Hand').click();
    await expect(canvas).toHaveCSS('pointer-events', 'none');

    await button(erd, 'Select').click();
    await expect(canvas).toHaveCSS('pointer-events', 'auto');

    // The chord is the same toggle: one press down, one press back up.
    await erd.focusCanvas();
    await erd.press(Shortcut.handTool);
    await expect(canvas).toHaveCSS('pointer-events', 'none');

    await erd.press(Shortcut.handTool);
    await expect(canvas).toHaveCSS('pointer-events', 'auto');
  });

  test('draws a relationship the notation button arms', async ({ erd }) => {
    await erd.seed(twoTables());
    expect(await erd.relationshipIds()).toEqual([]);

    await button(erd, 'Zero N').click();
    await erd.clickTableHeader('users');
    await erd.clickTableHeader('posts');

    await expect.poll(() => erd.relationshipIds()).toHaveLength(1);
  });

  test('takes the chrome away in zen mode and leaves the tools standing', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    await expect(erd.toolbar).toHaveCount(1);
    await expect(erd.minimap).toHaveCount(1);
    await expect(erd.host.locator('.virtual-scroll')).toHaveCount(2);

    // The canvas is the host less the toolbar, so the room the toolbar leaves
    // has to reach the scene rather than stand empty under it.
    const boxOf = async (locator: ReturnType<typeof tools>) => {
      const box = await locator.boundingBox();
      if (!box) throw new Error('element has no bounding box');
      return box;
    };
    const host = await boxOf(erd.host);
    const canvas = erd.host.locator('[data-testid="erd-canvas"]');
    expect(host.height - (await boxOf(canvas)).height).toBeCloseTo(
      TOOLBAR_HEIGHT,
      0
    );

    await button(erd, 'Zen Mode').click();

    await expect(erd.toolbar).toHaveCount(0);
    await expect(erd.minimap).toHaveCount(0);
    await expect(erd.host.locator('.virtual-scroll')).toHaveCount(0);
    await expect(tools(erd)).toHaveCount(1);
    await expect
      .poll(async () => (await boxOf(canvas)).height)
      .toBeCloseTo(host.height, 0);

    // Alt+Z is the way back as well as the way in.
    await erd.focusCanvas();
    await erd.press(Shortcut.zenMode);

    await expect(erd.toolbar).toHaveCount(1);
    await expect(erd.minimap).toHaveCount(1);
  });
});
