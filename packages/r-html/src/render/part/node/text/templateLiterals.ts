import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { Part } from '@/render/part';
import { ContainerPart } from '@/render/part/container';
import { TemplateLiterals } from '@/template';

export class TemplateLiteralsPart implements Part {
  #helper: HostHelper;
  #startNode: HostNode;
  #endNode: HostNode;
  #part: ContainerPart | null = null;

  constructor(
    startNode: HostNode,
    endNode: HostNode,
    helper: HostHelper = domHelper
  ) {
    this.#startNode = startNode;
    this.#endNode = endNode;
    this.#helper = helper;
  }

  commit(templateLiterals: TemplateLiterals) {
    const { strings, values } = templateLiterals;

    if (this.#part && !this.#part.equalStrings(strings)) {
      this.#part.destroy();
      this.#part = null;
    }

    if (!this.#part) {
      this.#part = new ContainerPart(
        templateLiterals,
        this.#startNode,
        this.#endNode,
        this.#helper
      );
      this.#part.insert('before', this.#endNode);
    }

    this.#part.commit(values);
  }

  destroy() {
    this.#part?.destroy();
  }
}
