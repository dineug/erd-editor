import { toJson } from '@dineug/erd-editor-schema';
import { html } from '@dineug/r-html';

import { AppContext } from '@/components/appContext';
import { IconName } from '@/components/primitives/icon/icons';
import Toast from '@/components/primitives/toast/Toast';
import { openToastWhileRunning } from '@/components/toast-container/openToastWhileRunning';
import type { ResolutionReduction } from '@/services/export-png';
import type { Theme } from '@/themes/tokens';
import { openToastAction } from '@/utils/emitter';
import {
  exportJSON,
  exportPNG,
  exportSchemaSQL,
} from '@/utils/file/exportFile';
import { createSchemaSQL } from '@/utils/schema-sql';

type Menu = {
  icon: IconName;
  name: string;
  onClick: () => void;
};

/**
 * Says what was lost and why, because a png smaller than the document it came
 * from otherwise looks like the editor drew the wrong thing.
 */
function describeReduction({
  documentWidth,
  documentHeight,
  width,
  height,
}: ResolutionReduction) {
  return `${documentWidth}x${documentHeight} is past what a browser canvas can hold, so the image is ${width}x${height}`;
}

type Outcome = { error: unknown } | null;

/**
 * Draws the document, saying so while it draws and reporting afterwards. The
 * two messages are sequenced rather than stacked, so what became of the file
 * replaces the message about making it instead of landing under it.
 */
async function exportDocumentPng(
  { store, emitter, toWidth }: AppContext,
  theme: Theme,
  databaseName: string
) {
  let reduction: ResolutionReduction | null = null;

  const running = exportPNG(
    {
      doc: toJson(store.state),
      theme,
      toWidth,
      // Held, not shown: the file does not exist yet, and this message belongs
      // after the one saying the editor is still drawing it.
      onResolutionReduced: value => {
        reduction = value;
      },
    },
    databaseName
  );
  const outcome: Promise<Outcome> = running.then(
    () => null,
    (error: unknown) => ({ error })
  );

  await openToastWhileRunning(
    emitter,
    outcome,
    html`<${Toast} description=${'Generating the png'} />`
  );

  const failure = await outcome;

  if (failure) {
    console.error(
      '[export-png] the document could not be exported',
      failure.error
    );
    emitter.emit(
      openToastAction({
        message: html`<${Toast}
          description=${'Failed to export the document as a png'}
        />`,
      })
    );
    return;
  }

  if (reduction) {
    emitter.emit(
      openToastAction({
        message: html`<${Toast}
          title=${'Exported at a reduced resolution'}
          description=${describeReduction(reduction)}
        />`,
      })
    );
  }
}

export function createExportMenus(
  app: AppContext,
  onClose: () => void,
  theme: Theme
): Menu[] {
  const { store } = app;
  const databaseName = store.state.settings.databaseName;

  return [
    {
      icon: 'braces',
      name: 'json',
      onClick: () => {
        onClose();
        exportJSON(toJson(store.state), databaseName);
      },
    },
    {
      icon: 'database',
      name: 'Schema SQL',
      onClick: () => {
        onClose();
        exportSchemaSQL(createSchemaSQL(store.state), databaseName);
      },
    },
    {
      icon: 'file-image',
      name: 'png',
      onClick: () => {
        onClose();
        exportDocumentPng(app, theme, databaseName);
      },
    },
  ];
}
