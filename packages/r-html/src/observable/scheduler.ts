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
  tickCount: number;
  promise: Promise<void>;
  fn: Observer | VoidFunction | AsyncFunction;
  resolve: () => void;
}

const EXPIRATION_TICK = 1;

const queue: Task[] = [];
const queueMap = new Map<Observer | VoidFunction, Task>();
const watchQueue = new Map<any, Set<PropName>>();
const idleOptions = { timeout: 16 };

let executable = true;
let tickCount = 0;

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
        tickCount,
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
      asap(execute);
      executable = false;
    }

    return promise;
  };

const observerNextTick = createNextTick('observer');
export const nextTick = createNextTick('nextTick');

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

  if (isNextTaskExpires()) {
    runTask();
  }
}

function isNextTaskExpires() {
  const task = queue[0];
  return task ? EXPIRATION_TICK <= tickCount - task.tickCount : false;
}

function executeIdle() {
  const run = (deadline: IdleDeadline) => {
    do {
      runTask();
    } while (queue.length && deadline.timeRemaining() > 0);

    if (queue.length) {
      tickCount++;
      window.requestIdleCallback(run, idleOptions);
    } else {
      executable = true;
      tickCount = 0;
    }
  };

  window.requestIdleCallback(run, idleOptions);
}

function executeAsap() {
  while (queue.length) {
    runTask();
  }
  executable = true;
  tickCount = 0;
}

// const isIdle = 'requestIdleCallback' in window;
const isIdle = false;

function execute() {
  const exec = isIdle ? executeIdle : executeAsap;
  exec();
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
