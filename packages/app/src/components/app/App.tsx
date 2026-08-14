import { useCollaborativeHost } from '@/atoms/modules/collaborative';
import Sidebar from '@/components/sidebar/Sidebar';
import SidebarSash from '@/components/sidebar-sash/SidebarSash';
import Viewer from '@/components/viewer/Viewer';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  useCollaborativeHost();

  return (
    <>
      <Sidebar />
      <Viewer />
      <SidebarSash />
    </>
  );
};

export default App;
