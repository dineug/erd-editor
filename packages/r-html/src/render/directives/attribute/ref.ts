import { createAttributeDirective } from '@/render/directives/attributeDirective';

export interface Ref<T = unknown> {
  value: T;
}

export const createRef = <T>(value?: T): Ref<T> => ({ value }) as Ref<T>;

type RefFn = <T>(refObject: Ref<T>) => Ref<T>;

export const ref = createAttributeDirective(
  <T>(refObject: Ref<T>) => refObject,
  ({ node }) => {
    let prevRefObject: Ref<any> | null = null;

    const destroy = () => {
      if (!prevRefObject) return;
      prevRefObject.value = null;
    };

    return refObject => {
      if (prevRefObject === refObject) return destroy;

      refObject.value = node;
      prevRefObject = refObject;

      return destroy;
    };
  }
) as unknown as RefFn;
