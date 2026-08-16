// @ts-ignore — no `@types/babel__core` in this workspace; the existing plugin
// in `../index.ts` reaches for the same untyped surface.
import { parseSync } from '@babel/core';

import { escapeTemplateAttrValue, escapeTemplateText } from './escape';
import { cleanJsxText } from './text';

/**
 * Elements that exist only in the SVG namespace. A template whose root is one
 * of these has to be tagged `svg` rather than `html`, because `TNode.isSvg`
 * only ever becomes true from a literal `<svg>` tag inside the template — a
 * root `<path>` has nothing above it to inherit from and would otherwise be
 * created in the HTML namespace and draw nothing.
 */
const SVG_ONLY_TAGS = new Set([
  'svg',
  'circle',
  'clipPath',
  'defs',
  'ellipse',
  'foreignObject',
  'g',
  'line',
  'linearGradient',
  'marker',
  'mask',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'stop',
  'symbol',
  'text',
  'textPath',
  'tspan',
  'use',
]);

/**
 * `a`, `script`, `style` and `title` are defined by both HTML and SVG and are
 * deliberately absent above, so they resolve to HTML — the same way
 * `JSX.IntrinsicElements` resolves them, since SVG only contributes the names
 * HTML does not already define.
 *
 * The SVG spelling of those four still works: it has to sit inside an `<svg>`
 * in the same template, where the namespace comes from that root rather than
 * from this map. A component whose own root is an SVG `<title>` would be the
 * one broken case, and the type layer already rules it out by giving those
 * tags HTML attributes.
 */

/** `on:click__2` — the escape hatch for the one thing JSX cannot say twice. */
const DUPLICATE_EVENT_SUFFIX = /__\d+$/;

/**
 * A `.tsx` that writes only JSX has no reason to import `html`, but the code it
 * compiles to calls it. The tags are injected under aliases rather than their
 * own names so that a file part-way through conversion — some JSX, some
 * hand-written `html``` — keeps both, and neither shadows the other.
 */
const HTML_TAG = '__rHtml';
const SVG_TAG = '__rSvg';
const DEFAULT_IMPORT_SOURCE = '@dineug/r-html';

const SKIP_KEYS = new Set([
  'loc',
  'extra',
  'comments',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'tokens',
]);

type Node = any;

function fail(node: Node, filename: string, message: string): never {
  const line = node?.loc?.start?.line ?? 0;
  const column = (node?.loc?.start?.column ?? 0) + 1;
  throw new Error(`[r-html-jsx] ${filename}:${line}:${column} — ${message}`);
}

function walk(
  node: Node,
  visit: (node: Node) => boolean | void,
  seen = new Set<Node>()
) {
  if (!node || typeof node.type !== 'string' || seen.has(node)) return;
  seen.add(node);

  if (visit(node)) return;

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit, seen);
    } else if (value && typeof value.type === 'string') {
      walk(value, visit, seen);
    }
  }
}

const isJsxNode = (node: Node) =>
  node.type === 'JSXElement' || node.type === 'JSXFragment';

/** The JSX nodes inside `root` that have no JSX ancestor below `root`. */
function findOutermostJsx(root: Node): Node[] {
  const found: Node[] = [];
  walk(root, node => {
    if (!isJsxNode(node)) return;
    found.push(node);
    return true;
  });
  return found.sort((a, b) => a.start - b.start);
}

const isComponentName = (name: Node): boolean =>
  name.type === 'JSXMemberExpression' ||
  (name.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name));

function nameSource(name: Node, filename: string): string {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    return `${nameSource(name.object, filename)}.${name.property.name}`;
  }
  return fail(name, filename, `unsupported tag name \`${name.type}\``);
}

/** Children that survive JSX whitespace cleaning. */
function meaningfulChildren(children: Node[]): Node[] {
  return children.filter(child => {
    if (child.type === 'JSXText') return cleanJsxText(child.value) !== '';
    if (child.type === 'JSXExpressionContainer') {
      return child.expression.type !== 'JSXEmptyExpression';
    }
    return true;
  });
}

