import {
  addChild,
  addProperty,
  isAtRule,
  isDynamicProperty,
  isEndMultiCommentValue,
  isEndSingleCommentValue,
  isLeftBraceToken,
  isProperty,
  isRightBraceToken,
  isSelector,
  isSemicolonToken,
  isStartMultiCommentValue,
  isStartSingleCommentValue,
} from '@/parser/css/helper';
import { Token, tokenizer } from '@/parser/css/tokenizer';
import { VCNode, VCNodeType } from '@/parser/vcNode';

export function parser(tokens: Token[]) {
  let pos = 0;

  const isToken = () => pos < tokens.length;
  const property = isProperty(tokens);
  const dynamicProperty = isDynamicProperty(tokens);
  const selector = isSelector(tokens);
  const leftBraceToken = isLeftBraceToken(tokens);
  const rightBraceToken = isRightBraceToken(tokens);
  const startMultiCommentValue = isStartMultiCommentValue(tokens);
  const endMultiCommentValue = isEndMultiCommentValue(tokens);
  const startSingleCommentValue = isStartSingleCommentValue(tokens);
  const endSingleCommentValue = isEndSingleCommentValue(tokens);
  const atRule = isAtRule(tokens);
  const semicolonToken = isSemicolonToken(tokens);

  const walkNode = (
    parent: VCNode | null,
    value?: string,
    type = VCNodeType.style
  ) => {
    const node = new VCNode({
      type,
      parent,
      value,
    });

    while (isToken()) {
      let token = tokens[pos];

      if (rightBraceToken(pos)) {
        pos++;
        break;
      }

      if (property(pos)) {
        const valueToken = tokens[pos + 3];

        addProperty(node)({
          name: token.value,
          value: valueToken.value,
        });

        pos += 5;
        continue;
      } else if (dynamicProperty(pos)) {
        const valueToken = tokens[pos + 2];
        const value = `@@${valueToken.value}`;

        addProperty(node)({
          name: value,
          value,
        });

        pos += 4;
        continue;
      } else if (startMultiCommentValue(pos)) {
        let value = token.value;
        token = tokens[++pos];

        while (isToken() && !endMultiCommentValue(pos)) {
          value += token.value;
          token = tokens[++pos];
        }
        value += token.value;

        addChild(node)(
          new VCNode({
            type: VCNodeType.comment,
            parent: node,
            value,
          })
        );

        pos++;
        continue;
      } else if (startSingleCommentValue(pos)) {
        let value = token.value;
        token = tokens[++pos];

        while (isToken() && !endSingleCommentValue(pos)) {
          value += token.value;
          token = tokens[++pos];
        }

        addChild(node)(
          new VCNode({
            type: VCNodeType.comment,
            parent: node,
            value,
          })
        );

        pos++;
        continue;
      } else if (atRule(pos)) {
        let value = token.value;
        token = tokens[++pos];

        while (isToken() && !leftBraceToken(pos) && !semicolonToken(pos)) {
          value += token.value;
          token = tokens[++pos];
        }

        if (semicolonToken(pos)) {
          value += ';';

          addChild(node)(
            new VCNode({
              type: VCNodeType.atRule,
              parent: node,
              value,
            })
          );

          pos++;
          continue;
        }

        addChild(node)(walkNode(node, value.trim(), VCNodeType.atRule));
        continue;
      } else if (selector(pos)) {
        let value = token.value;
        token = tokens[++pos];

        while (isToken() && !leftBraceToken(pos)) {
          value += token.value;
          token = tokens[++pos];
        }

        addChild(node)(walkNode(node, value.trim()));
        continue;
      }

      pos++;
    }

    return node;
  };

  const ast = walkNode(null);
  return ast;
}

export const cssParser = (source: string) => parser(tokenizer(source));
