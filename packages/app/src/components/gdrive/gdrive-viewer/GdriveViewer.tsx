import { Button, Flex, Text } from '@radix-ui/themes';
import { FileUp, LoaderCircle, Plus, RotateCw } from 'lucide-react';
import { lazy, Suspense } from 'react';

import GdriveConflictBanner from '@/components/gdrive/gdrive-banner/GdriveConflictBanner';
import GdriveLeaderBanner from '@/components/gdrive/gdrive-banner/GdriveLeaderBanner';
import GdriveReconnectBanner from '@/components/gdrive/gdrive-banner/GdriveReconnectBanner';
import GdriveNotice from '@/components/gdrive/gdrive-screens/GdriveNotice';
import GdriveSaveStatus from '@/components/gdrive/gdrive-status/GdriveSaveStatus';
import type {
  DocumentRejection,
  DocumentSnapshot,
  GdriveSession,
  SessionSnapshot,
} from '@/services/gdrive';

import * as styles from './GdriveViewer.styles';

const LazyGdriveEditor = lazy(
  () => import('@/components/gdrive/gdrive-editor/GdriveEditor')
);

const REJECTIONS: Record<
  DocumentRejection,
  { title: string; description: string }
> = {
  'not-document': {
    title: "This file isn't an erd-editor document",
    description:
      'erd-editor opens diagrams it saved itself. It leaves this file as it is and never saves over it.',
  },
  trashed: {
    title: 'This file is in the trash',
    description: 'Restore it in Google Drive to open it here.',
  },
  'too-large': {
    title: 'This file is too large',
    description: 'erd-editor opens files up to 64 MB.',
  },
  'google-native': {
    title: "This file isn't an erd-editor document",
    description: 'Google Docs, Sheets and folders open in Google Drive.',
  },
};

interface GdriveViewerProps {
  session: GdriveSession;
  snapshot: SessionSnapshot;
  onNewFile: () => void;
  onImport: () => void;
}

interface EmptyViewerProps {
  hasFiles: boolean;
  onNewFile: () => void;
  onImport: () => void;
}

const EmptyViewer: React.FC<EmptyViewerProps> = ({
  hasFiles,
  onNewFile,
  onImport,
}) => (
  <GdriveNotice
    title={hasFiles ? 'No file open' : 'No files yet'}
    description={
      hasFiles
        ? 'Pick a file from the sidebar, or start a new one.'
        : 'Create a file or import one. The files you open with erd-editor from Google Drive show up here too.'
    }
  >
    <Button size="2" color="gray" highContrast onClick={onNewFile}>
      <Plus size={16} />
      New file
    </Button>
    <Button size="2" variant="outline" color="gray" onClick={onImport}>
      <FileUp size={16} />
      Import files
    </Button>
  </GdriveNotice>
);

interface DocumentViewProps {
  session: GdriveSession;
  snapshot: SessionSnapshot;
  document: DocumentSnapshot;
}

const DocumentView: React.FC<DocumentViewProps> = ({
  session,
  snapshot,
  document,
}) => {
  const { controller } = snapshot;
  const loading = <Text size="4">Loading…</Text>;

  switch (document.phase) {
    case 'loading':
    case 'waiting-snapshot':
      return document.role === 'follower' ? (
        <Text size="3" color="gray">
          Waiting for the tab that opened this file…
        </Text>
      ) : (
        loading
      );
    case 'rejected': {
      const { title, description } = REJECTIONS[document.rejection!];
      return <GdriveNotice title={title} description={description} />;
    }
    case 'not-found':
      return (
        <GdriveNotice
          title="This file isn't available"
          description="It may have been deleted, or this Google account can't open it."
        />
      );
    case 'failed':
      return (
        <GdriveNotice
          title="Couldn't open this file"
          description="Google Drive didn't answer. Check the connection and try again."
        >
          <Button
            size="2"
            color="gray"
            highContrast
            onClick={() => session.reopen()}
          >
            <RotateCw size={16} />
            Try again
          </Button>
        </GdriveNotice>
      );
    case 'ready':
      return (
        <Suspense fallback={loading}>
          <LazyGdriveEditor
            key={`${controller!.fileId}/${document.epoch}`}
            controller={controller!}
            readonly={!document.canEdit}
          />
        </Suspense>
      );
  }
};

/** What stopped or needs the person, in the order it matters. */
function Banners({
  session,
  snapshot,
}: {
  session: GdriveSession;
  snapshot: SessionSnapshot;
}) {
  const { token, document } = snapshot;
  const banners: React.ReactNode[] = [];
  const reconnect =
    token.status === 'fallback-expired' ||
    (token.status === 'fallback' && token.renewDue);
  if (reconnect) {
    banners.push(
      <GdriveReconnectBanner
        key="reconnect"
        session={session}
        expired={token.status === 'fallback-expired'}
        error={token.error}
      />
    );
  }
  if (document?.phase === 'waiting-snapshot') {
    banners.push(
      <GdriveLeaderBanner
        key="leader"
        session={session}
        state="waiting-snapshot"
      />
    );
  } else if (document?.phase === 'ready') {
    const state = document.saveState;
    if (state === 'waiting-leader') {
      banners.push(
        <GdriveLeaderBanner key="leader" session={session} state={state} />
      );
    } else if (
      state === 'conflict' ||
      state === 'unconfirmed' ||
      state === 'deleted'
    ) {
      banners.push(
        <GdriveConflictBanner key="conflict" session={session} state={state} />
      );
    }
  }
  return banners.length ? (
    <Flex css={styles.banners} direction="column" align="center" gap="2">
      {banners}
    </Flex>
  ) : null;
}

/** The open file, the empty viewer, or what keeps the file from opening. */
const GdriveViewer: React.FC<GdriveViewerProps> = ({
  session,
  snapshot,
  onNewFile,
  onImport,
}) => {
  const { document } = snapshot;

  return (
    <Flex css={styles.root} direction="column" align="center" justify="center">
      {document ? (
        <DocumentView
          session={session}
          snapshot={snapshot}
          document={document}
        />
      ) : snapshot.filesState === 'loading' ? (
        <Text size="4">Loading…</Text>
      ) : (
        <EmptyViewer
          hasFiles={
            snapshot.files.length > 0 || snapshot.filesState === 'failed'
          }
          onNewFile={onNewFile}
          onImport={onImport}
        />
      )}
      <Banners session={session} snapshot={snapshot} />
      {document?.phase === 'ready' ? (
        <GdriveSaveStatus session={session} state={document.saveState} />
      ) : null}
      {snapshot.busy ? (
        <Flex css={styles.busy} align="center" gap="2" role="status">
          <LoaderCircle size={14} aria-hidden />
          <Text size="1">Saving before you leave…</Text>
        </Flex>
      ) : null}
    </Flex>
  );
};

export default GdriveViewer;
