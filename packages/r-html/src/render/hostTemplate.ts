import type { HostAdapter, HostNode } from '@/render/adapter';
import { createHostHelper } from '@/render/helper';
import { ContainerPart } from '@/render/part/container';
import type { DOMTemplateLiterals, TemplateLiterals } from '@/template';
import { isTemplateLiterals } from '@/template/helper';
import { html, svg } from '@/template/html';

export type HostContainer = HostNode;

export type HostTag = (
  strings: TemplateStringsArray,
  ...values: any[]
) => DOMTemplateLiterals;

/**
 * What one host renders through. The container type is the parameter a host
 * names for itself, so the DOM instance keeps taking a Container and a Konva
 * one takes a Stage, without either widening the other.
 */
export interface HostTemplate<T extends HostContainer = HostContainer> {
  html: HostTag;
  svg: HostTag;
  render(container: T, templateLiterals?: TemplateLiterals | null): void;
}

/**
 * Binds a host's render entry to its adapter. Each instance owns the container
 * cache its own render writes, so two hosts never answer for one root; the tags
 * ride along because parsing is the same work for every host.
 */
export function createHostTemplate<T extends HostContainer = HostContainer>(
  adapter: HostAdapter
): HostTemplate<T> {
  const helper = createHostHelper(adapter);
  const renderCache = new WeakMap<T, ContainerPart>();

  const render = (
    container: T,
    templateLiterals?: TemplateLiterals | null
  ): void => {
    if (!isTemplateLiterals(templateLiterals)) {
      if (renderCache.has(container)) {
        renderCache.get(container)?.destroy();
        renderCache.delete(container);
      }
      return;
    }

    const { strings, values } = templateLiterals;
    const oldContainerPart = renderCache.get(container);
    const isRecommit = oldContainerPart?.equalStrings(strings);

    if (isRecommit) {
      oldContainerPart?.commit(values);
    } else {
      const containerPart = new ContainerPart(
        templateLiterals,
        undefined,
        undefined,
        helper
      );
      oldContainerPart?.destroy();
      renderCache.set(container, containerPart);
      containerPart.insert('children', container);
      containerPart.commit(values);
    }
  };

  return { html, svg, render };
}
