import { Global } from '@emotion/react';
import { Theme } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { DevTools } from 'jotai-devtools';

import Sidebar from '@/components/sidebar/Sidebar';
import Viewer from '@/components/viewer/Viewer';
import { themeAtom } from '@/store/modules/theme';

import * as styles from './App.styles';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  const [theme] = useAtom(themeAtom);

  return (
    <>
      <Global styles={styles.global} />
      <DevTools theme="dark" />
      <Theme
        css={styles.app}
        appearance={theme.appearance}
        accentColor={theme.accentColor}
        grayColor={theme.grayColor}
        radius="medium"
        scaling="100%"
        panelBackground="translucent"
      >
        <Sidebar />
        <Viewer />
      </Theme>
    </>
  );
};

export default App;
