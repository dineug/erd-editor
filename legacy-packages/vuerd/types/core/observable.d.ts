export type PropName = string | number | symbol;
export type Observer = () => void;
export type Unsubscribe = () => void;
export type SubjectObserver<T> = (value: T) => void;

export declare function observable<T>(raw: T): T;
export declare function observer(f: Observer): Unsubscribe;
export declare function watch(
  proxy: any,
  observer: SubjectObserver<PropName>
): Unsubscribe;
