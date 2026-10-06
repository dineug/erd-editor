import { DOMTemplateLiterals, FC } from '@dineug/r-html';

import { useI18n } from '@/components/localeContext';
import type { MessageArgs, MessageKey } from '@/i18n/translate';

type MessageValues = Readonly<Record<string, string | number>>;

export type LocalizedProps = {
  messageKey: MessageKey;
  params?: MessageValues;
};

/** A key read in the language of the element it renders in, which a switch re-renders. */
const Localized: FC<LocalizedProps> = (props, ctx) => {
  const i18n = useI18n(ctx);

  return () => {
    // The key is checked against its parameters where localized() builds the
    // template, so the render reads it through the untyped signature.
    const t = i18n.value.t as (key: string, params?: MessageValues) => string;
    return <>{t(props.messageKey, props.params)}</>;
  };
};

export default Localized;

/**
 * A message as a template, for code outside a component that hands one on, a
 * toast's text say: it is read where it renders, so it follows a switch too.
 *
 * @example
 * openToastAction({ message: <Toast description={localized('common.toast.copied')} /> });
 */
export function localized<K extends MessageKey>(
  key: K,
  ...args: MessageArgs<K>
): DOMTemplateLiterals {
  return <Localized messageKey={key} params={args[0]} />;
}
