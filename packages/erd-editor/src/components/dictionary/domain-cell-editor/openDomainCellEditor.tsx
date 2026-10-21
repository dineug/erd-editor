import type { EditorContext } from '@dineug/grid';
import { render } from '@dineug/r-html';

import DomainCellEditor, {
  type DomainCellEditorProps,
} from './DomainCellEditor';

/**
 * Opens the domain picker of a term's domain cell in the grid's editor slot,
 * and takes it out again once its edit has closed, by a pick or a cancel,
 * before onClose runs.
 */
export function openDomainCellEditor(
  editor: EditorContext,
  { label, linkedId, onPick, onClose }: Omit<DomainCellEditorProps, 'editor'>
) {
  const host = document.createElement('div');
  host.style.height = '100%';
  editor.container.append(host);

  const remove = () => {
    render(host, null);
    host.remove();
    onClose();
  };
  render(
    host,
    <DomainCellEditor
      editor={editor}
      label={label}
      linkedId={linkedId}
      onPick={onPick}
      onClose={remove}
    />
  );
}
