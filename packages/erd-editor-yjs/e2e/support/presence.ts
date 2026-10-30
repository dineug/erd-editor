import type { Page } from '@playwright/test';

/**
 * <erd-editor> declares its shadow root closed, which puts its canvas out of
 * reach of a locator. The boundary opens before any page script runs, here in
 * the e2e suite alone, so a spec can point at the canvas the pointer moves over.
 */
export async function reopenShadowRoots(page: Page) {
  await page.addInitScript(() => {
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init: ShadowRootInit) {
      return attachShadow.call(this, { ...init, mode: 'open' });
    };
  });
}

const CANVAS = 'erd-editor [data-testid="erd-canvas"]';

/** Sweeps the pointer over the canvas, which the editor shares as its cursor. */
export async function moveMouse(page: Page) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error('the canvas is not laid out');

  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.move(box.x + 400, box.y + 350, { steps: 10 });
}

/**
 * The nicknames on the other clients' cursors, read off the Konva scene. The
 * built editor publishes no stage, so each stage is caught through the global
 * Konva installs as one of its layers draws, which a cursor arriving makes.
 */
export async function cursorLabels(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const scope = window as any;

    if (!scope.__e2eStages) {
      const stages = new Set<any>();
      const { prototype } = scope.Konva.Layer;
      scope.__e2eStages = stages;

      for (const method of ['batchDraw', 'draw']) {
        const draw = prototype[method];
        prototype[method] = function (...args: unknown[]) {
          const stage = this.getStage();
          if (stage) stages.add(stage);
          return draw.apply(this, args);
        };
      }
    }

    return Array.from(scope.__e2eStages as Set<any>).flatMap(stage =>
      stage
        .find('.shared-mouse-cursor-nickname')
        .map((node: any) => node.text() as string)
    );
  });
}
