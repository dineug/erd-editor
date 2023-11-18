import { Part } from '@/render/part';
import { ContainerPart } from '@/render/part/container';
import { TemplateLiterals } from '@/template';

export class TemplateLiteralsPart implements Part {
  #startNode: Comment;
  #endNode: Comment;
  #part: ContainerPart | null = null;

  constructor(startNode: Comment, endNode: Comment) {
    this.#startNode = startNode;
    this.#endNode = endNode;
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
        this.#endNode
      );
      this.#part.insert('before', this.#endNode);
    }

    this.#part.commit(values);
  }

  destroy() {
    this.#part?.destroy();
  }
}
