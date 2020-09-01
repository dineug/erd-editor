import { Token } from "./SQLParserHelper";
import { CreateIndex, createIndex } from "./create.index";

export function createUniqueIndex(tokens: Token[]): CreateIndex {
  return createIndex(tokens, true);
}
