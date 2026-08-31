import { isNull, isPrimitive, isUndefined } from '@/helpers/is-type';
import { isCSSTemplateLiterals } from '@/template/helper';

export function safeToString(value: any) {
  return (isPrimitive(value) && !isNull(value) && !isUndefined(value)) ||
    isCSSTemplateLiterals(value)
    ? String(value)
    : '';
}
