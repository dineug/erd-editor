import { FC, onBeforeUpdate, onUpdated } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { layoutOf } from '@/components/erd-editor/viewportLayout';
import { focusEvent } from '@/utils/internalEvents';

import ExplorerPanel from './explorer-panel/ExplorerPanel';

export type ExplorerProps = {
  readonly: boolean;
};

/**
 * The Explorer's place beside the canvas: the panel at the width the layout
 * reaches, or nothing. It reads the reach alone, so a drag of the edge renders
 * the shell and the panel's root and nothing of the tree.
 */
const Explorer: FC<ExplorerProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  // Unobserved: onBeforeUpdate runs inside the shell's own observer, which
  // would otherwise render again every time the keyboard comes or goes.
  const focus = { inside: false, handBack: false };

  const handleFocusin = () => {
    focus.inside = true;
  };

  const handleFocusout = (event: FocusEvent) => {
    const panel = event.currentTarget as HTMLElement;
    focus.inside = panel.contains(event.relatedTarget as Node | null);
  };

  // A panel that goes away with the keyboard in it hands the keyboard back to
  // the editor, read before it goes rather than from a focusout the browser
  // may never send for an element it takes out.
  onBeforeUpdate(() => {
    focus.handBack = focus.inside && layoutOf(app.value.store).reach === 0;
  });

  onUpdated(() => {
    if (!focus.handBack) return;
    focus.inside = false;
    focus.handBack = false;
    ctx.host.dispatchEvent(focusEvent());
  });

  return () => {
    const { reach } = layoutOf(app.value.store);
    if (reach === 0) return null;

    return (
      <div
        class="explorer-shell"
        style={{ display: 'flex', height: '100%' }}
        on:focusin={handleFocusin}
        on:focusout={handleFocusout}
      >
        <ExplorerPanel width={reach} readonly={props.readonly} />
      </div>
    );
  };
};

export default Explorer;
