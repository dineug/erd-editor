import { DOMTemplateLiterals, FC } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';

import * as styles from './Select.styles';

/** The chevron's box; its ink is 5/24 inside it on each side, as lucide draws it. */
export const SELECT_CHEVRON_SIZE = 14;

export type SelectProps = {
  /** The box's width and place, which the list fills. */
  class?: any;
  /** A setting nothing reads now, its value and chevron dimmed, still to be changed. */
  dimmed?: boolean;
  /** The native select, its options, name and change its own. */
  children: DOMTemplateLiterals;
};

/**
 * A native list drawn in the editor's look: the select a caller writes, with
 * the editor's chevron at its end, on the left for a right-to-left reader.
 */
const Select: FC<SelectProps> = props => () => (
  <div class={[styles.root, props.class]} bool:data-dimmed={props.dimmed}>
    {props.children}
    <span class={styles.chevron} aria-hidden="true">
      <Icon name="chevron-down" size={SELECT_CHEVRON_SIZE} />
    </span>
  </div>
);

export default Select;
