/** @jsxHost konva */

// The colour boundary every scene component shares: a Stage under a DOM shell
// resolves the palette through the shell's provider, and a re-provision is what
// a theme change costs, which is the seam the theme resolver later writes to.

import { useProvider } from '@dineug/r-html';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import { appContext } from '@/components/appContext';
import Memo from '@/components/erd/canvas/memo/Memo';
import { themeContext } from '@/components/themeContext';
import { whenDrawn } from '@/konva/batchDraw';
import { renderKonva } from '@/konva/host';
import type { Theme } from '@/themes/tokens';
import { createMemo } from '@/utils/collection/memo.entity';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const shift = (theme: Theme, memoBackground: string): Theme => ({
  ...theme,
  memoBackground,
});

async function mountUnderShell(theme: Theme) {
  const shell = document.createElement('div');
  const host = document.createElement('div');
  shell.append(host);
  document.body.append(shell);

  const app = createTestAppContext();
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the casts; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const appProvider = useProvider(shell as any, appContext, app);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(shell as any, themeContext, theme);
  const stage = new Stage({ container: host, width: 400, height: 300 });
  const memo = createMemo({ id: 'm1', ui: { x: 0, y: 0, zIndex: 1 } });

  renderKonva(
    stage,
    <k-layer name="scene">
      <Memo memo={memo} />
    </k-layer>
  );
  await flush();
  await whenDrawn();

  teardowns.push(() => {
    renderKonva(stage, null);
    themeProvider.destroy();
    appProvider.destroy();
    stage.destroy();
    shell.remove();
  });

  return { stage, themeProvider };
}

const bodyFill = (stage: Stage) => stage.findOne('.memo-body')?.getAttr('fill');

describe('the scene theme boundary', () => {
  it('paints a scene node from the provider above the Stage container', async () => {
    const theme = createTestTheme();
    const { stage } = await mountUnderShell(theme);

    expect(bodyFill(stage)).toBe(theme.memoBackground);
  });

  it('repaints the scene when the provider is handed a new palette', async () => {
    const theme = createTestTheme();
    const { stage, themeProvider } = await mountUnderShell(theme);

    themeProvider.set(shift(theme, '#123456'));
    await flush();
    await whenDrawn();

    expect(bodyFill(stage)).toBe('#123456');
  });
});
