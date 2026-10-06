import { uuid25 } from '@dineug/uuid';

import { GeneratorAction } from '@/engine/generator.actions';
import {
  hasMappingIssues,
  hasMappingTargets,
  isSameResult,
  MapColumnsDraft,
  toMapColumnsActions,
  validateMapping,
} from '@/utils/map-columns';

export type MapColumnsActionOptions = {
  /** Called once, during the dispatch, when the diagram no longer takes the mapping. */
  onRefuse: () => void;
};

/**
 * Writes the mapping the dialog confirmed in one batch, judged by the state it
 * lands on: a result the diagram already holds writes nothing and says nothing,
 * while a table or relationship gone, or any issue, refuses it.
 */
export const mapColumnsAction$ = (
  draft: MapColumnsDraft,
  { onRefuse }: MapColumnsActionOptions
): GeneratorAction =>
  function* (state) {
    if (!hasMappingTargets(state, draft)) {
      onRefuse();
      return;
    }
    if (isSameResult(state, draft)) return;
    if (hasMappingIssues(validateMapping(state, draft), ['unchanged'])) {
      onRefuse();
      return;
    }

    yield toMapColumnsActions(state, draft, uuid25);
  };
