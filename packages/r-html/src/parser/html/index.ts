import {
  addAttr,
  addChild,
  isEmptyTag,
  isEmptyTagName,
  isEndCommentTag,
  isEndTag,
  isEqualToken,
  isGtToken,
  isLtToken,
  isSkipEndTag,
  isStartCommentTag,
  isStartTag,
  isStringToken,
  isWhiteSpaceToken,
} from '@/parser/html/helper';
import { Token, tokenizer } from '@/parser/html/tokenizer';
import { VAttr, VNode, VNodeType } from '@/parser/vNode';

export function parser(tokens: Token[]) {
  const ast = new VNode({
    type: VNodeType.element,
    value: 'template',
    children: [],
  });
  let pos = 0;

  const isToken = () => pos < tokens.length;
  const startTag = isStartTag(tokens);
  const endTag = isEndTag(tokens);
  const skipEndTag = isSkipEndTag(tokens);
  const emptyTag = isEmptyTag(tokens);
  const startCommentTag = isStartCommentTag(tokens);
  const endCommentTag = isEndCommentTag(tokens);
  const ltToken = isLtToken(tokens);
  const gtToken = isGtToken(tokens);
  const equalToken = isEqualToken(tokens);
  const whiteSpaceToken = isWhiteSpaceToken(tokens);
  const stringToken = isStringToken(tokens);

  const walkAttr = () => {
    let token = tokens[pos];
    const attr: VAttr = { name: token.value };
    token = tokens[++pos];

    if (equalToken(pos)) {
      token = tokens[++pos];

      if (stringToken(pos)) {
        attr.value = token.value;
        pos++;
      }
    }

    return attr;
  };

  const walkNode = (parent: VNode) => {
    let token = tokens[pos];

    if (whiteSpaceToken(pos) || stringToken(pos)) {
      let value = token.value;
      token = tokens[++pos];

      while (isToken() && !ltToken(pos)) {
        value += token.value;
        token = tokens[++pos];
      }

      value = value.trim();
      return value.length
        ? new VNode({ parent, type: VNodeType.text, value })
        : null;
    }

    if (startCommentTag(pos)) {
      let value = '';
      pos += 2;
      token = tokens[pos];

      while (isToken() && !endCommentTag(pos)) {
        value += token.value;
        token = tokens[++pos];
      }

      if (endCommentTag(pos)) {
        pos += 2;
      }

      return new VNode({ parent, type: VNodeType.comment, value });
    }

    if (startTag(pos)) {
      token = tokens[++pos];
      const hasEmptyTag = isEmptyTagName(token.value);
      const node = new VNode({
        parent,
        type: VNodeType.element,
        value: token.value.toLowerCase(),
      });
      pos++;

      while (isToken() && !gtToken(pos) && !emptyTag(pos)) {
        if (stringToken(pos)) {
          addAttr(node)(walkAttr());
          continue;
        }
        pos++;
      }

      if (emptyTag(pos)) {
        pos += 2;
        return node;
      }

      token = tokens[++pos];

      while (isToken() && !endTag(pos) && !skipEndTag(pos) && !hasEmptyTag) {
        addChild(node)(walkNode(node));
      }

      if (endTag(pos) || skipEndTag(pos)) {
        pos += 4;
      }

      return node;
    }

    pos++;
    return null;
  };

  while (isToken()) {
    addChild(ast)(walkNode(ast));
  }

  return ast;
}

export const htmlParser = (source: string) => parser(tokenizer(source));
