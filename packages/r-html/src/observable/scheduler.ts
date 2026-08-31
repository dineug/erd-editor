import { asap, safeCallback } from '@/helpers/fn';
import {
  Observer,
  observer,
  observerToTriggers,
  PropName,
  proxyToSubject,
  rawToObservers,
  rawToProxy,
  unobserve,
} from '@/observable';

type AsyncFunction = () => Promise<void>;

interface Task {
  type: 'observer' | 'nextTick';
  promise: Promise<void>;
  fn: Observer | VoidFunction | AsyncFunction;
  resolve: () => void;
}

const queue: Task[] = [];
const queueMap = new Map<Observer | VoidFunction, Task>();
const watchQueue = new Map<any, Set<PropName>>();

let executable = true;

function isTrigger(raw: any, p: PropName, observer: Observer) {
  const triggers = observerToTriggers.get(observer);
  if (!triggers) return false;

  const trigger = triggers.get(raw);
  if (!trigger) return false;

  return trigger.has(p);
}

const createNextTick =
  (type: Task['type']) => (fn: Observer | VoidFunction | AsyncFunction) => {
    const prevTask = queueMap.get(fn);

    let next = () => {};
    const promise = prevTask?.promise
      ? prevTask.promise
      : new Promise<void>(resolve => {
          next = resolve;
        });

    if (!prevTask) {
      const task: Task = {
        type,
        promise,
        fn,
        resolve: () => {
          next();
        },
      };

      queue.push(task);
      queueMap.set(fn, task);
    }

    if (executable) {
      asap(executeAsap);
      executable = false;
    }

    return promise;
  };

const observerNextTick = createNextTick('observer');
export const nextTick = createNextTick('nextTick');

/**
 * Drops the task an observer had already queued. An observer that goes away
 * between the write that queued it and the drain that would run it has nothing
 * left to render into, so the job has to leave with it.
 */
export function cancelTask(fn: Observer | VoidFunction) {
  const task = queueMap.get(fn);
  if (!task) return;

  const index = queue.indexOf(task);
  index === -1 || queue.splice(index, 1);
  queueMap.delete(fn);
  task.resolve();
}

export const effect = (raw: any, p: PropName) =>
  rawToObservers
    .get(raw)
    ?.forEach(
      observer => isTrigger(raw, p, observer) && observerNextTick(observer)
    );

function runTask() {
  const task = queue.shift();
  if (!task) return;

  queueMap.delete(task.fn);

  if (task.type === 'observer') {
    unobserve(task.fn);
    observer(task.fn);
    task.resolve();
  } else if (task.type === 'nextTick') {
    const result = safeCallback(task.fn);
    result instanceof Promise ? result.finally(task.resolve) : task.resolve();
  }
}

function executeAsap() {
  while (queue.length) {
    runTask();
  }
  executable = true;
}

export function watchEffect(raw: any, p: PropName) {
  const proxy = rawToProxy.get(raw);
  if (!proxy) return;
  const subject = proxyToSubject.get(proxy);
  if (!subject) return;
  const trigger = watchQueue.get(proxy);

  if (!trigger) {
    watchQueue.set(proxy, new Set([p]));

    nextTick(() => {
      const trigger = watchQueue.get(proxy);
      if (!trigger) return;

      watchQueue.delete(proxy);
      trigger.forEach(propName => subject.next(propName));
    });
  } else if (!trigger.has(p)) {
    trigger.add(p);
  }
}
