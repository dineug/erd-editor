import type { Messages } from '@/i18n/translate';

/** The app's own text in French, key for key as English writes it. */
export const frFR = {
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',
  'common.dismiss': 'Fermer',
  'common.tryAgain': 'Réessayer',
  'common.reload': 'Recharger',
  'common.loading': 'Chargement…',
  'common.search': 'Rechercher',
  'common.rename': 'Renommer',
  'common.importFiles': 'Importer des fichiers',
  'common.signOut': 'Se déconnecter',
  'common.downloadMyChanges': 'Télécharger mes modifications',
  'common.edited': 'Modifié {time}',
  'common.system': 'Système',
  'common.displayLanguage': 'Langue d’affichage',
  'common.theme': 'Thème',
  'common.light': 'Clair',
  'common.dark': 'Sombre',
  'common.host': 'Hôte',
  'common.guest': 'Invité',
  'common.you': '(vous)',
  'common.participants': 'Participants',
  'common.yourNickname': 'Votre pseudo',
  'common.privacy': 'Confidentialité',
  'common.terms': 'Conditions',
  'common.editingGuide': 'Guide d’édition',
  'common.openSidebar': 'Ouvrir la barre latérale',
  'common.closeSidebar': 'Fermer la barre latérale',

  'time.justNow': 'à l’instant',
  'time.today': 'Aujourd’hui',
  'time.yesterday': 'Hier',
  'time.previous7Days': '7 derniers jours',
  'time.previous30Days': '30 derniers jours',

  'sidebar.schemas': 'Schémas',
  'sidebar.newSchema': 'Nouveau schéma',
  'sidebar.importAndExport': 'Importer et exporter',
  'sidebar.exportBackup': 'Exporter une sauvegarde',
  'sidebar.searchSchemas': 'Rechercher des schémas',
  'sidebar.newSchemaName': 'Nom du nouveau schéma',
  'sidebar.schemaName': 'Nom du schéma',
  'sidebar.schemaNamePlaceholder': 'nom du schéma',
  'sidebar.duplicate': 'Dupliquer',
  'sidebar.moveToTrash': 'Mettre à la corbeille',
  'sidebar.actionsFor': 'Actions pour {name}',
  'sidebar.noResults': 'Aucun résultat',

  'trash.button': 'Corbeille ({count})',
  'trash.title': 'Corbeille',
  'trash.description': {
    one: 'Les schémas de la corbeille sont supprimés définitivement après {count} jour.',
    many: 'Les schémas de la corbeille sont supprimés définitivement après {count} de jours.',
    other:
      'Les schémas de la corbeille sont supprimés définitivement après {count} jours.',
  },
  'trash.listLabel': 'Schémas dans la corbeille',
  'trash.deleted': 'Supprimé {time}',
  'trash.deletesToday': 'sera supprimé aujourd’hui',
  'trash.deletesTomorrow': 'sera supprimé demain',
  'trash.deletesIn': {
    one: 'sera supprimé dans {count} jour',
    many: 'sera supprimé dans {count} de jours',
    other: 'sera supprimé dans {count} jours',
  },
  'trash.restore': 'Restaurer',
  'trash.deletePermanently': 'Supprimer définitivement',
  'trash.cannotBeUndone': 'Cette action est irréversible.',
  'trash.delete': 'Supprimer',
  'trash.empty': 'La corbeille est vide.',
  'trash.emptyTrash': 'Vider la corbeille',
  'trash.emptyConfirm': {
    one: 'Supprimer définitivement {count} schéma ? Cette action est irréversible.',
    many: 'Supprimer définitivement {count} de schémas ? Cette action est irréversible.',
    other:
      'Supprimer définitivement {count} schémas ? Cette action est irréversible.',
  },

  'collaboration.for': 'Collaboration sur {name}',
  'collaboration.guestsConnected': {
    one: '{count} invité connecté',
    many: '{count} d’invités connectés',
    other: '{count} invités connectés',
  },
  'collaboration.title': 'Édition collaborative',
  'collaboration.experiment': 'Expérimental',
  'collaboration.description':
    'Les participants se connectent directement via WebRTC et échangent des messages avec un chiffrement de bout en bout.',
  'collaboration.nickname': 'Pseudo',
  'collaboration.link': 'Lien',
  'collaboration.noOneJoined':
    'Personne d’autre n’a encore rejoint la session.',
  'collaboration.startSession': 'Démarrer la session',
  'collaboration.stopSession': 'Arrêter la session',

  'viewer.noSchemaOpen': 'Aucun schéma ouvert',
  'viewer.emptyHint':
    'Choisissez-en un dans la barre latérale ou créez-en un ici. Vous pouvez aussi déposer des fichiers n’importe où pour les importer.',
  'viewer.openSample': 'Ouvrir l’exemple',
  'viewer.sampleName': 'exemple de librairie',

  'drop.title': 'Déposer pour importer',
  'drop.formats':
    'Sauvegardes, documents .erd, .vuerd et .json, SQL, DBML, AML et GraphQL',
  'drop.importing': 'Importation des fichiers…',
  'drop.importingHint':
    'Déposez-en d’autres une fois cette importation terminée',

  'import.imported': {
    one: '{count} schéma importé',
    many: '{count} de schémas importés',
    other: '{count} schémas importés',
  },
  'import.skippedInvalidFiles': {
    one: '{count} fichier non valide ignoré',
    many: '{count} de fichiers non valides ignorés',
    other: '{count} fichiers non valides ignorés',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} schéma non valide ignoré',
    many: '{count} de schémas non valides ignorés',
    other: '{count} schémas non valides ignorés',
  },
  'import.skippedOversized': {
    one: '{count} fichier de plus de {size} MB ignoré',
    many: '{count} de fichiers de plus de {size} MB ignorés',
    other: '{count} fichiers de plus de {size} MB ignorés',
  },
  'import.nothing': 'Rien à importer',
  'import.failed': 'Échec de l’importation',
  'import.exportFailed': 'Échec de l’exportation',

  'update.available': 'Une nouvelle version d’ERD Editor est disponible.',
  'update.updatedElsewhere':
    'L’application a été mise à jour dans un autre onglet — rechargez pour terminer.',

  'live.invalidToken': 'Lien de partage non valide.',
  'live.hostNotFound': 'Hôte introuvable.',
  'live.refresh': 'Actualiser',
  'live.hostStopped': 'L’hôte a arrêté la session.',
  'live.somethingWentWrong': 'Un problème est survenu.',
  'live.lookingForHost': 'Recherche d’un hôte...',
  'live.waitingForHost': 'En attente d’un hôte...',
  'live.session': 'Session en direct',
  'live.inSession': {
    one: '{count} participant',
    many: '{count} de participants',
    other: '{count} participants',
  },
  'live.showParticipants': 'Afficher les participants',
  'live.hideParticipants': 'Masquer les participants',

  'gdrive.checkingSignIn': 'Vérification de votre connexion Google…',
  'gdrive.anotherAccount': 'un autre compte',
  'gdrive.offline.title': 'Vous êtes hors ligne',
  'gdrive.offline.description':
    'ERD Editor vérifiera votre connexion Google dès que vous serez de nouveau en ligne.',
  'gdrive.scopeMissing.title': 'L’accès à Google Drive n’a pas été accordé',
  'gdrive.scopeMissing.description':
    'ERD Editor a besoin d’accéder aux fichiers que vous créez ou ouvrez avec lui. Reconnectez-vous et autorisez l’accès à Google Drive.',
  'gdrive.mismatch.title': 'Google Drive a envoyé ceci pour un autre compte',
  'gdrive.mismatch.description':
    'Vous êtes connecté avec {email}. Passez au compte avec lequel Google Drive l’a ouvert, ou continuez avec les fichiers de ce compte.',
  'gdrive.mismatch.choose':
    'ERD Editor n’a pas pu présélectionner le compte utilisé par Google Drive : choisissez-le quand Google vous le demande.',
  'gdrive.mismatch.switchAccount': 'Changer de compte',
  'gdrive.mismatch.showMyFiles': 'Afficher mes fichiers',
  'gdrive.accountChanged.title': 'Connecté avec un autre compte',
  'gdrive.accountChanged.description':
    'Un autre onglet s’est connecté à un autre compte Google, cet onglet s’est donc arrêté. Rechargez-le pour continuer avec ce compte.',
  'gdrive.unsaved.title': 'Vos modifications n’ont pas été enregistrées',
  'gdrive.unsaved.description':
    '{name} contient des modifications de {email} absentes de Google Drive, et {account} est maintenant connecté. Téléchargez-les avant de continuer.',
  'gdrive.unsaved.descriptionUnnamed':
    'Le fichier que vous aviez ouvert contient des modifications de {email} absentes de Google Drive, et {account} est maintenant connecté. Téléchargez-les avant de continuer.',
  'gdrive.unsaved.continueWithout': 'Continuer sans elles',
  'gdrive.framed.title':
    'Ouvrez l’éditeur Google Drive d’ERD Editor dans son propre onglet',
  'gdrive.framed.description': 'Il ne fonctionne pas dans une autre page.',
  'gdrive.framed.link': 'Ouvrir dans un nouvel onglet',
  'gdrive.notConfigured.title':
    'L’intégration Google Drive n’est pas configurée',
  'gdrive.notConfigured.description':
    'Cette version d’ERD Editor n’a pas de client de connexion Google.',
  'gdrive.unsupportedOrigin.title': 'Google Drive n’est pas disponible ici',
  'gdrive.unsupportedOrigin.description':
    'La connexion Google ne fonctionne que sur erd-editor.io, et ce site est une version de prévisualisation.',

  'gdrive.signIn.title': 'Ouvrez vos fichiers ERD stockés dans Google Drive',
  'gdrive.signIn.description':
    'ERD Editor n’ouvre et n’enregistre que les fichiers que vous créez ou ouvrez avec lui.',
  'gdrive.signIn.fallbackDescription':
    'Le serveur de connexion d’ERD Editor est occupé, Google vous connecte donc par sessions d’une heure.',
  'gdrive.signIn.signIn': 'Se connecter avec Google',
  'gdrive.signIn.continue': 'Continuer avec Google',
  'gdrive.signIn.waitingTitle': 'En attente de la connexion Google…',
  'gdrive.signIn.waitingDescription':
    'Terminez la connexion dans la fenêtre ouverte par Google.',
  'gdrive.signIn.popupBlocked':
    'Votre navigateur a bloqué la fenêtre de connexion. Autorisez les fenêtres pop-up pour ce site, puis réessayez.',
  'gdrive.signIn.failed': 'La connexion Google n’a pas abouti. Réessayez.',
  'gdrive.signIn.gisBlocked':
    'La connexion Google n’a pas pu se charger. Vérifiez que rien ne bloque accounts.google.com, puis rechargez la page.',

  'gdrive.sidebar.label': 'Fichiers Drive',
  'gdrive.sidebar.newFile': 'Nouveau fichier',
  'gdrive.sidebar.import': 'Importer',
  'gdrive.sidebar.searchFiles': 'Rechercher des fichiers',
  'gdrive.sidebar.newFileName': 'Nom du nouveau fichier',
  'gdrive.sidebar.fileName': 'Nom du fichier',
  'gdrive.sidebar.fileNamePlaceholder': 'nom du fichier',
  'gdrive.sidebar.loadingFiles': 'Chargement des fichiers…',
  'gdrive.sidebar.loadFailed': 'Impossible de charger vos fichiers.',

  'gdrive.viewer.noFileOpen': 'Aucun fichier ouvert',
  'gdrive.viewer.noFileOpenHint':
    'Choisissez un fichier dans la barre latérale, ou créez-en un nouveau.',
  'gdrive.viewer.noFilesYet': 'Aucun fichier pour l’instant',
  'gdrive.viewer.noFilesYetHint':
    'Créez un fichier ou importez-en un. Les fichiers que vous ouvrez avec ERD Editor depuis Google Drive apparaissent aussi ici.',
  'gdrive.viewer.waitingForOpener':
    'En attente de l’onglet qui a ouvert ce fichier…',
  'gdrive.viewer.notDocument': 'Ce fichier n’est pas un document ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor ouvre les diagrammes qu’il a lui-même enregistrés. Il laisse ce fichier tel quel et ne l’écrase jamais.',
  'gdrive.viewer.googleNativeHint':
    'Les documents, feuilles de calcul et dossiers Google s’ouvrent dans Google Drive.',
  'gdrive.viewer.trashed': 'Ce fichier est dans la corbeille',
  'gdrive.viewer.trashedHint':
    'Restaurez-le dans Google Drive pour l’ouvrir ici.',
  'gdrive.viewer.tooLarge': 'Ce fichier est trop volumineux',
  'gdrive.viewer.tooLargeHint':
    'ERD Editor ouvre les fichiers jusqu’à {size} MB.',
  'gdrive.viewer.notFound': 'Ce fichier n’est pas disponible',
  'gdrive.viewer.notFoundHint':
    'Il a peut-être été supprimé, ou ce compte Google ne peut pas l’ouvrir.',
  'gdrive.viewer.waitingToken': 'En attente de Google',
  'gdrive.viewer.waitingTokenHint':
    'Ce fichier s’ouvrira dès que votre session Google sera rétablie.',
  'gdrive.viewer.failed': 'Impossible d’ouvrir ce fichier',
  'gdrive.viewer.failedHint':
    'Google Drive n’a pas répondu. Vérifiez la connexion et réessayez.',
  'gdrive.viewer.savingBeforeLeave': 'Enregistrement avant de partir…',

  'gdrive.status.saved': 'Enregistré dans Google Drive',
  'gdrive.status.saving': 'Enregistrement…',
  'gdrive.status.failed': 'Échec de l’enregistrement',
  'gdrive.status.conflict': 'Modifié dans Google Drive',
  'gdrive.status.unconfirmed':
    'Impossible de confirmer le dernier enregistrement',
  'gdrive.status.paused': 'En pause jusqu’à la reconnexion de Google',
  'gdrive.status.deleted': 'Supprimé dans Google Drive',
  'gdrive.status.readonly': 'Lecture seule',
  'gdrive.status.waitingLeader':
    'En attente de l’onglet qui enregistre ce fichier',
  'gdrive.status.waitingSnapshot':
    'En attente de l’onglet qui a ouvert ce fichier',
  'gdrive.status.scopeMissing': 'Aucun accès à Google Drive',

  'gdrive.banner.conflict':
    'Ce fichier a changé dans Google Drive, l’enregistrement s’est donc arrêté. Vos modifications sont toujours là.',
  'gdrive.banner.unconfirmed':
    'Le dernier enregistrement n’a pas pu être confirmé, l’enregistrement s’est donc arrêté. Vos modifications sont toujours là.',
  'gdrive.banner.deleted':
    'Ce fichier a été supprimé ou mis à la corbeille dans Google Drive, l’enregistrement s’est donc arrêté.',
  'gdrive.banner.readonly':
    'Vous ne pouvez plus modifier ce fichier dans Google Drive, l’enregistrement s’est donc arrêté. Vos modifications sont toujours là.',
  'gdrive.banner.checkDrive': 'Vérifier Drive',
  'gdrive.banner.reloadFromDrive': 'Recharger depuis Drive',
  'gdrive.banner.leaderNotResponding':
    'L’onglet qui enregistre ce fichier ne répond pas.',
  'gdrive.banner.openerNotResponding':
    'L’onglet qui a ouvert ce fichier ne répond pas.',
  'gdrive.banner.takeOver': 'Prendre le relais de l’enregistrement',
  'gdrive.banner.openAndTakeOver': 'Ouvrir depuis Drive et prendre le relais',
  'gdrive.banner.popupBlocked':
    'Votre navigateur a bloqué la fenêtre Google. Autorisez les fenêtres pop-up pour ce site, puis reconnectez-vous.',
  'gdrive.banner.reconnectFailed':
    'La reconnexion à Google a échoué. Réessayez.',
  'gdrive.banner.sessionEnded':
    'Votre session Google a pris fin, l’enregistrement est donc en pause.',
  'gdrive.banner.sessionEndsSoon': 'Votre session Google prend bientôt fin.',
  'gdrive.banner.reconnect': 'Reconnecter Google',

  'gdrive.leave.title': 'Vos dernières modifications ne sont pas enregistrées',
  'gdrive.leave.description':
    'ERD Editor n’a pas pu les enregistrer dans Google Drive. Téléchargez-les pour en garder une copie, ou partez et perdez-les.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor n’a pas pu les enregistrer dans Google Drive. Téléchargez-les pour en garder une copie, ou déconnectez-vous et perdez-les.',
  'gdrive.leave.stay': 'Rester',
  'gdrive.leave.leaveAnyway': 'Partir quand même',
  'gdrive.leave.signOutAnyway': 'Se déconnecter quand même',

  'gdrive.create.title': 'Nouveau fichier dans Google Drive',
  'gdrive.create.inAppFolder': 'Dans le dossier ERD Editor',
  'gdrive.create.inFolderPending': 'Dans un dossier…',
  'gdrive.create.inHiddenFolder':
    'Dans un dossier qu’ERD Editor ne peut pas voir',
  'gdrive.create.inFolder': 'Dans le dossier « {name} »',
  'gdrive.create.untitled': 'Sans titre',
  'gdrive.create.savedAs': 'Sera enregistré sous {name}',
  'gdrive.create.folderRefused':
    'ERD Editor ne peut pas créer de fichiers dans ce dossier. Le créer plutôt dans le dossier ERD Editor ?',
  'gdrive.create.failed': 'Impossible de créer le fichier. Réessayez.',
  'gdrive.create.createInAppFolder': 'Créer dans le dossier ERD Editor',
  'gdrive.create.create': 'Créer',

  'gdrive.import.imported': {
    one: '{count} fichier importé dans Google Drive',
    many: '{count} de fichiers importés dans Google Drive',
    other: '{count} fichiers importés dans Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} sauvegarde ignorée : les sauvegardes restent dans l’application locale',
    many: '{count} de sauvegardes ignorées : les sauvegardes restent dans l’application locale',
    other:
      '{count} sauvegardes ignorées : les sauvegardes restent dans l’application locale',
  },
  'gdrive.import.uploadsFailed': {
    one: 'Échec de {count} envoi',
    many: 'Échec de {count} d’envois',
    other: 'Échec de {count} envois',
  },

  'gdrive.notice.unreadableState':
    'Google Drive a envoyé un lien qu’ERD Editor n’a pas pu lire',
  'gdrive.notice.renameFailed': 'Impossible de renommer le fichier',
  'gdrive.notice.createFailed': 'Impossible de créer le fichier',
  'gdrive.notice.checkFailed': 'Impossible de joindre Google Drive. Réessayez.',
  'gdrive.notice.reloadFailed':
    'Impossible de recharger depuis Google Drive. Réessayez.',
  'gdrive.notice.reloadTrashed':
    'Rechargement impossible : le fichier est dans la corbeille de Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Rechargement impossible : le fichier dans Google Drive dépasse {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Rechargement impossible : le fichier dans Google Drive n’est plus un document ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Déconnecté ici. Le serveur d’ERD Editor ne l’a pas confirmé, ce navigateur terminera donc la déconnexion à sa prochaine connexion',
  'gdrive.notice.signOutNotRevoked':
    'Déconnecté ici, mais Google n’a pas confirmé avoir retiré l’accès d’ERD Editor : vos autres appareils peuvent rester connectés jusqu’à ce que vous le retiriez sur myaccount.google.com/permissions',
} satisfies Messages;
