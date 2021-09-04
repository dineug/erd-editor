import { state } from '@/store/ui/viewport.store';

export function changeViewport(width: number, height: number) {
  Object.assign(state, { width, height });
}
