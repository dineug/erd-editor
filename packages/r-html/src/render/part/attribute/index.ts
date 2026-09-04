import { TAttrType } from '@/constants';
import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { AttributePart } from '@/render/part/attribute/attribute';
import { BooleanPart } from '@/render/part/attribute/boolean';
import { DirectivePart } from '@/render/part/attribute/directive';
import { EventPart } from '@/render/part/attribute/event';
import { PropertyPart } from '@/render/part/attribute/property';
import { SpreadPart } from '@/render/part/attribute/spread';
import { TAttr } from '@/template/tNode';

export const createAttrPart = (
  node: HostNode,
  attr: TAttr,
  helper: HostHelper = domHelper
) =>
  attr.type === TAttrType.attribute
    ? new AttributePart(node, attr, helper)
    : attr.type === TAttrType.boolean
      ? new BooleanPart(node, attr, helper)
      : attr.type === TAttrType.event
        ? new EventPart(node, attr, helper)
        : attr.type === TAttrType.property
          ? new PropertyPart(node, attr)
          : attr.type === TAttrType.spread
            ? new SpreadPart(node, attr)
            : new DirectivePart(node, attr);
