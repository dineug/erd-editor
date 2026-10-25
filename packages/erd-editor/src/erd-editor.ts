import { defineErdEditor } from '@/components/erd-editor/ErdEditor';

// Names nothing, but keeps the element's module in this entry's declaration, so a
// consumer that imports only this entry gets the tag in HTMLElementTagNameMap.
export type {} from '@/components/erd-editor/ErdEditor';

defineErdEditor();
