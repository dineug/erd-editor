import type { Store } from '@/store';

const key = '__REDUX_DEVTOOLS_EXTENSION__';
type Unsubscribe = () => void;

export function reduxDevtools<S, C>(
  store: Store<S, C>,
  config?: any
): Unsubscribe {
  const reduxDevtoolsExtension = Reflect.get(window, key);
  const devTools = reduxDevtoolsExtension?.connect(config);
  devTools?.init(store.state);

  const unsubscribe = store.subscribe(actions => {
    devTools?.send(
      {
        type: actions.map(action => action.type).join(' |> '),
        actions,
      },
      store.state
    );
  });

  return () => {
    devTools?.unsubscribe();
    unsubscribe();
  };
}
