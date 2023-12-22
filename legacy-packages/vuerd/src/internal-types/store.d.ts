import { Observable, Subject } from 'rxjs';

import { CommandTypeAll } from '@@types/engine/command';
import { Store } from '@@types/engine/store';

export interface IStore extends Store {
  history$: Subject<Array<CommandTypeAll>>;
  change$: Observable<Array<CommandTypeAll>>;
  destroy(): void;
}
