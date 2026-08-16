import { Global } from '@emotion/react';
import { Theme } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { Outlet } from 'react-router';

import { themeAtom } from '@/atoms/modules/theme';

import * as styles from './Root.styles';

interface RootProps {}

const Root: React.FC<RootProps> = () => {
  const [theme] = useAtom(themeAtom);

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
      </Theme>
    </>
  );
};

export default Root;
