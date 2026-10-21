import type { EditorContext } from '@dineug/grid';
import { render } from '@dineug/r-html';

import DomainCellEditor from './DomainCellEditor';

/**
 * Opens the domain picker of a term's domain cell in the grid's editor slot,
 * and takes it out again once its edit has committed or cancelled.
 */
export function openDomainCellEditor(editor: EditorContext, label: string) {
  const host = document.createElement('div');
  host.style.height = '100%';
  editor.container.append(host);

  const remove = () => {
    render(host, null);
    host.remove();
  };
  render(
    host,
    <DomainCellEditor editor={editor} label={label} onClose={remove} />
  );
}
