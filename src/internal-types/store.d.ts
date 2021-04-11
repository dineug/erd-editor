import { CommandTypeAll } from '@@types/engine/command';
import { Store } from '@@types/engine/store';
import { Observable, Subject } from 'rxjs';

export interface IStore extends Store {
  history$: Subject<Array<CommandTypeAll>>;
  change$: Observable<Array<CommandTypeAll>>;
  destroy(): void;
}
