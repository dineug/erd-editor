import { FC, html, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { onStop } from '@/utils/domEvent';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import * as styles from './TableProperties.styles';

export type TablePropertiesProps = {
  tableId: string;
};

const TableProperties: FC<TablePropertiesProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  const handleClose = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.tableProperties]: false }));
  };

  const handleOutsideClick = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canClose = !el.closest(`.${styles.container}`);
    canClose && handleClose();
  };

  onMounted(() => {
    const { shortcut$ } = app.value;

    addUnsubscribe(
      shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && handleClose();
      })
    );
  });

  return () => html`
    <div
      class=${styles.root}
      @contextmenu=${onStop}
      @mousedown=${onStop}
      @touchstart=${onStop}
      @wheel=${onStop}
      @click=${handleOutsideClick}
    >
      <div class=${['scrollbar', styles.container]}>
        <div style=${{ width: '800px', height: '400px' }}>TableProperties</div>
      </div>
    </div>
  `;
};

export default TableProperties;
