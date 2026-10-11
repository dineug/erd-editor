import type { Messages } from '@/i18n/translate';

/** The app's own text in Italian, key for key as English writes it. */
export const itIT = {
  'common.cancel': 'Annulla',
  'common.close': 'Chiudi',
  'common.dismiss': 'Chiudi',
  'common.tryAgain': 'Riprova',
  'common.reload': 'Ricarica',
  'common.loading': 'Caricamento…',
  'common.search': 'Cerca',
  'common.rename': 'Rinomina',
  'common.importFiles': 'Importa file',
  'common.signOut': 'Esci',
  'common.downloadMyChanges': 'Scarica le mie modifiche',
  'common.edited': 'Modificato {time}',
  'common.system': 'Sistema',
  'common.displayLanguage': 'Lingua di visualizzazione',
  'common.theme': 'Tema',
  'common.light': 'Chiaro',
  'common.dark': 'Scuro',
  'common.host': 'Host',
  'common.guest': 'Ospite',
  'common.you': '(tu)',
  'common.participants': 'Partecipanti',
  'common.yourNickname': 'Il tuo nickname',
  'common.privacy': 'Privacy',
  'common.terms': 'Termini',
  'common.editingGuide': 'Guida alla modifica',
  'common.openSidebar': 'Apri barra laterale',
  'common.closeSidebar': 'Chiudi barra laterale',

  'time.justNow': 'proprio ora',
  'time.today': 'Oggi',
  'time.yesterday': 'Ieri',
  'time.previous7Days': 'Ultimi 7 giorni',
  'time.previous30Days': 'Ultimi 30 giorni',

  'sidebar.schemas': 'Schemi',
  'sidebar.newSchema': 'Nuovo schema',
  'sidebar.importAndExport': 'Importa ed esporta',
  'sidebar.exportBackup': 'Esporta backup',
  'sidebar.searchSchemas': 'Cerca schemi',
  'sidebar.newSchemaName': 'Nome del nuovo schema',
  'sidebar.schemaName': 'Nome dello schema',
  'sidebar.schemaNamePlaceholder': 'nome dello schema',
  'sidebar.duplicate': 'Duplica',
  'sidebar.moveToTrash': 'Sposta nel cestino',
  'sidebar.actionsFor': 'Azioni per {name}',
  'sidebar.noResults': 'Nessun risultato',

  'trash.button': 'Cestino ({count})',
  'trash.title': 'Cestino',
  'trash.description': {
    one: 'Gli schemi nel cestino vengono eliminati definitivamente dopo {count} giorno.',
    many: 'Gli schemi nel cestino vengono eliminati definitivamente dopo {count} di giorni.',
    other:
      'Gli schemi nel cestino vengono eliminati definitivamente dopo {count} giorni.',
  },
  'trash.listLabel': 'Schemi nel cestino',
  'trash.deleted': 'Eliminato {time}',
  'trash.deletesToday': 'verrà eliminato oggi',
  'trash.deletesTomorrow': 'verrà eliminato domani',
  'trash.deletesIn': {
    one: 'verrà eliminato tra {count} giorno',
    many: 'verrà eliminato tra {count} di giorni',
    other: 'verrà eliminato tra {count} giorni',
  },
  'trash.restore': 'Ripristina',
  'trash.deletePermanently': 'Elimina definitivamente',
  'trash.cannotBeUndone': 'L’operazione non può essere annullata.',
  'trash.delete': 'Elimina',
  'trash.empty': 'Il cestino è vuoto.',
  'trash.emptyTrash': 'Svuota cestino',
  'trash.emptyConfirm': {
    one: 'Eliminare definitivamente {count} schema? L’operazione non può essere annullata.',
    many: 'Eliminare definitivamente {count} di schemi? L’operazione non può essere annullata.',
    other:
      'Eliminare definitivamente {count} schemi? L’operazione non può essere annullata.',
  },

  'collaboration.for': 'Collaborazione su {name}',
  'collaboration.guestsConnected': {
    one: '{count} ospite connesso',
    many: '{count} di ospiti connessi',
    other: '{count} ospiti connessi',
  },
  'collaboration.title': 'Modifica collaborativa',
  'collaboration.experiment': 'Sperimentale',
  'collaboration.description':
    'I partecipanti si collegano direttamente tramite WebRTC e si scambiano messaggi con crittografia end-to-end.',
  'collaboration.nickname': 'Nickname',
  'collaboration.link': 'Link',
  'collaboration.noOneJoined': 'Nessun altro si è ancora unito.',
  'collaboration.startSession': 'Avvia sessione',
  'collaboration.stopSession': 'Interrompi sessione',

  'viewer.noSchemaOpen': 'Nessuno schema aperto',
  'viewer.emptyHint':
    'Scegline uno dalla barra laterale o creane uno qui. Puoi anche trascinare i file ovunque per importarli.',
  'viewer.openSample': 'Apri esempio',
  'viewer.sampleName': 'esempio di libreria',

  'drop.title': 'Rilascia per importare',
  'drop.formats':
    'Backup, documenti .erd, .vuerd e .json, SQL, DBML, AML e GraphQL',
  'drop.importing': 'Importazione dei file…',
  'drop.importingHint': 'Rilascia altri file al termine di questa importazione',

  'import.imported': {
    one: '{count} schema importato',
    many: '{count} di schemi importati',
    other: '{count} schemi importati',
  },
  'import.skippedInvalidFiles': {
    one: '{count} file non valido ignorato',
    many: '{count} di file non validi ignorati',
    other: '{count} file non validi ignorati',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} schema non valido ignorato',
    many: '{count} di schemi non validi ignorati',
    other: '{count} schemi non validi ignorati',
  },
  'import.skippedOversized': {
    one: '{count} file oltre {size} MB ignorato',
    many: '{count} di file oltre {size} MB ignorati',
    other: '{count} file oltre {size} MB ignorati',
  },
  'import.nothing': 'Niente da importare',
  'import.failed': 'Importazione non riuscita',
  'import.exportFailed': 'Esportazione non riuscita',

  'update.available': 'È disponibile una nuova versione di ERD Editor.',
  'update.updatedElsewhere':
    'L’app è stata aggiornata in un’altra scheda: ricarica per completare.',

  'live.invalidToken': 'Token di condivisione non valido.',
  'live.hostNotFound': 'Host non trovato.',
  'live.refresh': 'Aggiorna',
  'live.hostStopped': 'L’host ha interrotto la sessione.',
  'live.somethingWentWrong': 'Si è verificato un problema.',
  'live.lookingForHost': 'Ricerca di un host...',
  'live.waitingForHost': 'In attesa dell’host...',
  'live.session': 'Sessione in tempo reale',
  'live.inSession': {
    one: '{count} nella sessione',
    many: '{count} nella sessione',
    other: '{count} nella sessione',
  },
  'live.showParticipants': 'Mostra partecipanti',
  'live.hideParticipants': 'Nascondi partecipanti',

  'gdrive.checkingSignIn': 'Verifica dell’accesso a Google…',
  'gdrive.anotherAccount': 'un altro account',
  'gdrive.offline.title': 'Sei offline',
  'gdrive.offline.description':
    'ERD Editor verificherà l’accesso a Google quando tornerai online.',
  'gdrive.scopeMissing.title': 'L’accesso a Google Drive non è stato concesso',
  'gdrive.scopeMissing.description':
    'ERD Editor ha bisogno di accedere ai file che crei o apri con esso. Accedi di nuovo e consenti l’accesso a Google Drive.',
  'gdrive.mismatch.title':
    'Google Drive ha inviato questo file per un altro account',
  'gdrive.mismatch.description':
    'Hai eseguito l’accesso come {email}. Passa all’account con cui Google Drive l’ha aperto, oppure continua con i file di questo account.',
  'gdrive.mismatch.choose':
    'ERD Editor non è riuscito a preselezionare quell’account, quindi sceglilo quando Google lo chiede.',
  'gdrive.mismatch.switchAccount': 'Cambia account',
  'gdrive.mismatch.showMyFiles': 'Mostra i miei file',
  'gdrive.accountChanged.title': 'Accesso eseguito con un altro account',
  'gdrive.accountChanged.description':
    'Un’altra scheda ha eseguito l’accesso a un altro account Google, quindi questa scheda si è fermata. Ricaricala per continuare con quell’account.',
  'gdrive.unsaved.title': 'Le tue modifiche non sono state salvate',
  'gdrive.unsaved.description':
    '{name} contiene modifiche di {email} che non sono in Google Drive, e ora è connesso {account}. Scaricale prima di continuare.',
  'gdrive.unsaved.descriptionUnnamed':
    'Il file che avevi aperto contiene modifiche di {email} che non sono in Google Drive, e ora è connesso {account}. Scaricale prima di continuare.',
  'gdrive.unsaved.continueWithout': 'Continua senza le modifiche',
  'gdrive.framed.title':
    'Apri l’editor Google Drive di ERD Editor in una scheda dedicata',
  'gdrive.framed.description': 'Non funziona all’interno di un’altra pagina.',
  'gdrive.framed.link': 'Apri in una nuova scheda',
  'gdrive.notConfigured.title':
    'L’integrazione con Google Drive non è configurata',
  'gdrive.notConfigured.description':
    'Questa build di ERD Editor non ha un client di accesso Google.',
  'gdrive.unsupportedOrigin.title': 'Google Drive non è disponibile qui',
  'gdrive.unsupportedOrigin.description':
    'L’accesso con Google funziona solo su erd-editor.io, e questa è un’anteprima.',

  'gdrive.signIn.title': 'Apri i tuoi file ERD da Google Drive',
  'gdrive.signIn.description':
    'ERD Editor apre e salva solo i file che crei o apri con esso.',
  'gdrive.signIn.fallbackDescription':
    'Il server di accesso di ERD Editor è occupato, quindi Google ti fa accedere per un’ora alla volta.',
  'gdrive.signIn.signIn': 'Accedi con Google',
  'gdrive.signIn.continue': 'Continua con Google',
  'gdrive.signIn.waitingTitle': 'In attesa dell’accesso a Google…',
  'gdrive.signIn.waitingDescription':
    'Completa l’accesso nella finestra aperta da Google.',
  'gdrive.signIn.popupBlocked':
    'Il browser ha bloccato la finestra di accesso. Consenti i pop-up per questo sito e riprova.',
  'gdrive.signIn.failed': 'L’accesso a Google non è stato completato. Riprova.',
  'gdrive.signIn.gisBlocked':
    'Impossibile caricare l’accesso a Google. Verifica che nulla blocchi accounts.google.com, poi ricarica la pagina.',

  'gdrive.sidebar.label': 'File di Drive',
  'gdrive.sidebar.newFile': 'Nuovo file',
  'gdrive.sidebar.import': 'Importa',
  'gdrive.sidebar.searchFiles': 'Cerca file',
  'gdrive.sidebar.newFileName': 'Nome del nuovo file',
  'gdrive.sidebar.fileName': 'Nome del file',
  'gdrive.sidebar.fileNamePlaceholder': 'nome del file',
  'gdrive.sidebar.loadingFiles': 'Caricamento dei file…',
  'gdrive.sidebar.loadFailed': 'Impossibile caricare i tuoi file.',

  'gdrive.viewer.noFileOpen': 'Nessun file aperto',
  'gdrive.viewer.noFileOpenHint':
    'Scegli un file dalla barra laterale o creane uno nuovo.',
  'gdrive.viewer.noFilesYet': 'Ancora nessun file',
  'gdrive.viewer.noFilesYetHint':
    'Crea un file o importane uno. Anche i file che apri con ERD Editor da Google Drive compaiono qui.',
  'gdrive.viewer.waitingForOpener':
    'In attesa della scheda che ha aperto questo file…',
  'gdrive.viewer.notDocument': 'Questo file non è un documento di ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor apre solo i diagrammi che ha salvato. Questo file resta com’è e non viene mai sovrascritto.',
  'gdrive.viewer.googleNativeHint':
    'Documenti, Fogli e cartelle Google si aprono in Google Drive.',
  'gdrive.viewer.trashed': 'Questo file è nel cestino',
  'gdrive.viewer.trashedHint': 'Ripristinalo in Google Drive per aprirlo qui.',
  'gdrive.viewer.tooLarge': 'Questo file è troppo grande',
  'gdrive.viewer.tooLargeHint': 'ERD Editor apre file fino a {size} MB.',
  'gdrive.viewer.notFound': 'Questo file non è disponibile',
  'gdrive.viewer.notFoundHint':
    'Potrebbe essere stato eliminato, oppure questo account Google non può aprirlo.',
  'gdrive.viewer.waitingToken': 'In attesa di Google',
  'gdrive.viewer.waitingTokenHint':
    'Questo file si aprirà quando la sessione Google sarà ripristinata.',
  'gdrive.viewer.failed': 'Impossibile aprire questo file',
  'gdrive.viewer.failedHint':
    'Google Drive non ha risposto. Controlla la connessione e riprova.',
  'gdrive.viewer.savingBeforeLeave': 'Salvataggio prima di uscire…',

  'gdrive.status.saved': 'Salvato in Google Drive',
  'gdrive.status.saving': 'Salvataggio…',
  'gdrive.status.failed': 'Impossibile salvare',
  'gdrive.status.conflict': 'Modificato in Google Drive',
  'gdrive.status.unconfirmed': 'Impossibile confermare l’ultimo salvataggio',
  'gdrive.status.paused': 'In pausa finché Google non si riconnette',
  'gdrive.status.deleted': 'Eliminato in Google Drive',
  'gdrive.status.readonly': 'Solo visualizzazione',
  'gdrive.status.waitingLeader': 'In attesa della scheda che salva questo file',
  'gdrive.status.waitingSnapshot':
    'In attesa della scheda che ha aperto questo file',
  'gdrive.status.scopeMissing': 'Nessun accesso a Google Drive',

  'gdrive.banner.conflict':
    'Questo file è cambiato in Google Drive, quindi il salvataggio si è interrotto. Le tue modifiche sono ancora qui.',
  'gdrive.banner.unconfirmed':
    'Impossibile confermare l’ultimo salvataggio, quindi il salvataggio si è interrotto. Le tue modifiche sono ancora qui.',
  'gdrive.banner.deleted':
    'Questo file è stato eliminato o spostato nel cestino in Google Drive, quindi il salvataggio si è interrotto.',
  'gdrive.banner.readonly':
    'Non puoi più modificare questo file in Google Drive, quindi il salvataggio si è interrotto. Le tue modifiche sono ancora qui.',
  'gdrive.banner.checkDrive': 'Controlla Drive',
  'gdrive.banner.reloadFromDrive': 'Ricarica da Drive',
  'gdrive.banner.leaderNotResponding':
    'La scheda che salva questo file non risponde.',
  'gdrive.banner.openerNotResponding':
    'La scheda che ha aperto questo file non risponde.',
  'gdrive.banner.takeOver': 'Subentra nel salvataggio',
  'gdrive.banner.openAndTakeOver': 'Apri da Drive e subentra',
  'gdrive.banner.popupBlocked':
    'Il browser ha bloccato la finestra di Google. Consenti i pop-up per questo sito, poi riconnettiti.',
  'gdrive.banner.reconnectFailed': 'Google non si è riconnesso. Riprova.',
  'gdrive.banner.sessionEnded':
    'La sessione Google è terminata, quindi il salvataggio è in pausa.',
  'gdrive.banner.sessionEndsSoon': 'La sessione Google sta per terminare.',
  'gdrive.banner.reconnect': 'Riconnetti Google',

  'gdrive.leave.title': 'Le ultime modifiche non sono salvate',
  'gdrive.leave.description':
    'ERD Editor non è riuscito a salvarle in Google Drive. Scaricale per conservarne una copia, oppure esci e perdile.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor non è riuscito a salvarle in Google Drive. Scaricale per conservarne una copia, oppure esci dall’account e perdile.',
  'gdrive.leave.stay': 'Resta',
  'gdrive.leave.leaveAnyway': 'Esci comunque',
  'gdrive.leave.signOutAnyway': 'Esci comunque',

  'gdrive.create.title': 'Nuovo file in Google Drive',
  'gdrive.create.inAppFolder': 'Nella cartella ERD Editor',
  'gdrive.create.inFolderPending': 'In una cartella…',
  'gdrive.create.inHiddenFolder':
    'In una cartella che ERD Editor non può vedere',
  'gdrive.create.inFolder': 'Nella cartella «{name}»',
  'gdrive.create.untitled': 'Senza titolo',
  'gdrive.create.savedAs': 'Verrà salvato come {name}',
  'gdrive.create.folderRefused':
    'ERD Editor non può creare file in questa cartella. Crearlo invece nella cartella ERD Editor?',
  'gdrive.create.failed': 'Impossibile creare il file. Riprova.',
  'gdrive.create.createInAppFolder': 'Crea nella cartella ERD Editor',
  'gdrive.create.create': 'Crea',

  'gdrive.import.imported': {
    one: '{count} file importato in Google Drive',
    many: '{count} di file importati in Google Drive',
    other: '{count} file importati in Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} backup ignorato: i backup restano nell’app locale',
    many: '{count} di backup ignorati: i backup restano nell’app locale',
    other: '{count} backup ignorati: i backup restano nell’app locale',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} caricamento non riuscito',
    many: '{count} di caricamenti non riusciti',
    other: '{count} caricamenti non riusciti',
  },

  'gdrive.notice.unreadableState':
    'Google Drive ha inviato un link che ERD Editor non è riuscito a leggere',
  'gdrive.notice.renameFailed': 'Impossibile rinominare il file',
  'gdrive.notice.createFailed': 'Impossibile creare il file',
  'gdrive.notice.checkFailed': 'Impossibile raggiungere Google Drive. Riprova.',
  'gdrive.notice.reloadFailed':
    'Impossibile ricaricare da Google Drive. Riprova.',
  'gdrive.notice.reloadTrashed':
    'Impossibile ricaricare: il file è nel cestino di Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Impossibile ricaricare: il file in Google Drive supera {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Impossibile ricaricare: il file in Google Drive non è più un documento di ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Disconnesso qui. Il server di ERD Editor non l’ha confermato, quindi questo browser completerà la disconnessione al prossimo collegamento',
  'gdrive.notice.signOutNotRevoked':
    'Disconnesso qui, ma Google non ha confermato di aver rimosso l’accesso di ERD Editor, quindi gli altri dispositivi potrebbero restare connessi finché non lo rimuovi su myaccount.google.com/permissions',
} satisfies Messages;
