import { Helper } from '@@types/core/helper';
import { Subject } from 'rxjs';

export interface IHelper extends Helper {
  keydown$: Subject<KeyboardEvent>;
  setGhostInput(ghostInput: HTMLInputElement): void;
  focus(): void;
  blur(): void;
  destroy(): void;
}
