import { Observable } from 'rxjs';

import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { RootState } from '@/engine/state';

export const erdShortcutPerformCheck =
  ({ editor, settings }: RootState) =>
  <T>(source$: Observable<T>) =>
    new Observable<T>(subscriber =>
      source$.subscribe({
        next: value => {
          const showAutomaticTablePlacement =
            editor.openMap[Open.automaticTablePlacement];
          const showTableProperties = editor.openMap[Open.tableProperties];
          const showSearch = editor.openMap[Open.search];
          const showDiffViewer = editor.openMap[Open.diffViewer];
          const isCanvasType = settings.canvasType === CanvasType.ERD;

          const canPerform =
            isCanvasType &&
            !showAutomaticTablePlacement &&
            !showTableProperties &&
            !showSearch &&
            !showDiffViewer;

          if (canPerform) {
            subscriber.next(value);
          }
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    );
