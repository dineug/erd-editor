import { toJson } from '@dineug/erd-editor-schema';
import { FC, observable, onMounted, Ref, watch } from '@dineug/r-html';

import {
  AppContext,
  appDestroy,
  createAppContext,
} from '@/components/appContext';
import DiffTree from '@/components/erd/diff-viewer/diff-tree/DiffTree';
import ErdViewer from '@/components/erd/diff-viewer/erd-viewer/ErdViewer';
import { readerNameViewAction } from '@/components/erd/readerNameView';
import { dropRelationshipHighlight } from '@/components/erd/relationshipHighlight';
import { localized } from '@/components/localized/Localized';
import Button from '@/components/primitives/button/Button';
import Toast from '@/components/primitives/toast/Toast';
import {
  EXPLORER_MAX_WIDTH,
  EXPLORER_MIN_WIDTH,
  EXPLORER_WIDTH,
} from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { diffDocuments } from '@/utils/diff';
import { openToastAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { closePromise } from '@/utils/promise';

import { Diff } from './diff';
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
  // The tree's width lives as long as the diff, so the next diff opens at 260.
  const tree = observable({ width: EXPLORER_WIDTH });

  const getViewport = () => {
    const { store } = originApp;
    const {
      editor: { viewport },
    } = store.state;
    return {
      width: (viewport.width - tree.width) / 2 - BORDER,
      height: viewport.height,
    };
  };

  const applyViewport = () => {
    const viewport = getViewport();
    prevApp.store.dispatch(changeViewportAction(viewport));
    app.store.dispatch(changeViewportAction(viewport));
  };

  const handleResize = (width: number) => {
    const next = Math.round(
      Math.min(EXPLORER_MAX_WIDTH, Math.max(EXPLORER_MIN_WIDTH, width))
    );
    if (tree.width === next) return;
    tree.width = next;
    applyViewport();
  };

  // The pane is measured before either document lands in it, so a load pulls
  // its origin against the pane rather than against the store's default size.
  // Both open in the reader's name view, whatever the file locks.
  prevApp.store.dispatchSync(
    changeViewportAction(getViewport()),
    initialLoadJsonAction$(props.initialValue),
    readerNameViewAction(prevApp.store.state, originApp.store.state)
  );
  app.store.dispatchSync(
    changeViewportAction(getViewport()),
    initialLoadJsonAction$(toJson(originApp.store.state)),
    readerNameViewAction(app.store.state, originApp.store.state)
  );

  const {
    entries,
    prev: prevDiffMap,
    next: diffMap,
  } = diffDocuments(prevApp.store.state, app.store.state);

  const [close, onClose] = closePromise();

  const handleClose = () => {
    onClose();
    props.onClose();
  };

  originApp.emitter.emit(
    openToastAction({
      close,
      message: (
        <Toast
          title={localized('feedback.diffViewer')}
          action={
            <Button
              size="1"
              text={localized('common.close')}
              onClick={handleClose}
            />
          }
        />
      ),
    })
  );

  onMounted(() => {
    addUnsubscribe(
      originApp.shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && handleClose();
      }),
      watch(originApp.store.state.editor.viewport).subscribe(applyViewport),
      () => {
        // A pane's light is kept by its editor id, which the element's own
        // teardown never reaches, so the diff puts out both as it goes.
        dropRelationshipHighlight(prevApp.store.state.editor.id);
        dropRelationshipHighlight(app.store.state.editor.id);
        appDestroy(prevApp);
        appDestroy(app);
      }
    );
  });

  return () => (
    <div class={styles.root} prop:dir="ltr">
      <div class={styles.container}>
        <DiffTree
          prevApp={prevApp}
          app={app}
          entries={entries}
          width={tree.width}
          onResize={handleResize}
        />
        <div class={styles.viewport}>
          <ErdViewer app={prevApp} diff={Diff.delete} diffMap={prevDiffMap} />
        </div>
        <div class={styles.viewport}>
          <ErdViewer app={app} diff={Diff.insert} diffMap={diffMap} />
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;
