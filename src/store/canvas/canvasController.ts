import {State} from '../canvas';
import {log} from '@/ts/util';

export function canvasMove(state: State, payload: { scrollTop: number, scrollLeft: number }) {
  log.debug('canvasController canvasMove');
  const {scrollTop, scrollLeft} = payload;
  state.scrollTop = scrollTop;
  state.scrollLeft = scrollLeft;
}
