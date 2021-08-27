import { useEffect, useRef } from 'preact/hooks';
import tippy, {
  createSingleton,
  CreateSingletonInstance,
  Instance,
  Props,
} from 'tippy.js';

import { useContext } from '@/hooks/useContext';

export function useTooltip(tooltipCount: number, options: Partial<Props> = {}) {
  const { host } = useContext();
  const instancesRef = useRef<Array<Instance>>([]);
  const singletonRef = useRef<CreateSingletonInstance>(null);
  const elementsRef = useRef(
    Array.from({ length: tooltipCount }, () => useRef<any>(null))
  );

  const createTooltip = () => {
    instancesRef.current = tippy(
      elementsRef.current
        .filter(elRef => elRef.current)
        .map(elRef => elRef.current) as HTMLElement[],
      {
        appendTo: host as unknown as Element,
        trigger: 'manual',
      }
    );

    singletonRef.current = createSingleton(
      instancesRef.current,
      Object.assign(
        {
          appendTo: host as unknown as Element,
          delay: [500, 100],
          moveTransition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        },
        options
      )
    );
  };

  const destroyTooltip = () => {
    singletonRef.current?.destroy();
    instancesRef.current.forEach(instance => instance.destroy());
    singletonRef.current = null;
    instancesRef.current = [];
  };

  useEffect(
    () => {
      createTooltip();
      return () => destroyTooltip();
    },
    elementsRef.current.map(elRef => elRef.current)
  );

  return [elementsRef];
}
