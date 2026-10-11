import { Button, Flex, Text } from '@radix-ui/themes';
import { FileUp, LoaderCircle, Plus, RotateCw } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { useI18n } from '@/atoms/modules/locale';
import GdriveConflictBanner from '@/components/gdrive/gdrive-banner/GdriveConflictBanner';
import GdriveLeaderBanner from '@/components/gdrive/gdrive-banner/GdriveLeaderBanner';
import GdriveReconnectBanner from '@/components/gdrive/gdrive-banner/GdriveReconnectBanner';
import GdriveNotice from '@/components/gdrive/gdrive-screens/GdriveNotice';
import GdriveSaveStatus from '@/components/gdrive/gdrive-status/GdriveSaveStatus';
import { spinning } from '@/components/gdrive/gdrive-status/GdriveSaveStatus.styles';
import ResourceLinks from '@/components/resource-links/ResourceLinks';
import type { PlainMessageKey } from '@/i18n/translate';
import type {
  DocumentRejection,
  DocumentSnapshot,
  GdriveSession,
  SessionSnapshot,
} from '@/services/gdrive';
import { MAX_IMPORT_FILE_MB } from '@/utils/importFile';

import * as styles from './GdriveViewer.styles';

const LazyGdriveEditor = lazy(
  () => import('@/components/gdrive/gdrive-editor/GdriveEditor')
);

const REJECTIONS: Record<
  Exclude<DocumentRejection, 'too-large'>,
  { titleKey: PlainMessageKey; descriptionKey: PlainMessageKey }
> = {
  'not-document': {
    titleKey: 'gdrive.viewer.notDocument',
    descriptionKey: 'gdrive.viewer.notDocumentHint',
  },
  trashed: {
    titleKey: 'gdrive.viewer.trashed',
    descriptionKey: 'gdrive.viewer.trashedHint',
  },
  'google-native': {
    titleKey: 'gdrive.viewer.notDocument',
    descriptionKey: 'gdrive.viewer.googleNativeHint',
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
  importing: boolean;
  onNewFile: () => void;
  onImport: () => void;
}

const EmptyViewer: React.FC<EmptyViewerProps> = ({
  hasFiles,
  importing,
  onNewFile,
  onImport,
}) => {
  const { t } = useI18n();

  return (
    <GdriveNotice
      title={t(
        hasFiles ? 'gdrive.viewer.noFileOpen' : 'gdrive.viewer.noFilesYet'
      )}
      description={t(
        hasFiles
          ? 'gdrive.viewer.noFileOpenHint'
          : 'gdrive.viewer.noFilesYetHint'
      )}
      footer={<ResourceLinks />}
    >
      <Button size="2" color="gray" highContrast onClick={onNewFile}>
        <Plus size={16} />
        {t('gdrive.sidebar.newFile')}
      </Button>
      <Button
        size="2"
        variant="outline"
        color="gray"
        loading={importing}
        onClick={onImport}
      >
        <FileUp size={16} />
        {t('common.importFiles')}
      </Button>
    </GdriveNotice>
  );
};

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
  const { t } = useI18n();
  const loading = <Text size="4">{t('common.loading')}</Text>;

  switch (document.phase) {
    case 'loading':
    case 'waiting-snapshot':
      return document.role === 'follower' ? (
        <Text size="3" color="gray">
          {t('gdrive.viewer.waitingForOpener')}
        </Text>
      ) : (
        loading
      );
    case 'rejected': {
      const rejection = document.rejection!;
      if (rejection === 'too-large') {
        return (
          <GdriveNotice
            title={t('gdrive.viewer.tooLarge')}
            description={t('gdrive.viewer.tooLargeHint', {
              size: MAX_IMPORT_FILE_MB,
            })}
          />
        );
      }
      const { titleKey, descriptionKey } = REJECTIONS[rejection];
      return (
        <GdriveNotice title={t(titleKey)} description={t(descriptionKey)} />
      );
    }
    case 'not-found':
      return (
        <GdriveNotice
          title={t('gdrive.viewer.notFound')}
          description={t('gdrive.viewer.notFoundHint')}
        />
      );
    case 'waiting-token':
      return (
        <GdriveNotice
          title={t('gdrive.viewer.waitingToken')}
          description={t('gdrive.viewer.waitingTokenHint')}
        />
      );
    case 'failed':
      return (
        <GdriveNotice
          title={t('gdrive.viewer.failed')}
          description={t('gdrive.viewer.failedHint')}
        >
          <Button
            size="2"
            color="gray"
            highContrast
            onClick={() => session.reopen()}
          >
            <RotateCw size={16} />
            {t('common.tryAgain')}
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

/** Whether the viewer under the banners shows a primary action: New file, or Try again. */
function viewerHasPrimary({ document, filesState }: SessionSnapshot): boolean {
  return document ? document.phase === 'failed' : filesState !== 'loading';
}

/**
 * What stopped or needs the person, in the order it matters. Each banner's
 * action is the primary one, except Reconnect Google beside another.
 */
function Banners({
  session,
  snapshot,
}: {
  session: GdriveSession;
  snapshot: SessionSnapshot;
}) {
  const { token, document } = snapshot;
  const banners: React.ReactNode[] = [];
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
      state === 'deleted' ||
      (state === 'readonly' && document.accessLost)
    ) {
      banners.push(
        <GdriveConflictBanner key="conflict" session={session} state={state} />
      );
    }
  }
  const reconnect =
    token.status === 'fallback-expired' ||
    (token.status === 'fallback' && token.renewDue);
  if (reconnect) {
    banners.unshift(
      <GdriveReconnectBanner
        key="reconnect"
        session={session}
        expired={token.status === 'fallback-expired'}
        error={token.error}
        primary={banners.length === 0 && !viewerHasPrimary(snapshot)}
      />
    );
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
  const { t } = useI18n();

  return (
    <Flex css={styles.root} direction="column" align="center" justify="center">
      {document ? (
        <DocumentView
          session={session}
          snapshot={snapshot}
          document={document}
        />
      ) : snapshot.filesState === 'loading' ? (
        <Text size="4">{t('common.loading')}</Text>
      ) : (
        <EmptyViewer
          hasFiles={
            snapshot.files.length > 0 || snapshot.filesState === 'failed'
          }
          importing={snapshot.importing}
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
          <LoaderCircle css={spinning} size={14} aria-hidden />
          <Text size="1">{t('gdrive.viewer.savingBeforeLeave')}</Text>
        </Flex>
      ) : null}
    </Flex>
  );
};

export default GdriveViewer;
