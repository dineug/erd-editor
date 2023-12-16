import { arrayHas } from '@dineug/shared';

export function addAndSort(ids: string[], seqIds: string[], id: string) {
  const hasSeqId = arrayHas(seqIds);

  if (hasSeqId(id)) {
    const idIndices = seqIds.reduce(
      (acc: Record<string, number>, cur, index) => {
        acc[cur] = index;
        return acc;
      },
      {}
    );

    ids.push(id);
    ids.sort((a, b) => {
      const indexA = idIndices[a];
      const indexB = idIndices[b];

      return indexA === undefined
        ? 1
        : indexB === undefined
        ? -1
        : indexA - indexB;
    });
  } else {
    ids.push(id);
    seqIds.push(id);
  }
}
