import { ERDEditorContext } from '@@types/index';
import { Subject } from 'rxjs';

export interface GridContext {
  api: ERDEditorContext;
  keydown$: Subject<KeyboardEvent>;
}
