import { Button, Link, Spinner } from '@radix-ui/themes';
import { useSetAtom } from 'jotai';
import {
  Download,
  ExternalLink,
  FolderOpen,
  LogOut,
  RotateCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useI18n } from '@/atoms/modules/locale';
import { sidebarSashAtom } from '@/atoms/modules/sidebar-sash';
import { authControl } from '@/components/gdrive/authControl';
import GdriveLeaveDialog from '@/components/gdrive/gdrive-confirm/GdriveLeaveDialog';
import GdriveCreateDialog from '@/components/gdrive/gdrive-create/GdriveCreateDialog';
import GdriveSessionNotice from '@/components/gdrive/gdrive-notice/GdriveSessionNotice';
import GdriveNotice from '@/components/gdrive/gdrive-screens/GdriveNotice';
import GdriveSignIn from '@/components/gdrive/gdrive-screens/GdriveSignIn';
import GdriveSidebar from '@/components/gdrive/gdrive-sidebar/GdriveSidebar';
import GdriveViewer from '@/components/gdrive/gdrive-viewer/GdriveViewer';
import { useGdriveSession } from '@/components/gdrive/useGdriveSession';
import SidebarSash from '@/components/sidebar-sash/SidebarSash';
import {
  checkAvailability,
  configuredClientId,
  type GdriveSession,
  isFramed,
  type SessionSnapshot,
} from '@/services/gdrive';
import { pickFiles } from '@/utils/file';
import { IMPORT_ACCEPT } from '@/utils/importFile';
import { settleReported } from '@/utils/reportError';

const APP_TITLE = 'ERD Editor';

interface ScreenProps {
  session: GdriveSession;
  snapshot: SessionSnapshot;
}

/**
 * Everything but the workspace: checking, offline and the account screens. A
 * file an account screen replaced keeps its unsaved edits here, to download.
 */
const AccountScreen: React.FC<ScreenProps> = ({ session, snapshot }) => {
  const { token } = snapshot;
  const { t } = useI18n();
  const signedInAs = token.account?.email ?? t('gdrive.anotherAccount');
  const download = snapshot.keptChanges ? (
    <Button
      size="2"
      variant="outline"
      color="gray"
      onClick={() => session.downloadChanges()}
    >
      <Download size={16} />
      {t('common.downloadMyChanges')}
    </Button>
  ) : null;

  switch (snapshot.screen) {
    case 'offline':
      return (
        <GdriveNotice
          title={t('gdrive.offline.title')}
          description={t('gdrive.offline.description')}
        >
          {download}
        </GdriveNotice>
      );
    case 'sign-in':
      return (
        <GdriveSignIn session={session} token={token}>
          {download}
        </GdriveSignIn>
      );
    case 'scope-missing':
      return (
        <GdriveNotice
          title={t('gdrive.scopeMissing.title')}
          description={t('gdrive.scopeMissing.description')}
        >
          <Button
            size="2"
            color="gray"
            highContrast
            onClick={() => session.signIn()}
            {...authControl}
          >
            <RotateCw size={16} />
            {t('common.tryAgain')}
          </Button>
          {download}
        </GdriveNotice>
      );
    case 'account-mismatch': {
      const description = t('gdrive.mismatch.description', {
        email: signedInAs,
      });
      return (
        <GdriveNotice
          title={t('gdrive.mismatch.title')}
          description={
            snapshot.hintRefused
              ? `${description} ${t('gdrive.mismatch.choose')}`
              : description
          }
        >
          <Button
            size="2"
            color="gray"
            highContrast
            onClick={() => session.switchAccount()}
            {...authControl}
          >
            {t('gdrive.mismatch.switchAccount')}
          </Button>
          <Button
            size="2"
            variant="outline"
            color="gray"
            onClick={() => session.dismissState()}
          >
            <FolderOpen size={16} />
            {t('gdrive.mismatch.showMyFiles')}
          </Button>
          <Button
            size="2"
            variant="outline"
            color="gray"
            onClick={() => void settleReported(session.signOut)()}
            {...authControl}
          >
            <LogOut size={16} />
            {t('common.signOut')}
          </Button>
          {download}
        </GdriveNotice>
      );
    }
    case 'account-changed':
      return (
        <GdriveNotice
          title={t('gdrive.accountChanged.title')}
          description={t('gdrive.accountChanged.description')}
        >
          <Button
            size="2"
            color="gray"
            highContrast
            onClick={() => location.reload()}
          >
            <RotateCw size={16} />
            {t('common.reload')}
          </Button>
          {download}
        </GdriveNotice>
      );
    case 'unsaved-changes': {
      const { name, email } = snapshot.stranded!;
      return (
        <GdriveNotice
          title={t('gdrive.unsaved.title')}
          description={
            name === null
              ? t('gdrive.unsaved.descriptionUnnamed', {
                  email,
                  account: signedInAs,
                })
              : t('gdrive.unsaved.description', {
                  name,
                  email,
                  account: signedInAs,
                })
          }
        >
          <Button
            size="2"
            color="gray"
            highContrast
            onClick={() => session.downloadChanges()}
          >
            <Download size={16} />
            {t('common.downloadMyChanges')}
          </Button>
          <Button
            size="2"
            variant="outline"
            color="red"
            onClick={() => session.discardChanges()}
          >
            {t('gdrive.unsaved.continueWithout')}
          </Button>
        </GdriveNotice>
      );
    }
    default:
      return (
        <GdriveNotice title={t('gdrive.checkingSignIn')}>
          <Spinner size="3" />
        </GdriveNotice>
      );
  }
};

