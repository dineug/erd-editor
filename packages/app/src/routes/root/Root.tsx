import { Global } from '@emotion/react';
import { Theme } from '@radix-ui/themes';
import { useLayoutEffect } from 'react';
import { Outlet } from 'react-router';

import { useResolvedTheme } from '@/atoms/modules/theme';
import AppUpdatePrompt from '@/components/app-update-prompt/AppUpdatePrompt';
import { applyDocumentAppearance } from '@/utils/theme';

import * as styles from './Root.styles';

interface RootProps {}

const Root: React.FC<RootProps> = () => {
  const theme = useResolvedTheme();

  useLayoutEffect(() => {
    applyDocumentAppearance(document.documentElement, theme.appearance);
  }, [theme.appearance]);

  return (
    <>
      <Global styles={styles.global} />
      <Theme
        css={styles.app}
        appearance={theme.appearance}
        accentColor={theme.accentColor}
        grayColor={theme.grayColor}
        radius="medium"
        scaling="100%"
        panelBackground="translucent"
      >
        <Outlet />
        <AppUpdatePrompt />
      </Theme>
    </>
  );
};

export default Root;
