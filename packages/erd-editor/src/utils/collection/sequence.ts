import { arrayHas } from '@dineug/shared';

export function addAndSort(ids: string[], seqIds: string[], id: string) {
  const hasSeqId = arrayHas(seqIds);

  if (hasSeqId(id)) {
    ids.push(id);
    ids.sort((a, b) => seqIds.indexOf(a) - seqIds.indexOf(b));
  } else {
    ids.push(id);
    seqIds.push(id);
  }
}
