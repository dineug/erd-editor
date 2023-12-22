import { Subject } from 'rxjs';

import { ERDEditorContext } from '@@types/index';

export interface GridContext {
  api: ERDEditorContext;
  keydown$: Subject<KeyboardEvent>;
}
