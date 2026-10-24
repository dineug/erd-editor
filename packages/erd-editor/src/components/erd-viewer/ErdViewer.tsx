import {
  createSchema,
  parser,
  toDocumentJson,
} from '@dineug/erd-editor-schema';
import { createCustomElement, FC } from '@dineug/r-html';

import type { CustomElementClass } from '@/components/customElementClass';
import { toLoadValue } from '@/utils/loadValue';

declare global {
  interface HTMLElementTagNameMap {
    'erd-viewer': ErdViewerElement;
  }
}

export type ErdViewerProps = {
  /** Whether the minimap shows; the attribute turns it off only as "false". */
  minimap: boolean;
  /** Whether the view controls show; the attribute turns them off only as "false". */
  controls: boolean;
};

export interface ErdViewerElement extends ErdViewerProps, HTMLElement {
  /** The document in the form a file saves; setting it replaces the document. */
  value: string;
}

const ErdViewer: FC<ErdViewerProps, ErdViewerElement> = (_props, ctx) => {
  let schema = createSchema();

  Object.defineProperty(ctx, 'value', {
    get: () => toDocumentJson(schema),
    set: (value: string) => {
      schema = parser(toLoadValue(value));
    },
  });

  // A click, a tap or the Tab key focuses the root; mounting never does.
  return () => <div tabindex="0" />;
};

const TAG_NAME = 'erd-viewer';

/**
 * A part on by default that only the attribute value "false" turns off, so
 * removing the attribute or writing it bare shows the part again.
 */
const shownUnlessFalse = {
  type: (value: string | null) => value !== 'false',
  default: true,
};

/**
 * The element class, which nothing registers until defineErdViewer() runs or
 * a caller defines it under a tag of its own.
 */
export const ErdViewerElement: CustomElementClass<ErdViewerElement> =
  /* @__PURE__ */ createCustomElement<ErdViewerProps, ErdViewerElement>({
    shadow: 'closed',
    observedProps: {
      minimap: shownUnlessFalse,
      controls: shownUnlessFalse,
    },
    render: ErdViewer,
  });

/**
 * Defines erd-viewer as ErdViewerElement. A second call leaves the definition
 * as it is, and a tag another class already holds throws, naming the tag.
 */
export function defineErdViewer(): void {
  const defined = customElements.get(TAG_NAME);

  if (defined === ErdViewerElement) {
    return;
  }

  if (defined) {
    throw new Error(
      `Another element class already defines the custom element name ${TAG_NAME}`
    );
  }

  customElements.define(TAG_NAME, ErdViewerElement);
}