/** The signed-in account's files: the sidebar, the open file and its dialogs. */
const Workspace: React.FC<ScreenProps> = ({ session, snapshot }) => {
  const [adding, setAdding] = useState(false);
  const setSidebarSash = useSetAtom(sidebarSashAtom);

  // The sash is shared with /, so the sidebar may be folded away.
  const startAdding = () => {
    setSidebarSash(draft => {
      draft.open = true;
    });
    setAdding(true);
  };

  const handleImport = async () => {
    const files = await pickFiles(IMPORT_ACCEPT);
    await session.importFiles(files);
  };
  const importFiles = () => void settleReported(handleImport)();

  return (
    <>
      <GdriveSidebar
        session={session}
        snapshot={snapshot}
        adding={adding}
        onAddingChange={setAdding}
        onImport={importFiles}
      />
      <GdriveViewer
        session={session}
        snapshot={snapshot}
        onNewFile={startAdding}
        onImport={importFiles}
      />
      <SidebarSash />
      {snapshot.create ? (
        <GdriveCreateDialog
          key={snapshot.create.key}
          session={session}
          request={snapshot.create}
        />
      ) : null}
    </>
  );
};

/** /gdrive once it can run here: the session, the title and the unload guard. */
const GdriveApp: React.FC<{ clientId: string }> = ({ clientId }) => {
  const { session, snapshot } = useGdriveSession(clientId);
  const { t } = useI18n();
  const workspace = snapshot?.screen === 'workspace';
  const name = workspace ? snapshot.document?.name : null;

  useEffect(() => {
    document.title = name ? `${name} · ${APP_TITLE}` : APP_TITLE;
  }, [name]);

  useEffect(
    () => () => {
      document.title = APP_TITLE;
    },
    []
  );

  useEffect(() => {
    if (!session) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!session.hasUnsavedChanges()) return;
      event.preventDefault();
      // Chrome before 119 shows the dialog only for a returnValue.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

  if (!session || !snapshot) {
    return <GdriveNotice title={t('gdrive.checkingSignIn')} />;
  }

  return (
    <>
      {workspace ? (
        <Workspace session={session} snapshot={snapshot} />
      ) : (
        <AccountScreen session={session} snapshot={snapshot} />
      )}
      {/* A sign-out whose save failed may start on an account screen too. */}
      {snapshot.leave ? (
        <GdriveLeaveDialog session={session} request={snapshot.leave} />
      ) : null}
      <GdriveSessionNotice session={session} notice={snapshot.notice} />
    </>
  );
};

/**
 * The /gdrive route: Google Drive files in the editor, apart from the local
 * list at /, which it never links to. A frame gets a link to a tab of its own
 * instead, since a click there could sign out or reload over the person's edits.
 */
const GdriveRoute: React.FC = () => {
  const [framed] = useState(() => isFramed(window));
  const clientId = configuredClientId();
  const availability = checkAvailability(clientId, window.location.origin);
  const { t } = useI18n();

  if (framed) {
    return (
      <GdriveNotice
        title={t('gdrive.framed.title')}
        description={t('gdrive.framed.description')}
      >
        <Link
          href={window.location.href}
          target="_blank"
          rel="noopener"
          size="2"
        >
          {t('gdrive.framed.link')} <ExternalLink size={14} />
        </Link>
      </GdriveNotice>
    );
  }
  if (availability === 'not-configured') {
    return (
      <GdriveNotice
        title={t('gdrive.notConfigured.title')}
        description={t('gdrive.notConfigured.description')}
      />
    );
  }
  if (availability === 'unsupported-origin') {
    return (
      <GdriveNotice
        title={t('gdrive.unsupportedOrigin.title')}
        description={t('gdrive.unsupportedOrigin.description')}
      />
    );
  }
  return <GdriveApp clientId={clientId!} />;
};

export default GdriveRoute;
