// @ts-ignore — no @types/babel__core in this workspace; the existing plugin
// in ../index.ts reaches for the same untyped surface.
import { parseSync } from '@babel/core';

import { escapeTemplateAttrValue, escapeTemplateText } from './escape';
import { cleanJsxText } from './text';

/**
 * Elements that exist only in the SVG namespace, whose template has to be
 * tagged svg. TNode.isSvg only becomes true from a literal svg tag inside the
 * template, so such a root has nothing above it to inherit from.
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

/** on:click__2 — the escape hatch for the one thing JSX cannot say twice. */
const DUPLICATE_EVENT_SUFFIX = /__\d+$/;

/**
 * A .tsx writing only JSX has no reason to import html, but the code it
 * compiles to calls it. The tags are injected under aliases so a file part-way
 * through conversion keeps both, and neither shadows the other.
 */
const HTML_TAG = '__rHtml';
const SVG_TAG = '__rSvg';
const KONVA_TAG = '__rKonva';
const DEFAULT_IMPORT_SOURCE = '@dineug/r-html';

/** The alias each template tag is emitted under, keyed by the tag it stands for. */
const TAG_ALIAS = {
  html: HTML_TAG,
  svg: SVG_TAG,
  konva: KONVA_TAG,
} as const;

/**
 * The prefix every konva tag carries. rect, circle, line and path are taken by
 * SVG already, so a konva scene never spells a bare name.
 */
const KONVA_TAG_PREFIX = 'k-';

/** Child expressions a konva node cannot hold — a shape takes no string or number. */
const PRIMITIVE_EXPRESSIONS = new Set(['StringLiteral', 'NumericLiteral']);

/** Attributes a konva node never carries; z-order and the DOM value paths are the host's. */
const KONVA_FORBIDDEN_ATTRS = new Set(['class', 'style', 'zIndex']);

/** The file pragma, which is the only thing that picks a host. */
const JSX_HOST_PRAGMA = /@jsxHost\s+(\S+)/;

type Host = 'dom' | 'konva';

type Tag = keyof typeof TAG_ALIAS;

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