class Codegen {
  readonly used = { html: false, svg: false };

  constructor(
    private readonly code: string,
    private readonly filename: string
  ) {}

  /** `html` or `svg` — decided once, at the root of each emitted template. */
  private resolveTag(node: Node): 'html' | 'svg' {
    const element =
      node.type === 'JSXElement'
        ? node
        : meaningfulChildren(node.children).find(
            (child: Node) => child.type === 'JSXElement'
          );
    if (!element) return 'html';

    const name = element.openingElement.name;
    if (isComponentName(name)) return 'html';
    if (name.type !== 'JSXIdentifier') return 'html';

    return SVG_ONLY_TAGS.has(name.name) ? 'svg' : 'html';
  }

  emitRoot(node: Node): string {
    const tag = this.resolveTag(node);
    const body =
      node.type === 'JSXFragment'
        ? this.emitChildren(node.children)
        : this.emitElement(node);

    this.used[tag] = true;
    return `${tag === 'svg' ? SVG_TAG : HTML_TAG}\`${body}\``;
  }

  /** Source text of an expression, with any JSX inside it converted first. */
  private emitExpr(node: Node): string {
    if (isJsxNode(node)) return this.emitRoot(node);

    const base = node.start;
    let source = this.code.slice(node.start, node.end);
    for (const jsx of findOutermostJsx(node).reverse()) {
      source =
        source.slice(0, jsx.start - base) +
        this.emitRoot(jsx) +
        source.slice(jsx.end - base);
    }
    return source;
  }

  private emitAttributes(attributes: Node[], isComponent: boolean): string {
    let out = '';

    for (const attr of attributes) {
      if (attr.type === 'JSXSpreadAttribute') {
        out += ` ...\${${this.emitExpr(attr.argument)}}`;
        continue;
      }

      const { name, value } = attr;
      let attrName: string;

      if (name.type === 'JSXNamespacedName') {
        const ns = name.namespace.name;
        const local = name.name.name;

        if (ns === 'use') {
          // A bare marker in attribute position — `TAttrType.directive`. The
          // local name is for the reader; r-html keys the directive off the
          // value alone.
          if (!value || value.type !== 'JSXExpressionContainer') {
            return fail(
              attr,
              this.filename,
              `\`use:${local}\` needs an expression value, e.g. use:${local}={${local}(target)}`
            );
          }
          out += ` \${${this.emitExpr(value.expression)}}`;
          continue;
        }

        attrName =
          ns === 'bool'
            ? `?${local}`
            : ns === 'on'
              ? `@${local.replace(DUPLICATE_EVENT_SUFFIX, '')}`
              : ns === 'prop'
                ? `.${local}`
                : fail(
                    attr,
                    this.filename,
                    `unknown attribute namespace \`${ns}:\`. Use bool:, on:, prop: or use:.`
                  );
      } else if (name.type === 'JSXIdentifier') {
        // Every component attribute carries the dot. `.x` and `x` reach the
        // same `PropPart`/`setProps` destination, but `getAttrType` classifies
        // any bare name starting with `on` as an event — so an undotted
        // `once=` would be read as an event named `ce` and vanish.
        attrName = isComponent ? `.${name.name}` : name.name;
      } else {
        attrName = fail(
          attr,
          this.filename,
          `unsupported attribute name \`${name.type}\``
        );
      }

      if (!value) {
        out += ` ${attrName}`;
      } else if (value.type === 'StringLiteral') {
        out += ` ${attrName}="${escapeTemplateAttrValue(value.value)}"`;
      } else if (value.type === 'JSXExpressionContainer') {
        // No `JSXEmptyExpression` branch here: unlike a child container, an
        // empty attribute expression is a parse error, so it never arrives.
        out += ` ${attrName}=\${${this.emitExpr(value.expression)}}`;
      } else if (isJsxNode(value)) {
        out += ` ${attrName}=\${${this.emitRoot(value)}}`;
      } else {
        return fail(
          attr,
          this.filename,
          `unsupported attribute value \`${value.type}\``
        );
      }
    }

    return out;
  }

