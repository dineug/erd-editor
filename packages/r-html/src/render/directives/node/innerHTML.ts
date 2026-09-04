import { createNodeDirective } from '@/render/directives/nodeDirective';
import { insertBeforeNode, removeRange } from '@/render/helper';

export const innerHTML = createNodeDirective(
  (value: string) => value,
  ({ startNode, endNode }) => {
    let prevValue: string | null = null;

    const destroy = () => {
      removeRange(startNode, endNode);
    };

    return value => {
      if (prevValue === value) return destroy;

      destroy();
      const template = document.createElement('template');
      template.innerHTML = value;
      insertBeforeNode(template.content, endNode);

      prevValue = value;

      return destroy;
    };
  }
);
