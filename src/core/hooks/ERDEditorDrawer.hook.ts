import { ERDEditorProps } from '@@types/components/ERDEditorElement';
import { html, observable } from '@dineug/lit-observable';

interface DrawerState {
  help: boolean;
  setting: boolean;
}

type DrawerKey = keyof DrawerState;

export function useERDEditorDrawer(props: ERDEditorProps) {
  const state = observable<DrawerState>({ help: false, setting: false });

  const createOpen = (key: DrawerKey) => () => {
    Object.keys(state).forEach(stateKey => {
      if (stateKey === key) return;

      state[stateKey as DrawerKey] = false;
    });

    state[key] = !state[key];
  };
  const createClose = (key: DrawerKey) => () => (state[key] = false);

  const openHelp = createOpen('help');
  const closeHelp = createClose('help');
  const openSetting = createOpen('setting');
  const closeSetting = createClose('setting');

  const closeDrawer = () => {
    closeHelp();
    closeSetting();
  };

  return {
    drawerTpl: () => html`
      <vuerd-help-drawer
        .width=${props.width}
        .visible=${state.help}
        @close=${closeHelp}
      ></vuerd-help-drawer>
      <vuerd-setting-drawer
        .width=${props.width}
        .visible=${state.setting}
        @close=${closeSetting}
      ></vuerd-setting-drawer>
    `,
    closeDrawer,
    openHelp,
    closeHelp,
    openSetting,
    closeSetting,
  };
}
