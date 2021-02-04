import { Store } from '@@types/engine/store';

export interface IStore extends Store {
  destroy(): void;
}
