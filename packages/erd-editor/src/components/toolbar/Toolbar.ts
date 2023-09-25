import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import TextInput from '@/components/primitives/text-input/TextInput';
import { changeDatabaseNameAction } from '@/engine/modules/settings/atom.actions';

import * as styles from './Toolbar.styles';

export type ToolbarProps = {};

const Toolbar: FC<ToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleChangeDatabaseNameAction = (event: InputEvent) => {
    const el = event.target as HTMLInputElement | null;
    if (!el) return;

    const { store } = app.value;
    store.dispatch(changeDatabaseNameAction({ value: el.value }));
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
          .onInput=${handleChangeDatabaseNameAction}
        />
      </div>
    `;
  };
};

export default Toolbar;
