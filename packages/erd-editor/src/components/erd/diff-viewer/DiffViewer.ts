import { toJson } from '@dineug/erd-editor-schema';
import { FC, html, onMounted, Ref, watch } from '@dineug/r-html';

import { AppContext, createAppContext } from '@/components/appContext';
import ErdViewer from '@/components/erd/diff-viewer/erd-viewer/ErdViewer';
import { DIFF_TREE_WIDTH } from '@/constants/layout';
import {
  changeViewportAction,
  initialClearAction,
} from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import { Diff, diffState } from './diff';
import * as styles from './DiffViewer.styles';

export type DiffViewerProps = {
  app: Ref<AppContext>;
  initialValue: string;
  onClose: () => void;
};

const BORDER = 1;

const DiffViewer: FC<DiffViewerProps> = (props, ctx) => {
  const originApp = props.app.value;
  const getReadonly = () => true;
  const prevApp = createAppContext({ toWidth: originApp.toWidth }, getReadonly);
  const app = createAppContext({ toWidth: originApp.toWidth }, getReadonly);
  const { addUnsubscribe } = useUnmounted();

  const getViewport = () => {
    const { store } = originApp;
    const {
      editor: { viewport },
    } = store.state;
    return {
      width: (viewport.width - DIFF_TREE_WIDTH) / 2 - BORDER,
      height: viewport.height,
    };
  };

  prevApp.store.dispatchSync(
    initialLoadJsonAction$(props.initialValue),
    changeViewportAction(getViewport())
  );
  app.store.dispatchSync(
    initialLoadJsonAction$(toJson(originApp.store.state)),
    changeViewportAction(getViewport())
  );

  const [prevDiffMap, diffMap] = diffState(
    prevApp.store.state,
    app.store.state
  );

  onMounted(() => {
    addUnsubscribe(
      originApp.shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && props.onClose();
      }),
      watch(originApp.store.state.editor.viewport).subscribe(() => {
        const viewport = getViewport();
        prevApp.store.dispatch(changeViewportAction(viewport));
        app.store.dispatch(changeViewportAction(viewport));
      }),
      () => {
        prevApp.store.dispatchSync(initialClearAction());
        prevApp.store.destroy();
        prevApp.keydown$.complete();
        prevApp.shortcut$.complete();
        prevApp.emitter.clear();

        app.store.dispatchSync(initialClearAction());
        app.store.destroy();
        app.keydown$.complete();
        app.shortcut$.complete();
        app.emitter.clear();
      }
    );
  });

  return () => html`
    <div class=${styles.root}>
      <div class=${styles.container}>
        <div class=${styles.tree}>tree-list</div>
        <div class=${styles.viewport}>
          <${ErdViewer}
            app=${prevApp}
            diff=${Diff.delete}
            diffMap=${prevDiffMap}
          />
        </div>
        <div class=${styles.viewport}>
          <${ErdViewer} app=${app} diff=${Diff.insert} diffMap=${diffMap} />
        </div>
      </div>
    </div>
  `;
};

export default DiffViewer;
