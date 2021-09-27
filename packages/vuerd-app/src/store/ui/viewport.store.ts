import { reactive } from 'vue';

import { createStore } from '@/store';
import * as actions from '@/store/ui/viewport.actions';

export const state = reactive({
  width: 0,
  height: 0,
});

export const useViewportStore = createStore(state, actions, 'viewport');
