export const createStore =
  <S, A>(state: S, actions: A) =>
  (): [S, A] =>
    [state, actions];
