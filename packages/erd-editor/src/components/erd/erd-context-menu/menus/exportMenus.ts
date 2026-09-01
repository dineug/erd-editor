import { toJson } from '@dineug/erd-editor-schema';
import { html } from '@dineug/r-html';

import { AppContext } from '@/components/appContext';
import { IconName } from '@/components/primitives/icon/icons';
import Toast from '@/components/primitives/toast/Toast';
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

export function createExportMenus(
  app: AppContext,
  onClose: () => void,
  theme: Theme
): Menu[] {
  const { store, emitter, toWidth } = app;
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
        exportPNG(
          {
            doc: toJson(store.state),
            theme,
            toWidth,
            onResolutionReduced: reduction => {
              emitter.emit(
                openToastAction({
                  message: html`<${Toast}
                    title=${'Exported at a reduced resolution'}
                    description=${describeReduction(reduction)}
                  />`,
                })
              );
            },
          },
          databaseName
        ).catch(error => {
          console.error(
            '[export-png] the document could not be exported',
            error
          );
          emitter.emit(
            openToastAction({
              message: html`<${Toast}
                description=${'Failed to export the document as a png'}
              />`,
            })
          );
        });
      },
    },
  ];
}
