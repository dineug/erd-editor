import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import TextInput from '@/components/primitives/text-input/TextInput';
import {
  changeDatabaseNameAction,
  resizeAction,
} from '@/engine/modules/settings/atom.actions';
import { canvasSizeInRange } from '@/utils/validation';

import * as styles from './Toolbar.styles';

export type ToolbarProps = {};

const Toolbar: FC<ToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleChangeDatabaseName = (event: InputEvent) => {
    const el = event.target as HTMLInputElement | null;
    if (!el) return;

    const { store } = app.value;
    store.dispatch(changeDatabaseNameAction({ value: el.value }));
  };

  const handleResize = (event: Event) => {
    const el = event.target as HTMLInputElement | null;
    if (!el) return;

    const size = canvasSizeInRange(el.value);
    const { store } = app.value;
    el.value = size.toString();
    store.dispatch(resizeAction({ width: size, height: size }));
  };

  return () => {
    const { store } = app.value;
    const { settings } = store.state;

    return html`
      <div class=${styles.root}>
        <${TextInput}
          title="database name"
          placeholder="database name"
          width=${150}
          value=${settings.databaseName}
          .onInput=${handleChangeDatabaseName}
        />
        <${TextInput}
          title="canvas size"
          placeholder="canvas size"
          width=${45}
          value=${settings.width.toString()}
          numberOnly=${true}
          .onChange=${handleResize}
        />
      </div>
    `;
  };
};

export default Toolbar;
