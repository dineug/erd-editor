import { GenerateTemplateContext } from '@/internal-types/GenerateTemplateContext';
import { Ref } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { closestElement } from '@/core/helper';
import { GenerateTemplateElement } from '@/components/GenerateTemplateElement';

interface ContextRef {
  api: GenerateTemplateContext;
}

type ContextTuple = readonly [Ref<any>, ContextRef];

export function useContext(): ContextTuple {
  const elementRef = useRef<HTMLElement>();
  const contextRef: any = {};

  useEffect(() => {
    const el = closestElement(
      'vuerd-plugin-generate-template',
      elementRef.current
    ) as GenerateTemplateElement;

    contextRef.api = el.api;
  });

  return [elementRef, contextRef];
}
