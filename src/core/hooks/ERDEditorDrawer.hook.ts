import { ERDEditorProps } from '@@types/components/ERDEditorElement';
import { html, observable } from '@dineug/lit-observable';

interface DrawerState {
  help: boolean;
}

type DrawerKey = keyof DrawerState;

export function useERDEditorDrawer(props: ERDEditorProps) {
  const state = observable<DrawerState>({ help: false });

  const createOpen = (key: DrawerKey) => () => (state[key] = !state[key]);
  const createClose = (key: DrawerKey) => () => (state[key] = false);

  const openHelp = createOpen('help');
  const closeHelp = createClose('help');

  return {
    drawerTpl: () => html`
      <vuerd-help-drawer
        .width=${props.width}
        .visible=${state.help}
        @close=${closeHelp}
      ></vuerd-help-drawer>
    `,
    openHelp,
    closeHelp,
  };
}
