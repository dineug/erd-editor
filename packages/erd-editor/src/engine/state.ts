import { ERDEditorSchemaV3, type LWW } from '@dineug/erd-editor-schema';

import { Editor } from '@/engine/modules/editor/state';

export type RootState = ERDEditorSchemaV3 & {
  editor: Editor;
  lww: LWW;
};
