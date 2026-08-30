/**
 * jsdoc-attached
 *
 * A JSDoc block describes the declaration right below it. A block that
 * describes a file or a module has no such place — no tool shows it (it lands
 * on an import statement, or as the second block on the first declaration) and
 * it ages apart from the code. File-level narrative belongs in AGENTS.md, and a
 * claim the code has to keep belongs in a test.
 */

/** A statement that binds no local name — import, re-export, expression default. */
function declaresNothing(statement) {
  switch (statement.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
      return true;
    case 'ExportNamedDeclaration':
      return !statement.declaration;
    case 'ExportDefaultDeclaration':
      return !/Declaration$/.test(statement.declaration?.type ?? '');
    default:
      return false;
  }
}

/** Whether the block is narrative at all — a tags-only block is machine-read. */
function carriesProse(comment) {
  return comment.value
    .split('\n')
    .map(line => line.replace(/^\s*\*+/, '').trim())
    .some(line => line !== '' && !line.startsWith('@'));
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A JSDoc block describes the declaration below it. Blocks on imports and re-exports, and blocks stacked ahead of another block, describe nothing.',
    },
    schema: [],
    messages: {
      onImport:
        'JSDoc prose on a statement that binds no local name (import, re-export, expression default) — there is no declaration to describe. Delete it; file-level and barrel-level narrative lives in AGENTS.md. A tags-only block such as @type is machine-read and stays.',
      stacked:
        'Another block follows this one with no code between — only the last one attaches, so this block describes nothing (and splitting a block in two is how the prose bound gets walked around). Merge it into the block below or delete it.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      Program(node) {
        for (const statement of node.body) {
          if (!declaresNothing(statement)) continue;
          for (const comment of sourceCode.getCommentsBefore(statement)) {
            if (
              comment.type === 'Block' &&
              comment.value.startsWith('*') &&
              carriesProse(comment)
            ) {
              context.report({ loc: comment.loc, messageId: 'onImport' });
            }
          }
        }

        // Where several blocks look at the same code token, only the last one
        // describes it. A // separator between them is not code, so it does not
        // split the group.
        const owner = new Map();
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
            continue;
          }
          const token = sourceCode.getTokenAfter(comment, {
            includeComments: false,
          });
          const key = token === null ? 'eof' : token.range[0];
          owner.set(key, [...(owner.get(key) ?? []), comment]);
        }
        for (const group of owner.values()) {
          for (const comment of group.slice(0, -1)) {
            context.report({ loc: comment.loc, messageId: 'stacked' });
          }
        }
      },
    };
  },
};

export default rule;
