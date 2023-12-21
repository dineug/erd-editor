import { TEMPLATE_LITERALS } from '@/constants';
import { cssParser } from '@/parser';
import {
  CSSTemplate,
  cssTemplateCache,
  CSSTemplateLiterals,
  TemplateLiteralsType,
} from '@/template';
import { createMarker } from '@/template/helper';
import { createTCNode } from '@/template/tcNode';
import { vRender } from '@/template/vCSSStyleSheet';

export const css = (
  strings: TemplateStringsArray,
  ...values: any[]
): CSSTemplateLiterals => {
  const templateLiterals = {
    strings,
    values,
    [TEMPLATE_LITERALS]: TemplateLiteralsType.css,
  } as CSSTemplateLiterals;

  if (cssTemplateCache.has(strings)) {
    const template = cssTemplateCache.get(strings) as CSSTemplate;
    const identifier = vRender(template.node, values);

    templateLiterals.template = template;
    templateLiterals.toString = () => identifier;
    // return Object.freeze(templateLiterals);
    return templateLiterals;
  }

  const tpl = strings.raw
    .reduce<Array<string>>((acc, cur, i) => {
      i < values.length ? acc.push(cur, createMarker(i)) : acc.push(cur);
      return acc;
    }, [])
    .join('');

  const node = createTCNode(cssParser(tpl));
  const identifier = vRender(node, values);

  templateLiterals.template = Object.freeze({ node });
  templateLiterals.toString = () => identifier;
  cssTemplateCache.set(strings, templateLiterals.template);
  // return Object.freeze(templateLiterals);
  return templateLiterals;
};
