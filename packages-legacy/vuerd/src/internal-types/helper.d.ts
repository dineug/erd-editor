import { Subject } from 'rxjs';

import { Helper } from '@@types/core/helper';

export interface IHelper extends Helper {
  keydown$: Subject<KeyboardEvent>;
  setGhostText(ghostText: HTMLSpanElement): void;
  setGhostInput(ghostInput: HTMLInputElement): void;
  focus(): void;
  blur(): void;
  destroy(): void;
}
