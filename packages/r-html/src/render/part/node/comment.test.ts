import { describe, expect, it } from 'vitest';

import { CommentPart } from '@/render/part/node/comment';
import { html } from '@/template/html';
import { TNode } from '@/template/tNode';

type TL = { template: { node: TNode } };

const commentTNode = (tl: TL) => (tl.template.node.children ?? [])[0];

function createPart(tl: TL) {
  const tNode = commentTNode(tl);
  const node = document.createComment(tNode.value);
  return { node, part: new CommentPart(node, tNode) };
}

describe('CommentPart', () => {
  it('replaces a single marker with the committed value', () => {
    const { node, part } = createPart(html`<!-- a ${'x'} b -->`);

    part.commit(['hello']);

    expect(node.data).toBe(' a hello b ');
  });

  it('replaces every marker positionally', () => {
    const { node, part } = createPart(html`<!-- ${'a'}|${'b'}|${'c'} -->`);

    part.commit(['1', '2', '3']);

    expect(node.data).toBe(' 1|2|3 ');
  });

  it('stringifies non-null primitive values', () => {
    const { node, part } = createPart(html`<!-- n:${0} -->`);

    part.commit([0]);
    expect(node.data).toBe(' n:0 ');

    part.commit([false]);
    expect(node.data).toBe(' n:false ');

    part.commit([10n]);
    expect(node.data).toBe(' n:10 ');

    part.commit([Symbol('s')]);
    expect(node.data).toBe(' n:Symbol(s) ');
  });

  it('renders an empty string for null, undefined and non-primitive values', () => {
    const { node, part } = createPart(html`<!-- [${'v'}] -->`);

    part.commit([null]);
    expect(node.data).toBe(' [] ');

    part.commit([undefined]);
    expect(node.data).toBe(' [] ');

    part.commit([{ a: 1 }]);
    expect(node.data).toBe(' [] ');

    part.commit([['a']]);
    expect(node.data).toBe(' [] ');

    part.commit([() => {}]);
    expect(node.data).toBe(' [] ');
  });

  it('skips the update when the committed values are unchanged', () => {
    const { node, part } = createPart(html`<!-- eq:${'v'} -->`);

    part.commit(['same']);
    expect(node.data).toBe(' eq:same ');

    node.data = 'externally changed';
    part.commit(['same']);
    expect(node.data).toBe('externally changed');

    part.commit(['other']);
    expect(node.data).toBe(' eq:other ');
  });

  it('only reads the marker indexes it owns', () => {
    const { node, part } = createPart(html`<!-- only ${'v'} -->`);

    part.commit(['taken', 'ignored']);

    expect(node.data).toBe(' only taken ');
  });

  it('does nothing when the comment has no markers', () => {
    const { node, part } = createPart(html`<!-- static -->`);

    part.commit(['whatever']);

    expect(node.data).toBe(' static ');
  });

  it('does nothing when the tNode value is not a string', () => {
    const node = document.createComment('untouched');
    const part = new CommentPart(node, { value: 123 } as unknown as TNode);

    part.commit(['whatever']);

    expect(node.data).toBe('untouched');
  });
});
