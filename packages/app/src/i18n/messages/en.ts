/**
 * The app's own text in English, the source every other dictionary follows.
 * Each key is prefixed with the part of the app it belongs to; common holds
 * the words several parts share.
 */
export const en = {
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.dismiss': 'Dismiss',
  'common.tryAgain': 'Try again',
  'common.reload': 'Reload',
  'common.loading': 'Loading…',
  'common.search': 'Search',
  'common.rename': 'Rename',
  'common.importFiles': 'Import files',
  'common.signOut': 'Sign out',
  'common.downloadMyChanges': 'Download my changes',
  'common.edited': 'Edited {time}',
  'common.system': 'System',
  'common.displayLanguage': 'Display Language',
  'common.theme': 'Theme',
  'common.light': 'Light',
  'common.dark': 'Dark',
  'common.host': 'Host',
  'common.guest': 'Guest',
  'common.you': '(you)',
  'common.participants': 'Participants',
  'common.yourNickname': 'Your nickname',
  'common.privacy': 'Privacy',
  'common.terms': 'Terms',
  'common.editingGuide': 'Editing Guide',
  'common.openSidebar': 'Open sidebar',
  'common.closeSidebar': 'Close sidebar',

  'time.justNow': 'just now',
  'time.today': 'Today',
  'time.yesterday': 'Yesterday',
  'time.previous7Days': 'Previous 7 Days',
  'time.previous30Days': 'Previous 30 Days',

  'sidebar.schemas': 'Schemas',
  'sidebar.newSchema': 'New schema',
  'sidebar.importAndExport': 'Import and export',
  'sidebar.exportBackup': 'Export backup',
  'sidebar.searchSchemas': 'Search schemas',
  'sidebar.newSchemaName': 'New schema name',
  'sidebar.schemaName': 'Schema name',
  'sidebar.schemaNamePlaceholder': 'schema name',
  'sidebar.duplicate': 'Duplicate',
  'sidebar.moveToTrash': 'Move to trash',
  'sidebar.actionsFor': 'Actions for {name}',
  'sidebar.noResults': 'No results',

  'trash.button': 'Trash ({count})',
  'trash.title': 'Trash',
  'trash.description': {
    one: 'Schemas in the trash are deleted permanently after {count} day.',
    other: 'Schemas in the trash are deleted permanently after {count} days.',
  },
  'trash.listLabel': 'Trashed schemas',
  'trash.deleted': 'Deleted {time}',
  'trash.deletesToday': 'deletes today',
  'trash.deletesTomorrow': 'deletes tomorrow',
  'trash.deletesIn': {
    one: 'deletes in {count} day',
    other: 'deletes in {count} days',
  },
  'trash.restore': 'Restore',
  'trash.deletePermanently': 'Delete permanently',
  'trash.cannotBeUndone': 'This cannot be undone.',
  'trash.delete': 'Delete',
  'trash.empty': 'The trash is empty.',
  'trash.emptyTrash': 'Empty trash',
  'trash.emptyConfirm': {
    one: 'Permanently delete {count} schema? This cannot be undone.',
    other: 'Permanently delete {count} schemas? This cannot be undone.',
  },

  'collaboration.for': 'Collaboration for {name}',
  'collaboration.guestsConnected': {
    one: '{count} guest connected',
    other: '{count} guests connected',
  },
  'collaboration.title': 'Collaborative editing',
  'collaboration.experiment': 'Experiment',
  'collaboration.description':
    'Peers connect directly over WebRTC and exchange messages using end-to-end encryption.',
  'collaboration.nickname': 'Nickname',
  'collaboration.link': 'Link',
  'collaboration.noOneJoined': 'No one else has joined yet.',
  'collaboration.startSession': 'Start session',
  'collaboration.stopSession': 'Stop session',

  'viewer.noSchemaOpen': 'No schema open',
  'viewer.emptyHint':
    'Pick one from the sidebar, or start one here. You can also drop files anywhere to import them.',
  'viewer.openSample': 'Open sample',
  'viewer.sampleName': 'bookstore sample',

  'drop.title': 'Drop to import',
  'drop.formats':
    'Backups, .erd, .vuerd and .json documents, SQL, DBML, AML and GraphQL',
  'drop.importing': 'Importing files…',
  'drop.importingHint': 'Drop more once this import finishes',

  'import.imported': {
    one: 'Imported {count} schema',
    other: 'Imported {count} schemas',
  },
  'import.skippedInvalidFiles': {
    one: 'Skipped {count} invalid file',
    other: 'Skipped {count} invalid files',
  },
  'import.skippedInvalidSchemas': {
    one: 'Skipped {count} invalid schema',
    other: 'Skipped {count} invalid schemas',
  },
  'import.skippedOversized': {
    one: 'Skipped {count} file over {size} MB',
    other: 'Skipped {count} files over {size} MB',
  },
  'import.nothing': 'Nothing to import',
  'import.failed': 'Import failed',
  'import.exportFailed': 'Export failed',

  'update.available': 'A new version of ERD Editor is available.',
  'update.updatedElsewhere':
    'The app was updated in another tab — reload to finish.',

  'live.invalidToken': 'Invalid shared token.',
  'live.hostNotFound': 'Host not found.',
  'live.refresh': 'Refresh',
  'live.hostStopped': 'Host stopped the session.',
  'live.somethingWentWrong': 'Something went wrong.',
  'live.lookingForHost': 'Looking for a host...',
  'live.waitingForHost': 'Waiting for a host...',
  'live.session': 'Live session',
  'live.inSession': {
    one: '{count} in session',
    other: '{count} in session',
  },
  'live.showParticipants': 'Show participants',
  'live.hideParticipants': 'Hide participants',

  'gdrive.checkingSignIn': 'Checking your Google sign-in…',
  'gdrive.anotherAccount': 'another account',
  'gdrive.offline.title': "You're offline",
  'gdrive.offline.description':
    "ERD Editor checks your Google sign-in once you're back online.",
  'gdrive.scopeMissing.title': 'Google Drive access was not granted',
  'gdrive.scopeMissing.description':
    'ERD Editor needs access to the files you create or open with it. Sign in again and allow Google Drive access.',
  'gdrive.mismatch.title': 'Google Drive sent this for another account',
  'gdrive.mismatch.description':
    "You're signed in as {email}. Switch to the account Google Drive used to open it, or go on with this account's files.",
  'gdrive.mismatch.choose':
    "ERD Editor couldn't preselect that account, so choose it when Google asks.",
  'gdrive.mismatch.switchAccount': 'Switch account',
  'gdrive.mismatch.showMyFiles': 'Show my files',
  'gdrive.accountChanged.title': 'Signed in with another account',
  'gdrive.accountChanged.description':
    'Another tab signed in to a different Google account, so this tab stopped. Reload it to continue with that account.',
  'gdrive.unsaved.title': "Your changes weren't saved",
  'gdrive.unsaved.description':
    "{name} has changes from {email} that aren't in Google Drive, and {account} is signed in now. Download them before you go on.",
  'gdrive.unsaved.descriptionUnnamed':
    "The file you had open has changes from {email} that aren't in Google Drive, and {account} is signed in now. Download them before you go on.",
  'gdrive.unsaved.continueWithout': 'Continue without them',
  'gdrive.framed.title': "Open ERD Editor's Google Drive editor in its own tab",
  'gdrive.framed.description': "It doesn't run inside another page.",
  'gdrive.framed.link': 'Open in a new tab',
  'gdrive.notConfigured.title': 'Google Drive integration is not configured',
  'gdrive.notConfigured.description':
    'This build of ERD Editor has no Google sign-in client.',
  'gdrive.unsupportedOrigin.title': "Google Drive isn't available here",
  'gdrive.unsupportedOrigin.description':
    'Google sign-in works on erd-editor.io only, and this is a preview.',

  'gdrive.signIn.title': 'Open your ERD files in Google Drive',
  'gdrive.signIn.description':
    'ERD Editor opens and saves only the files you create or open with it.',
  'gdrive.signIn.fallbackDescription':
    "ERD Editor's sign-in server is busy, so Google signs you in for an hour at a time.",
  'gdrive.signIn.signIn': 'Sign in with Google',
  'gdrive.signIn.continue': 'Continue with Google',
  'gdrive.signIn.waitingTitle': 'Waiting for Google sign-in…',
  'gdrive.signIn.waitingDescription':
    'Finish signing in in the window Google opened.',
  'gdrive.signIn.popupBlocked':
    'Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.',
  'gdrive.signIn.failed': "Google sign-in didn't finish. Try again.",
  'gdrive.signIn.gisBlocked':
    "Google sign-in couldn't load. Check that nothing blocks accounts.google.com, then reload the page.",

  'gdrive.sidebar.label': 'Drive files',
  'gdrive.sidebar.newFile': 'New file',
  'gdrive.sidebar.import': 'Import',
  'gdrive.sidebar.searchFiles': 'Search files',
  'gdrive.sidebar.newFileName': 'New file name',
  'gdrive.sidebar.fileName': 'File name',
  'gdrive.sidebar.fileNamePlaceholder': 'file name',
  'gdrive.sidebar.loadingFiles': 'Loading files…',
  'gdrive.sidebar.loadFailed': "Couldn't load your files.",

  'gdrive.viewer.noFileOpen': 'No file open',
  'gdrive.viewer.noFileOpenHint':
    'Pick a file from the sidebar, or start a new one.',
  'gdrive.viewer.noFilesYet': 'No files yet',
  'gdrive.viewer.noFilesYetHint':
    'Create a file or import one. The files you open with ERD Editor from Google Drive show up here too.',
  'gdrive.viewer.waitingForOpener':
    'Waiting for the tab that opened this file…',
  'gdrive.viewer.notDocument': "This file isn't an ERD Editor document",
  'gdrive.viewer.notDocumentHint':
    'ERD Editor opens diagrams it saved itself. It leaves this file as it is and never saves over it.',
  'gdrive.viewer.googleNativeHint':
    'Google Docs, Sheets and folders open in Google Drive.',
  'gdrive.viewer.trashed': 'This file is in the trash',
  'gdrive.viewer.trashedHint': 'Restore it in Google Drive to open it here.',
  'gdrive.viewer.tooLarge': 'This file is too large',
  'gdrive.viewer.tooLargeHint': 'ERD Editor opens files up to {size} MB.',
  'gdrive.viewer.notFound': "This file isn't available",
  'gdrive.viewer.notFoundHint':
    "It may have been deleted, or this Google account can't open it.",
  'gdrive.viewer.waitingToken': 'Waiting for Google',
  'gdrive.viewer.waitingTokenHint':
    'This file opens once your Google session is back.',
  'gdrive.viewer.failed': "Couldn't open this file",
  'gdrive.viewer.failedHint':
    "Google Drive didn't answer. Check the connection and try again.",
  'gdrive.viewer.savingBeforeLeave': 'Saving before you leave…',

  'gdrive.status.saved': 'Saved to Google Drive',
  'gdrive.status.saving': 'Saving…',
  'gdrive.status.failed': "Couldn't save",
  'gdrive.status.conflict': 'Changed in Google Drive',
  'gdrive.status.unconfirmed': "Couldn't confirm the last save",
  'gdrive.status.paused': 'Paused until Google reconnects',
  'gdrive.status.deleted': 'Deleted in Google Drive',
  'gdrive.status.readonly': 'View only',
  'gdrive.status.waitingLeader': 'Waiting for the tab that saves this file',
  'gdrive.status.waitingSnapshot': 'Waiting for the tab that opened this file',
  'gdrive.status.scopeMissing': 'No Google Drive access',

  'gdrive.banner.conflict':
    'This file changed in Google Drive, so saving stopped. Your changes are still here.',
  'gdrive.banner.unconfirmed':
    "Couldn't confirm the last save, so saving stopped. Your changes are still here.",
  'gdrive.banner.deleted':
    'This file was deleted or moved to the trash in Google Drive, so saving stopped.',
  'gdrive.banner.readonly':
    "You can't edit this file in Google Drive anymore, so saving stopped. Your changes are still here.",
  'gdrive.banner.checkDrive': 'Check Drive',
  'gdrive.banner.reloadFromDrive': 'Reload from Drive',
  'gdrive.banner.leaderNotResponding':
    "The tab that saves this file isn't responding.",
  'gdrive.banner.openerNotResponding':
    "The tab that opened this file isn't responding.",
  'gdrive.banner.takeOver': 'Take over saving',
  'gdrive.banner.openAndTakeOver': 'Open from Drive and take over',
  'gdrive.banner.popupBlocked':
    'Your browser blocked the Google window. Allow pop-ups for this site, then reconnect.',
  'gdrive.banner.reconnectFailed': "Google didn't reconnect. Try again.",
  'gdrive.banner.sessionEnded':
    'Your Google session ended, so saving is paused.',
  'gdrive.banner.sessionEndsSoon': 'Your Google session ends soon.',
  'gdrive.banner.reconnect': 'Reconnect Google',

  'gdrive.leave.title': "Your latest changes aren't saved",
  'gdrive.leave.description':
    "ERD Editor couldn't save them to Google Drive. Download them to keep a copy, or leave and lose them.",
  'gdrive.leave.descriptionSignOut':
    "ERD Editor couldn't save them to Google Drive. Download them to keep a copy, or sign out and lose them.",
  'gdrive.leave.stay': 'Stay',
  'gdrive.leave.leaveAnyway': 'Leave anyway',
  'gdrive.leave.signOutAnyway': 'Sign out anyway',

  'gdrive.create.title': 'New file in Google Drive',
  'gdrive.create.inAppFolder': 'In the ERD Editor folder',
  'gdrive.create.inFolderPending': 'In a folder…',
  'gdrive.create.inHiddenFolder': "In a folder ERD Editor can't see",
  'gdrive.create.inFolder': 'In the folder “{name}”',
  'gdrive.create.untitled': 'Untitled',
  'gdrive.create.savedAs': 'Saved as {name}',
  'gdrive.create.folderRefused':
    "ERD Editor can't create files in this folder. Create it in the ERD Editor folder instead?",
  'gdrive.create.failed': "Couldn't create the file. Try again.",
  'gdrive.create.createInAppFolder': 'Create in the ERD Editor folder',
  'gdrive.create.create': 'Create',

  'gdrive.import.imported': {
    one: 'Imported {count} file to Google Drive',
    other: 'Imported {count} files to Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: 'Skipped {count} backup: backups stay in the local app',
    other: 'Skipped {count} backups: backups stay in the local app',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} upload failed',
    other: '{count} uploads failed',
  },

  'gdrive.notice.unreadableState':
    "Google Drive sent a link ERD Editor couldn't read",
  'gdrive.notice.renameFailed': "Couldn't rename the file",
  'gdrive.notice.createFailed': "Couldn't create the file",
  'gdrive.notice.checkFailed': "Couldn't reach Google Drive. Try again.",
  'gdrive.notice.reloadFailed': "Couldn't reload from Google Drive. Try again.",
  'gdrive.notice.reloadTrashed':
    "Couldn't reload: the file is in the trash in Google Drive",
  'gdrive.notice.reloadTooLarge':
    "Couldn't reload: the file in Google Drive is over {size} MB",
  'gdrive.notice.reloadNotDocument':
    "Couldn't reload: the file in Google Drive isn't an ERD Editor document anymore",
  'gdrive.notice.signOutUnconfirmed':
    "Signed out here. ERD Editor's server didn't confirm it, so this browser finishes signing out the next time it connects",
  'gdrive.notice.signOutNotRevoked':
    "Signed out here, but Google didn't confirm it removed ERD Editor's access, so your other devices may stay signed in until you remove it at myaccount.google.com/permissions",
} as const;
