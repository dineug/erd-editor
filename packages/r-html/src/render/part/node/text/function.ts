import type { HostNode } from '@/render/adapter';
import { Part } from '@/render/part';

export class FunctionPart implements Part {
  constructor(startNode: HostNode, endNode: HostNode) {}

  commit(value: any) {}
}
