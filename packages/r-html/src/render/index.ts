import { ContainerPart } from '@/render/part/container';
import { TemplateLiterals } from '@/template';
import { isTemplateLiterals } from '@/template/helper';

export type Container = Element | ShadowRoot | DocumentFragment;

const renderCache = new WeakMap<Container, ContainerPart>();

export function render(
  container: Container,
  templateLiterals?: TemplateLiterals | null
) {
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
    const containerPart = new ContainerPart(templateLiterals);
    oldContainerPart?.destroy();
    renderCache.set(container, containerPart);
    containerPart.insert('children', container);
    containerPart.commit(values);
  }
}
