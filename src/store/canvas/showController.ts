import {State, ShowKey} from '../canvas';
import {log} from '@/ts/util';
import StoreManagement from '@/store/StoreManagement';
import {relationshipSort} from '@/store/relationship/relationshipHelper';

export function showChange(state: State, payload: { showKey: ShowKey, store: StoreManagement }) {
  log.debug('showController showChange');
  const {showKey, store} = payload;
  state.show[showKey] = !state.show[showKey];
  relationshipSort(store.tableStore.state.tables, store.relationshipStore.state.relationships);
}
