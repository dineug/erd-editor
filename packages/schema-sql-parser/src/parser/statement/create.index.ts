import {
  isAndValue,
  isConcurrentlyValue,
  isExistsValue,
  isIfValue,
  isIsValue,
  isLeftParentToken,
  isNewStatement,
  isNotValue,
  isNullValue,
  isOnlyValue,
  isOnValue,
  isOrValue,
  isRightParentToken,
  isSemicolonToken,
  isStringToken,
  isUniqueValue,
  isWhereValue,
  matchCreateIndex,
  matchKeyModifiers,
  matchQualifiedName,
} from '@/parser/helper';
import {
  CreateIndex,
  IndexColumn,
  RefPos,
  StatementType,
} from '@/parser/statement';
import { indexColumnsParser } from '@/parser/statement/index.columns';
import { Token } from '@/parser/tokenizer';

export function createIndexParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isUnique = isUniqueValue(tokens);
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isOn = isOnValue(tokens);
  const isOnly = isOnlyValue(tokens);
  const isConcurrently = isConcurrentlyValue(tokens);
  const isIf = isIfValue(tokens);
  const isNot = isNotValue(tokens);
  const isExists = isExistsValue(tokens);
  const isWhere = isWhereValue(tokens);
  const isAnd = isAndValue(tokens);
  const isOr = isOrValue(tokens);
  const isIs = isIsValue(tokens);
  const isNull = isNullValue(tokens);
  const createIndex = matchCreateIndex(tokens);
  const qualifiedName = matchQualifiedName(tokens);
  const keyModifiers = matchKeyModifiers(tokens);

  const isToken = () => $pos.value < tokens.length;

  // A qualified name keeps its last segment: pg_dump writes ON public.t, and
  // Oracle names both the index and the table "HR"."T".
  const readName = () => {
    const span = qualifiedName($pos.value);
    if (!span) return '';

    $pos.value += span;
    return tokens[$pos.value - 1].value;
  };

  const skipParents = () => {
    while (isLeftParent($pos.value) || isRightParent($pos.value)) {
      $pos.value++;
    }
  };

  // Whether the WHERE at $pos only drops rows with a NULL in the key, one key
  // column IS NOT NULL or several joined by AND, SQL Server's parentheses
  // included. Leaves $pos past what it read.
  const isNullFilter = (columns: IndexColumn[]) => {
    const names = new Set(columns.map(({ name }) => name.toUpperCase()));

    do {
      $pos.value++;
      skipParents();

      if (
        !isString($pos.value) ||
        !names.has(tokens[$pos.value].value.toUpperCase()) ||
        !isIs($pos.value + 1) ||
        !isNot($pos.value + 2) ||
        !isNull($pos.value + 3)
      ) {
        return false;
      }

      $pos.value += 4;
      skipParents();
    } while (isAnd($pos.value));

    return !isOr($pos.value);
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
        $pos.value += keyModifiers($pos.value);

        if (isLeftParent($pos.value)) {
          ast.columns = indexColumnsParser(tokens, $pos);
        }
      }

      continue;
    }

    // A partial index keys only the rows its WHERE picks: unconditioned it is
    // a stricter key, so it reads as not unique. A NULL filter stays unique, as
    // it drops only rows the SQL standard's UNIQUE already lets repeat.
    if (isWhere($pos.value) && ast.unique) {
      ast.unique = isNullFilter(ast.columns);
      continue;
    }

    $pos.value++;
  }

  return ast;
}
