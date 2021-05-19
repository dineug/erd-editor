import { ProviderElement } from '@@types/context';
import { closestElement } from './helper';

export function getContext<T = any>(selector: string, el: Element): T {
  const provider = closestElement(selector, el) as ProviderElement<T>;
  return provider.value;
}
