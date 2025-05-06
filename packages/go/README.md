# go - Promise Extension Library

like [co](https://github.com/tj/co), or [redux-saga](https://redux-saga.js.org)

- [Getting Started](#getting-started)
- [API](#api)
  - [go](#go)
  - [all](#all)
  - [cancel](#cancel)
  - [debounce](#debounce)
  - [delay](#delay)
  - [flush](#flush)
  - [kill](#kill)
  - [put](#put)
  - [race](#race)
  - [take](#take)
  - [takeEvery](#takeevery)
  - [takeLatest](#takelatest)
  - [takeLeading](#takeleading)
  - [throttle](#throttle)

## Getting Started

```ts
import {
  all,
  channel,
  CO,
  delay,
  flush,
  go,
  put,
  race,
  take,
} from '@dineug/go';

const ch = channel();

const foo: CO = function* () {
  const value = yield take(ch);
  const value2 = yield go(v => v, value);

  go(function* () {
    const value = yield take(ch);
  });

  const values = yield all([
    go(() => 1),
    go(() => 2),
    Promise.resolve(3),
    Promise.resolve(4),
    5,
    6,
    take(ch),
    take(ch),
  ]);

  yield delay(2000);

  const value3 = yield race({
    a: delay(100),
    b: delay(200),
    c: take(ch),
  });

  const value4 = yield flush(ch);
};

for (let i = 0; i < 20; i++) {
  put(ch, i);
}

go(foo);
```

## API

### go

#### interface

```ts
function go<F extends AnyCallback>(
  callback: F,
  ...args: Parameters<F>
): Promise<GoReturnType<F>>;
```

#### callback

```ts
go(() => 1); // result 1

go(async () => 1); // result 1

go(function* () {
  return 1;
}); // result 1

go(async function* () {
  return 1;
}); // result 1
```

#### Blocking / Non-blocking

- Generator

```ts
go(function* () {
  // Non-blocking
  go(() => 1);

  // Blocking
  const value = yield go(() => 1);
});
```

- Promise

```ts
go(async function () {
  // Non-blocking
  go(() => 1);

  // Blocking
  const value = await go(() => 1);
});
```

### all

Same as Promise.all

#### Example

```js
all([
  go(() => 1),
  Promise.resolve(3),
  Promise.resolve(4),
  5,
  6,
  take(ch),
  take(ch),
]);
```

#### low-level operator

```js
const all = values =>
  go(function* () {
    const result = yield values;
    return result;
  });
```

### cancel

Cancel the promise

#### Example

```js
const task = go(function* () {
  const value = yield take(ch);
});

cancel(task);

go(function* () {
  try {
    yield cancel();
  } catch (error) {
    if (isCancel(error)) {
      // ...
    }
  }
});
```

#### low-level operator

```js
const cancel = promise => {
  if (isObject(promise)) {
    const cancel = Reflect.get(promise, ATTACH_CANCEL);
    cancel?.();
  }
  return go(() => new Promise((resolve, reject) => reject(CANCEL)));
};
```

### debounce

#### Example

```js
debounce(ch, function* () {}, 1000);
```

#### low-level operator

```js
const debounce = (channel, callback, ms) =>
  go(function* () {
    let timerId = -1;

    while (true) {
      const value = yield take(channel);

      clearTimeout(timerId);
      timerId = setTimeout(go, ms, callback, value);
    }
  });
```

### delay

#### Example

```js
go(function* () {
  yield delay(2000);
});
```

#### low-level operator

```js
const delay = ms => go(() => new Promise(resolve => setTimeout(resolve, ms)));
```

### flush

#### Example

```js
go(function* () {
  const values = yield flush(ch);
});
```

#### low-level operator

```js
const flush = channel =>
  new Promise((resolve, reject) => channel.flush(resolve, reject));
```

### kill

Exit All

#### Example

```js
go(function* () {
  yield go(function* () {
    yield go(function* () {
      yield kill();
    });
  });
}).catch(error => {
  if (isKill(error)) {
    // ...
  }
});
```

#### low-level operator

```js
const KILL = Symbol.for('https://github.com/dineug/go.git#kill');

const kill = () => Promise.reject(KILL);
```

### put

#### Example

```js
put(ch, 1);
```

#### low-level operator

```js
const put = (channel, value) => {
  channel.put(value);
};
```

### race

Same as Promise.race

#### Example

```js
go(function* () {
  const value = yield race({
    a: delay(100),
    b: delay(200),
    c: take(ch),
  });
});
```

#### low-level operator

```js
const race = record =>
  new Promise((resolve, reject) => {
    const toResolve = key => value => resolve({ [key]: value });

    for (const [key, entry] of Object.entries(record)) {
      isPromise(entry)
        ? entry.then(toResolve(key)).catch(reject)
        : isPromiseLike(entry)
          ? entry.then(toResolve(key))
          : toResolve(key)(entry);
    }
  });
```

### take

#### Example

```js
go(function* () {
  const value = yield take(ch);
});
```

#### low-level operator

```js
const take = channel =>
  go(function* () {
    let drop = () => false;

    const promise = new Promise((resolve, reject) => {
      drop = channel.take(resolve, reject);
    });

    attachCancel(promise, () => {
      drop();
    });

    const value = yield promise;
    return value;
  });
```

### takeEvery

#### Example

```js
takeEvery(ch, function* () {});
```

#### low-level operator

```js
const takeEvery = (channel, callback) =>
  go(function* () {
    while (true) {
      const value = yield take(channel);
      go(callback, value);
    }
  });
```

### takeLatest

#### Example

```js
takeLatest(ch, function* () {});
```

#### low-level operator

```js
const takeLatest = (channel, callback) =>
  go(function* () {
    let lastTask;

    while (true) {
      const value = yield take(channel);
      lastTask && cancel(lastTask);
      lastTask = go(callback, value);
    }
  });
```

### takeLeading

#### Example

```js
takeLeading(ch, function* () {});
```

#### low-level operator

```js
const takeLeading = (channel, callback) =>
  go(function* () {
    let executable = true;

    while (true) {
      const value = yield take(channel);

      if (executable) {
        executable = false;
        go(callback, value).finally(() => {
          executable = true;
        });
      }
    }
  });
```

### throttle

#### Example

```js
throttle(ch, function* () {}, 1000);
```

#### low-level operator

```ts
type ThrottleConfig = Partial<{
  leading: boolean;
  trailing: boolean;
}>;

const defaultConfig: Required<ThrottleConfig> = {
  leading: true,
  trailing: false,
};

const throttle = (channel, callback, ms, config) =>
  go(function* () {
    const options = Object.assign({}, defaultConfig, {
      ...config,
    });
    let timerId = -1;
    let leadingValue;
    let trailingValue;

    while (true) {
      const value = yield take(channel);
      trailingValue = value;

      if (timerId !== -1) continue;

      if (options.leading) {
        leadingValue = value;
        go(callback, value);
      }

      timerId = setTimeout(() => {
        if (
          options.trailing &&
          (!options.leading || leadingValue !== trailingValue)
        ) {
          go(callback, trailingValue);
        }
        timerId = -1;
      }, ms);
    }
  });
```
