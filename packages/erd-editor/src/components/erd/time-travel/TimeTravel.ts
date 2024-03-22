import { toJson } from '@dineug/erd-editor-schema';
import {
  createRef,
  FC,
  html,
  observable,
  onMounted,
  Ref,
  ref,
  useProvider,
  watch,
} from '@dineug/r-html';

import {
  AppContext,
  appContext,
  appDestroy,
  createAppContext,
} from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import Minimap from '@/components/erd/minimap/Minimap';
import Button from '@/components/primitives/button/Button';
import Slider from '@/components/primitives/slider/Slider';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { HISTORY_LIMIT } from '@/engine/rx-store';
import { useUnmounted } from '@/hooks/useUnmounted';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import * as styles from './TimeTravel.styles';

export type TimeTravelProps = {
  app: Ref<AppContext>;
  onChange: (cursor: number) => void;
  onClose: () => void;
};

const TimeTravel: FC<TimeTravelProps> = (props, ctx) => {
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const originApp = props.app.value;
  const app = createAppContext(
    {
      toWidth: originApp.toWidth,
    },
    {
      getHistory: originApp.store.history.clone,
    }
  );
  const { store } = app;
  const { history } = store;
  const { addUnsubscribe } = useUnmounted();
  const provider = useProvider(ctx, appContext, app);

  addUnsubscribe(() => {
    provider.destroy();
  });

  const getViewport = () => ({ ...originApp.store.state.editor.viewport });

  const state = observable({
    cursor: history.cursor,
  });

  store.dispatchSync(
    initialLoadJsonAction$(toJson(originApp.store.state)),
    changeViewportAction(getViewport())
  );

  const runTimeTravel = (cursor: number) => {
    let count = 0;

    while (history.cursor !== cursor && count <= HISTORY_LIMIT) {
      history.cursor < cursor ? history.redo() : history.undo();
      count++;
    }
  };

  const handleClose = () => {
    props.onClose();
  };

  const handleApply = () => {
    props.onChange(state.cursor);
    handleClose();
  };

  const handleChange = (cursor: number) => {
    state.cursor = cursor;
    runTimeTravel(cursor);
  };

  onMounted(() => {
    addUnsubscribe(
      originApp.shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && handleClose();
      }),
      watch(originApp.store.state.editor.viewport).subscribe(() => {
        app.store.dispatch(changeViewportAction(getViewport()));
      }),
      () => {
        appDestroy(app);
      }
    );
  });

  return () => html`
    <div class=${styles.root}>
      <div class=${styles.container} ${ref(root)}>
        <${Canvas} root=${root} canvas=${canvas} grabMove=${true} />
        <${Minimap} />
      </div>
    </div>
    <div class=${styles.slider}>
      <${Slider}
        min=${-1}
        max=${history.size - 1}
        value=${state.cursor}
        .onChange=${handleChange}
      />
      <div class=${styles.vertical}></div>
      <${Button} variant="soft" size="1" text="Apply" .onClick=${handleApply} />
      <${Button} size="1" text="Cancel" .onClick=${handleClose} />
    </div>
  `;
};

export default TimeTravel;
