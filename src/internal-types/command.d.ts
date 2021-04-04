import { State } from '@@types/engine/store';

export type ExecuteCommand = (state: State, data: any) => void;