/** The JSX nodes inside root that have no JSX ancestor below root. */
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
  readonly used = { html: false, svg: false, konva: false };

  constructor(
    private readonly code: string,
    private readonly filename: string,
    private readonly host: Host = 'dom'
  ) {}

  /**
   * html, svg or konva — decided once, at the root of each emitted template.
   * A konva file answers before the root is read, since the host is the file's.
   */
  private resolveTag(node: Node): Tag {
    if (this.host === 'konva') return 'konva';

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
    return `${TAG_ALIAS[tag]}\`${body}\``;
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
    const isKonvaNode = this.host === 'konva' && !isComponent;

    for (const attr of attributes) {
      if (attr.type === 'JSXSpreadAttribute') {
        if (isKonvaNode) {
          return fail(
            attr,
            this.filename,
            'a spread on a k-* tag is not supported; it would reach the node through Reflect.set, which the konva host does not read. Name the attributes.'
          );
        }
        out += ` ...\${${this.emitExpr(attr.argument)}}`;
        continue;
      }

      const { name, value } = attr;
      let attrName: string;

      if (name.type === 'JSXNamespacedName') {
        const ns = name.namespace.name;
        const local = name.name.name;

        if (ns === 'use') {
          // A bare marker in attribute position — TAttrType.directive. The
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
        if (isKonvaNode && KONVA_FORBIDDEN_ATTRS.has(name.name)) {
          return fail(
            attr,
            this.filename,
            `\`${name.name}\` is not a konva attribute. class and style commit through an HTMLElement check a konva node never passes, and z-order belongs to the host.`
          );
        }
        // Every component attribute carries the dot. Both spellings reach the
        // same prop destination, but getAttrType reads any bare name starting
        // with on as an event, so an undotted one would vanish.
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
        // No JSXEmptyExpression branch here: unlike a child container, an
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
      const tag: Tag = this.host === 'konva' ? 'konva' : 'html';
      this.used[tag] = true;
      out += ` .children=\${${TAG_ALIAS[tag]}\`${inner}\`}`;
    }

    // r-html has no slot: a component tag never carries markup children, so it
    // is always emitted self-closing and its children ride in as a prop.
    return `${out} />`;
  }

  /** One file, one host: a konva file holds only k-* tags, and a dom file none. */
  private checkHost(node: Node, tag: string) {
    const isKonvaTag = tag.startsWith(KONVA_TAG_PREFIX);

    if (this.host === 'konva' && !isKonvaTag) {
      return fail(
        node,
        this.filename,
        `<${tag}> is a DOM tag in a @jsxHost konva file, where every intrinsic is k-*. Move the DOM markup to a file of its own.`
      );
    }
    if (this.host !== 'konva' && isKonvaTag) {
      return fail(
        node,
        this.filename,
        `<${tag}> needs the @jsxHost konva pragma at the top of the file. The host is a file's, never a tag's.`
      );
    }
  }

  private emitIntrinsic(node: Node): string {
    const opening = node.openingElement;
    const tag = nameSource(opening.name, this.filename);
    this.checkHost(node, tag);
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

  /** A konva tree has no text node, so a bare string or number child has nowhere to land. */
  private failPrimitiveChild(child: Node): never {
    return fail(
      child,
      this.filename,
      'a konva tree has no text nodes, so a string or number child has nowhere to land. Put the value on a k-text `text` attribute.'
    );
  }

  emitChildren(children: Node[]): string {
    let out = '';

    for (const child of children) {
      switch (child.type) {
        case 'JSXText': {
          const text = cleanJsxText(child.value);
          if (text !== '' && this.host === 'konva') {
            return this.failPrimitiveChild(child);
          }
          out += escapeTemplateText(text);
          break;
        }
        case 'JSXExpressionContainer': {
          if (child.expression.type === 'JSXEmptyExpression') break;
          if (
            this.host === 'konva' &&
            PRIMITIVE_EXPRESSIONS.has(child.expression.type)
          ) {
            return this.failPrimitiveChild(child);
          }
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
 * The host every template in the file compiles to. A root tag cannot answer
 * this — a component root, an expression root and a component's children all
 * reach the emitter with no intrinsic in sight — so the file says it once.
 */
function resolveHost(ast: Node, filename: string) {
  const headerEnd = ast.program.body[0]?.start ?? Infinity;
  let host: Host = 'dom';
  let pragma: Node | null = null;

  for (const comment of ast.comments ?? []) {
    const match = JSX_HOST_PRAGMA.exec(comment.value);
    if (!match) continue;

    if (comment.type !== 'CommentBlock' || comment.start > headerEnd) {
      return fail(
        comment,
        filename,
        '@jsxHost is read from a block comment above the first statement. Anywhere else it decides nothing.'
      );
    }
    if (match[1] !== 'dom' && match[1] !== 'konva') {
      return fail(
        comment,
        filename,
        `unknown jsx host \`${match[1]}\`. Use @jsxHost dom or @jsxHost konva.`
      );
    }
    host = match[1];
    pragma = comment;
  }

  return { host, pragma };
}

/**
 * Rewrites every JSX tree as the tagged template it stands for and leaves the
 * rest of the file byte for byte. The output is spliced rather than re-printed,
 * and each replacement is padded back to the line count it replaced.
 */
export function transformJsxToTagged(
  code: string,
  filename = '<unknown>',
  importSource = DEFAULT_IMPORT_SOURCE,
  konvaImportSource?: string
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

  const { host, pragma } = resolveHost(ast, filename);
  if (host === 'konva' && !konvaImportSource) {
    fail(
      pragma,
      filename,
      '@jsxHost konva needs the konvaImportSource option — nothing else tells this plugin where the konva tag lives.'
    );
  }

  const codegen = new Codegen(code, filename, host);
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

  // Two sources, never two imports: a file is one host, so the konva tag and
  // the r-html tags are mutually exclusive.
  const imports = [
    specifiers.length &&
      `import { ${specifiers.join(', ')} } from '${importSource}';`,
    codegen.used.konva &&
      `import { konva as ${KONVA_TAG} } from '${konvaImportSource}';`,
  ].filter(Boolean);

  // Prepended without a newline so it shares line 1 with whatever was already
  // there. An import on its own line would push the whole file down one and
  // undo the line-count padding above.
  return imports.length ? `${imports.join('')}${out}` : out;
}
