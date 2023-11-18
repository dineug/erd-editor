import {
  BEFORE_FIRST_UPDATE,
  BEFORE_MOUNT,
  BEFORE_UPDATE,
  FIRST_UPDATED,
  LIFECYCLE_NAMES,
  LifecycleName,
  MOUNTED,
  UNMOUNTED,
  UPDATED,
} from '@/constants';
import { safeCallback } from '@/helpers/fn';
import { isArray } from '@/helpers/is-type';

export type Callback = () => void;

let currentInstance: any = null;

export function setCurrentInstance(component: any) {
  currentInstance = component;
}

export function getCurrentInstance() {
  return currentInstance;
}

const createLifecycle = (name: LifecycleName) => (f: Callback) => {
  currentInstance &&
    (currentInstance[name] ?? (currentInstance[name] = [])).push(f);
};

export const onBeforeMount = createLifecycle(BEFORE_MOUNT);
export const onMounted = createLifecycle(MOUNTED);
export const onUnmounted = createLifecycle(UNMOUNTED);
export const onBeforeFirstUpdate = createLifecycle(BEFORE_FIRST_UPDATE);
export const onBeforeUpdate = createLifecycle(BEFORE_UPDATE);
export const onFirstUpdated = createLifecycle(FIRST_UPDATED);
export const onUpdated = createLifecycle(UPDATED);

export function lifecycleHooks(instance: any, name: LifecycleName) {
  const hooks = Reflect.get(instance, name, instance);
  isArray(hooks) && hooks.forEach(safeCallback);
}

export function clearAllLifecycleHooks(instance: any) {
  LIFECYCLE_NAMES.forEach(name => Reflect.set(instance, name, null, instance));
}
