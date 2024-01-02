import { createStore } from 'jotai';

import { collaborativeAtom } from '@/atoms/modules/collaborative';
import { schemaEntitiesAtom } from '@/atoms/modules/schema';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import { bridge } from '@/utils/broadcastChannel';

export const store = createStore();

bridge.on({
  addSchemaEntity: ({ payload: { value } }) => {
    store.set(schemaEntitiesAtom, draft => {
      draft.push(value);
    });
  },
  updateSchemaEntity: ({ payload: { id, entityValue } }) => {
    store.set(schemaEntitiesAtom, draft => {
      const value = draft.find(item => item.id === id);
      if (!value) return;
      Object.assign(value, entityValue);
    });
  },
  deleteSchemaEntity: ({ payload: { id } }) => {
    const selectedSchemaId = store.get(selectedSchemaIdAtom);
    if (selectedSchemaId === id) {
      store.set(selectedSchemaIdAtom, null);
    }

    store.set(schemaEntitiesAtom, draft => {
      const index = draft.findIndex(item => item.id === id);
      if (index === -1) return;
      draft.splice(index, 1);
    });
  },
  startSession: ({ payload: { schemaId, roomId, secretKey } }) => {
    store.set(collaborativeAtom, draft => {
      draft[schemaId] = [roomId, secretKey];
    });
  },
  stopSession: ({ payload: { schemaId } }) => {
    store.set(collaborativeAtom, draft => {
      Reflect.deleteProperty(draft, schemaId);
    });
  },
});
