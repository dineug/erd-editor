import { toJson } from '@dineug/erd-editor-schema';
import { FC, html, onMounted, Ref, watch } from '@dineug/r-html';

import {
  AppContext,
  appDestroy,
  createAppContext,
} from '@/components/appContext';
import ErdViewer from '@/components/erd/diff-viewer/erd-viewer/ErdViewer';
import TreeViewer from '@/components/erd/diff-viewer/tree-viewer/TreeViewer';
import Button from '@/components/primitives/button/Button';
import Toast from '@/components/primitives/toast/Toast';
import { DIFF_TREE_WIDTH } from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { openToastAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { closePromise } from '@/utils/promise';

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
  const prevApp = createAppContext(
    { toWidth: originApp.toWidth },
    { getReadonly }
  );
  const app = createAppContext({ toWidth: originApp.toWidth }, { getReadonly });
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

  const [close, onClose] = closePromise();

  const handleClose = () => {
    onClose();
    props.onClose();
  };

  originApp.emitter.emit(
    openToastAction({
      close,
      message: html`
        <${Toast}
          description="Diff Viewer..."
          action=${html`
            <${Button} size="1" text="Close" .onClick=${handleClose} />
          `}
        />
      `,
    })
  );

  onMounted(() => {
    addUnsubscribe(
      originApp.shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && handleClose();
      }),
      watch(originApp.store.state.editor.viewport).subscribe(() => {
        const viewport = getViewport();
        prevApp.store.dispatch(changeViewportAction(viewport));
        app.store.dispatch(changeViewportAction(viewport));
      }),
      () => {
        appDestroy(prevApp);
        appDestroy(app);
      }
    );
  });

  return () => html`
    <div class=${styles.root}>
      <div class=${styles.container}>
        <${TreeViewer}
          prevApp=${prevApp}
          prevDiffMap=${prevDiffMap}
          app=${app}
          diffMap=${diffMap}
        />
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