  private emitComponent(node: Node): string {
    const opening = node.openingElement;
    const ref = nameSource(opening.name, this.filename);
    let out = `<\${${ref}}`;
    out += this.emitAttributes(opening.attributes, true);

    const children = meaningfulChildren(node.children);
    if (children.length) {
      const hasChildrenAttr = opening.attributes.some(
        (attr: Node) =>
          attr.type === 'JSXAttribute' &&
          attr.name.type === 'JSXIdentifier' &&
          attr.name.name === 'children'
      );
      if (hasChildrenAttr) {
        return fail(
          node,
          this.filename,
          `<${ref}> has both a \`children\` attribute and JSX children`
        );
      }
      const inner = this.emitChildren(node.children);
      this.used.html = true;
      out += ` .children=\${${HTML_TAG}\`${inner}\`}`;
    }

    // r-html has no slot: a component tag never carries markup children, so it
    // is always emitted self-closing and its children ride in as a prop.
    return `${out} />`;
  }

  private emitIntrinsic(node: Node): string {
    const opening = node.openingElement;
    const tag = nameSource(opening.name, this.filename);
    const attrs = this.emitAttributes(opening.attributes, false);
    const children = meaningfulChildren(node.children);

    return children.length || !opening.selfClosing
      ? `<${tag}${attrs}>${this.emitChildren(node.children)}</${tag}>`
      : `<${tag}${attrs} />`;
  }

  private emitElement(node: Node): string {
    return isComponentName(node.openingElement.name)
      ? this.emitComponent(node)
      : this.emitIntrinsic(node);
  }

  emitChildren(children: Node[]): string {
    let out = '';

    for (const child of children) {
      switch (child.type) {
        case 'JSXText': {
          out += escapeTemplateText(cleanJsxText(child.value));
          break;
        }
        case 'JSXExpressionContainer': {
          if (child.expression.type === 'JSXEmptyExpression') break;
          out += `\${${this.emitExpr(child.expression)}}`;
          break;
        }
        case 'JSXElement': {
          out += this.emitElement(child);
          break;
        }
        case 'JSXFragment': {
          out += this.emitChildren(child.children);
          break;
        }
        case 'JSXSpreadChild': {
          return fail(
            child,
            this.filename,
            '`{...children}` is not supported; spread into an array instead'
          );
        }
        default: {
          return fail(
            child,
            this.filename,
            `unsupported child \`${child.type}\``
          );
        }
      }
    }

    return out;
  }
}

const lineCount = (value: string) => value.split('\n').length;

/**
 * Rewrites every JSX tree in `code` as the `html`/`svg` tagged template it
 * stands for, and leaves the rest of the file untouched byte for byte.
 *
 * The output is spliced, not re-printed, so nothing outside a JSX range moves —
 * and each replacement is padded back up to the line count it replaced, which
 * keeps every line number after it pointing where it did before.
 */
export function transformJsxToTagged(
  code: string,
  filename = '<unknown>',
  importSource = DEFAULT_IMPORT_SOURCE
) {
  const ast = parseSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    parserOpts: {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    },
  });
  if (!ast) return null;

  const roots = findOutermostJsx(ast.program);
  if (!roots.length) return null;

  const codegen = new Codegen(code, filename);
  let out = code;

  for (const root of roots.reverse()) {
    const original = code.slice(root.start, root.end);
    const replacement = codegen.emitRoot(root);
    const missingLines = lineCount(original) - lineCount(replacement);
    out =
      out.slice(0, root.start) +
      replacement +
      (missingLines > 0 ? '\n'.repeat(missingLines) : '') +
      out.slice(root.end);
  }

  const specifiers = [
    codegen.used.html && `html as ${HTML_TAG}`,
    codegen.used.svg && `svg as ${SVG_TAG}`,
  ].filter(Boolean);

  // Prepended without a newline so it shares line 1 with whatever was already
  // there. An import on its own line would push the whole file down one and
  // undo the line-count padding above.
  return specifiers.length
    ? `import { ${specifiers.join(', ')} } from '${importSource}';${out}`
    : out;
}
