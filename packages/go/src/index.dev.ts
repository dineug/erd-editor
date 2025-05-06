import { all, channel, CO, delay, flush, go, put, race, take } from '@/index';

const inputChannel = channel<number>();
const outputChannel = channel<number>();

const foo: CO = function* () {
  console.log('start');
  const value = yield take(inputChannel);
  console.log('take:value', value);
  const value2 = yield go((v: any) => v, value);
  console.log('call:value', value2);
  yield put(outputChannel, 1234);

  go(function* () {
    const value = yield take(inputChannel);
    console.log('fork:take:value', value);
  });

  const values = yield all([
    go(() => 1),
    go(() => 2),
    Promise.resolve(3),
    Promise.resolve(4),
    5,
    6,
    take(inputChannel),
    take(inputChannel),
  ]);
  console.log('all:values', values);

  yield delay(2000);
  console.log('delay', 2000);

  const value3 = yield race({
    a: delay(100),
    b: delay(200),
    c: take(inputChannel),
  });
  console.log('race', value3);

  const value4 = yield flush(inputChannel);
  console.log('flush', value4);
};

for (let i = 0; i < 20; i++) {
  inputChannel.put(i);
}

go(foo);

outputChannel.take(value => {
  console.log('outputChannel', value);
});
