import Sidebar from '@/components/sidebar/Sidebar';
import Viewer from '@/components/viewer/Viewer';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  return (
    <>
      <Sidebar />
      <Viewer />
    </>
  );
};

export default App;
