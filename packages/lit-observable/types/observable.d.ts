export type PropName = string | number | symbol;
export type Observer = () => void;
export type Unsubscribe = () => void;
export type SubjectObserver<T> = (value: T) => void;

export interface Trigger {
  raw: any;
  keys: PropName[];
}

export interface NextTrigger {
  proxy: any;
  keys: PropName[];
}

export interface Subject<T> {
  next(value: T): void;
  subscribe(observer: SubjectObserver<T>): Unsubscribe;
}

export declare function observable<T>(raw: T): T;
export declare function observer(f: Observer): Unsubscribe;
export declare function createSubject<T>(): Subject<T>;
export declare function watch(
  proxy: any,
  observer: SubjectObserver<PropName>
): Unsubscribe;
