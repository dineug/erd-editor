import { useEffect } from 'react';

import { useCollaborativeHost } from '@/atoms/modules/collaborative';
import { useSelectedSchemaListEntity } from '@/atoms/modules/schema';
import { useImportFiles } from '@/atoms/modules/schema-import';
import DropOverlay from '@/components/app/drop-overlay/DropOverlay';
import ImportNotice from '@/components/app/import-notice/ImportNotice';
import { useFileDrop } from '@/components/app/useFileDrop';
import { useSchemaSearchParam } from '@/components/app/useSchemaSearchParam';
import Sidebar from '@/components/sidebar/Sidebar';
import SidebarSash from '@/components/sidebar-sash/SidebarSash';
import Viewer from '@/components/viewer/Viewer';

const APP_TITLE = 'erd-editor';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  useCollaborativeHost();
  useSchemaSearchParam();
  const importFiles = useImportFiles();
  const dragging = useFileDrop(importFiles);
  const selectedName = useSelectedSchemaListEntity()?.name;

  useEffect(() => {
    document.title = selectedName
      ? `${selectedName} · ${APP_TITLE}`
      : APP_TITLE;
  }, [selectedName]);

  useEffect(
    () => () => {
      document.title = APP_TITLE;
    },
    []
  );

  return (
    <>
      <Sidebar />
      <Viewer />
      <SidebarSash />
      {dragging ? <DropOverlay /> : null}
      <ImportNotice />
    </>
  );
};

export default App;
