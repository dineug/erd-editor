import { Store } from '../store';
import { CommandType } from './index';

export declare function refreshTree(store: Store): CommandType<'tree.refresh'>;

export declare function hideTree(store: Store): CommandType<'tree.hide'>;
