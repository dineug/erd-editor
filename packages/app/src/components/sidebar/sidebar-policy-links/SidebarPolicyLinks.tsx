import { Flex, Link } from '@radix-ui/themes';

import { useI18n } from '@/atoms/modules/locale';

import * as styles from './SidebarPolicyLinks.styles';

interface SidebarPolicyLinksProps {}

/**
 * Privacy and Terms, static pages that Google's OAuth review expects the home
 * page to link. Plain anchors, since a router link meets the catch-all route and
 * lands on /; a new tab leaves an open document where it is.
 */
const SidebarPolicyLinks: React.FC<SidebarPolicyLinksProps> = () => {
  const { t } = useI18n();

  return (
    <Flex align="center" gap="2">
      <Link
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        size="1"
        color="gray"
      >
        {t('common.privacy')}
      </Link>
      <span css={styles.separator} aria-hidden="true">
        ·
      </span>
      <Link
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        size="1"
        color="gray"
      >
        {t('common.terms')}
      </Link>
    </Flex>
  );
};

export default SidebarPolicyLinks;
