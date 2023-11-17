import { AnyAction } from '@dineug/r-html';
import { filter } from 'rxjs';

export const notEmptyActions = filter<Array<AnyAction>>(actions =>
  Boolean(actions.length)
);
