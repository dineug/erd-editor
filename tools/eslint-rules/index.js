/**
 * The plugin surface for this repo's own lint rules.
 *
 * Each rule file default-exports one rule. oxlint's jsPlugins wants a plugin —
 * meta.name plus a rules map — not a rule, so the wrapping happens here. The
 * rules themselves are the ESLint rule API, which oxlint takes as-is. meta.name
 * fixes the namespace, so a rule key reads local/<file name>.
 *
 * @example
 * ```ts
 * // root vite.config.ts
 * lint: {
 *   jsPlugins: [{ name: 'local', specifier: './tools/eslint-rules/index.js' }],
 *   rules: { 'local/no-comment-markdown': 'error' },
 * }
 * ```
 */
import commentRunLimit from './comment-run-limit.js';
import jsdocAttached from './jsdoc-attached.js';
import jsdocProseLimit from './jsdoc-prose-limit.js';
import noCommentMarkdown from './no-comment-markdown.js';

export default {
  meta: { name: 'local' },
  rules: {
    'comment-run-limit': commentRunLimit,
    'jsdoc-attached': jsdocAttached,
    'jsdoc-prose-limit': jsdocProseLimit,
    'no-comment-markdown': noCommentMarkdown,
  },
};
