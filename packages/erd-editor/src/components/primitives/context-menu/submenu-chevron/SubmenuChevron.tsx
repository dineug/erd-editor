import { FC } from '@dineug/r-html';

import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';

/** The mark of a row that opens a submenu, pointing the way it opens: right, or left for a right-to-left reader. */
const SubmenuChevron: FC = (props, ctx) => {
  const i18n = useI18n(ctx);

  return () => (
    <Icon
      name="chevron-right"
      size={14}
      rotate={i18n.value.dir === 'rtl' ? 180 : 0}
    />
  );
};

export default SubmenuChevron;
