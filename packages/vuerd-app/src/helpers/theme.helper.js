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

export function themeToString(theme) {
  const colorMap = pipe(
    keys,
    map(p =>
      pipe(
        keys,
        map(k => [p, k])
      )(prop(p)(theme))
    ),
    filter(prop('length')),
    reduce(
      (acc, group) =>
        pipe(
          map(keys => assoc(kebabCase(keys.join('.')), path(keys)(theme), acc)),
          mergeAll
        )(group),
      {}
    )
  )(theme);

  return pipe(
    keys,
    map(p => `--${p}:${colorMap[p]}`),
    join(';')
  )(colorMap);
}
