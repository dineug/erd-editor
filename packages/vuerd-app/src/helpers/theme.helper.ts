import kebabCase from 'lodash/kebabCase';
import {
  assoc,
  filter,
  join,
  keys,
  map,
  mergeAll,
  path,
  pipe,
  prop,
  reduce,
} from 'ramda';

import { Theme } from '@/store/ui/theme.store';

export function themeToString(theme: Theme) {
  const colorMap = pipe(
    keys,
    map(p =>
      pipe(
        keys,
        map(k => [p, k])
      )(prop(p)(theme))
    ),
    filter(prop('length') as any),
    reduce(
      (acc, group) =>
        pipe(
          map((keys: string[]) =>
            assoc(kebabCase(keys.join('.')), path(keys, theme), acc)
          ),
          mergeAll
        )(group),
      {}
    )
  )(theme);

  return pipe(
    keys,
    map(p => `--${p}:${prop(p)(colorMap)}`),
    join(';')
  )(colorMap);
}
