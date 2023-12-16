import { Token, tokenizer } from '@/parser/tokenizer';

function parser(tokens: Token[]) {
  const ast = null;
  let pos = 0;
  console.log('tokens', tokens);

  const isToken = () => pos < tokens.length;

  return ast;
}

export const schemaSQLParser = (source: string) => parser(tokenizer(source));
