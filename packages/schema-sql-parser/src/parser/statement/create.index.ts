import {
  isConcurrentlyValue,
  isExistsValue,
  isIfValue,
  isLeftParentToken,
  isNewStatement,
  isNotValue,
  isOnlyValue,
  isOnValue,
  isSemicolonToken,
  isStringToken,
  isUniqueValue,
  matchCreateIndex,
  matchKeyModifier,
  matchQualifiedName,
} from '@/parser/helper';
import { CreateIndex, RefPos, StatementType } from '@/parser/statement';
import { indexColumnsParser } from '@/parser/statement/index.columns';
import { Token } from '@/parser/tokenizer';

export function createIndexParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isUnique = isUniqueValue(tokens);
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isOn = isOnValue(tokens);
  const isOnly = isOnlyValue(tokens);
  const isConcurrently = isConcurrentlyValue(tokens);
  const isIf = isIfValue(tokens);
  const isNot = isNotValue(tokens);
  const isExists = isExistsValue(tokens);
  const createIndex = matchCreateIndex(tokens);
  const qualifiedName = matchQualifiedName(tokens);
  const keyModifier = matchKeyModifier(tokens);

  const isToken = () => $pos.value < tokens.length;

  // A qualified name keeps its last segment: pg_dump writes ON public.t, and
  // Oracle names both the index and the table "HR"."T".
  const readName = () => {
    const span = qualifiedName($pos.value);
    if (!span) return '';

    $pos.value += span;
    return tokens[$pos.value - 1].value;
  };

  const skipKeyModifiers = () => {
    let span = keyModifier($pos.value);

    while (span) {
      $pos.value += span;
      span = keyModifier($pos.value);
    }
  };

  const ast: CreateIndex = {
    type: StatementType.createIndex,
    name: '',
    unique: isUnique($pos.value + 1),
    tableName: '',
    columns: [],
  };

  // The dispatch loop only reaches here where the header matched, but this
  // parser is exported: a zero span would leave $pos on CREATE.
  $pos.value += createIndex($pos.value) || 1;

  // PostgreSQL may build the index CONCURRENTLY, skip it IF NOT EXISTS, and
  // leave it unnamed: CREATE INDEX ON t (a).
  if (isConcurrently($pos.value)) {
    $pos.value++;
  }

  if (isIf($pos.value) && isNot($pos.value + 1) && isExists($pos.value + 2)) {
    $pos.value += 3;
  }

  if (!isOn($pos.value)) {
    ast.name = readName();
  }

  while (isToken() && !newStatement($pos.value)) {
    // The terminator ends the statement; without it the loop runs on into
    // whatever follows, and a COMMENT ON right after is swallowed.
    if (isSemicolon($pos.value)) {
      $pos.value++;
      break;
    }

    // Only the first ON names the table: SQL Server's ON [PRIMARY] after the
    // key list names a filegroup.
    if (isOn($pos.value) && !ast.tableName) {
      $pos.value++;

      // pg_dump's ON ONLY, unless the table is itself named only.
      if (isOnly($pos.value) && isString($pos.value + 1)) {
        $pos.value++;
      }

      ast.tableName = readName();

      if (ast.tableName) {
        skipKeyModifiers();

        if (isLeftParent($pos.value)) {
          ast.columns = indexColumnsParser(tokens, $pos);
        }
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}
