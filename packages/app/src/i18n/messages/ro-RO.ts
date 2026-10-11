import type { Messages } from '@/i18n/translate';

/** The app's own text in Romanian, key for key as English writes it. */
export const roRO = {
  'common.cancel': 'Revocare',
  'common.close': 'Închidere',
  'common.dismiss': 'Închidere',
  'common.tryAgain': 'Reîncercați',
  'common.reload': 'Reîncărcați',
  'common.loading': 'Se încarcă…',
  'common.search': 'Căutare',
  'common.rename': 'Redenumire',
  'common.importFiles': 'Importați fișiere',
  'common.signOut': 'Deconectați-vă',
  'common.downloadMyChanges': 'Descărcați modificările mele',
  'common.edited': 'Editat {time}',
  'common.system': 'Sistem',
  'common.displayLanguage': 'Limbă de afișare',
  'common.theme': 'Temă',
  'common.light': 'Luminos',
  'common.dark': 'Întunecat',
  'common.host': 'Gazdă',
  'common.guest': 'Invitat',
  'common.you': '(dvs.)',
  'common.participants': 'Participanți',
  'common.yourNickname': 'Porecla dvs.',
  'common.privacy': 'Confidențialitate',
  'common.terms': 'Termeni',
  'common.editingGuide': 'Ghid de editare',
  'common.openSidebar': 'Deschideți bara laterală',
  'common.closeSidebar': 'Închideți bara laterală',

  'time.justNow': 'chiar acum',
  'time.today': 'Astăzi',
  'time.yesterday': 'Ieri',
  'time.previous7Days': 'Ultimele 7 zile',
  'time.previous30Days': 'Ultimele 30 de zile',

  'sidebar.schemas': 'Scheme',
  'sidebar.newSchema': 'Schemă nouă',
  'sidebar.importAndExport': 'Import și export',
  'sidebar.exportBackup': 'Exportați copia de rezervă',
  'sidebar.searchSchemas': 'Căutați scheme',
  'sidebar.newSchemaName': 'Numele schemei noi',
  'sidebar.schemaName': 'Numele schemei',
  'sidebar.schemaNamePlaceholder': 'numele schemei',
  'sidebar.duplicate': 'Duplicare',
  'sidebar.moveToTrash': 'Mutare în coșul de gunoi',
  'sidebar.actionsFor': 'Acțiuni pentru {name}',
  'sidebar.noResults': 'Niciun rezultat',

  'trash.button': 'Coș de gunoi ({count})',
  'trash.title': 'Coș de gunoi',
  'trash.description': {
    one: 'Schemele din coșul de gunoi sunt șterse definitiv după {count} zi.',
    few: 'Schemele din coșul de gunoi sunt șterse definitiv după {count} zile.',
    other:
      'Schemele din coșul de gunoi sunt șterse definitiv după {count} de zile.',
  },
  'trash.listLabel': 'Scheme din coșul de gunoi',
  'trash.deleted': 'Șters {time}',
  'trash.deletesToday': 'se șterge astăzi',
  'trash.deletesTomorrow': 'se șterge mâine',
  'trash.deletesIn': {
    one: 'se șterge peste {count} zi',
    few: 'se șterge peste {count} zile',
    other: 'se șterge peste {count} de zile',
  },
  'trash.restore': 'Restabiliți',
  'trash.deletePermanently': 'Ștergeți definitiv',
  'trash.cannotBeUndone': 'Acțiunea nu poate fi anulată.',
  'trash.delete': 'Ștergere',
  'trash.empty': 'Coșul de gunoi este gol.',
  'trash.emptyTrash': 'Goliți coșul de gunoi',
  'trash.emptyConfirm': {
    one: 'Ștergeți definitiv {count} schemă? Acțiunea nu poate fi anulată.',
    few: 'Ștergeți definitiv {count} scheme? Acțiunea nu poate fi anulată.',
    other:
      'Ștergeți definitiv {count} de scheme? Acțiunea nu poate fi anulată.',
  },

  'collaboration.for': 'Colaborare pentru {name}',
  'collaboration.guestsConnected': {
    one: '{count} invitat conectat',
    few: '{count} invitați conectați',
    other: '{count} de invitați conectați',
  },
  'collaboration.title': 'Editare colaborativă',
  'collaboration.experiment': 'Experimental',
  'collaboration.description':
    'Participanții se conectează direct prin WebRTC și schimbă mesaje cu criptare integrală.',
  'collaboration.nickname': 'Poreclă',
  'collaboration.link': 'Link',
  'collaboration.noOneJoined': 'Încă nu s-a alăturat nimeni altcineva.',
  'collaboration.startSession': 'Începeți sesiunea',
  'collaboration.stopSession': 'Opriți sesiunea',

  'viewer.noSchemaOpen': 'Nicio schemă deschisă',
  'viewer.emptyHint':
    'Alegeți una din bara laterală sau începeți una aici. Puteți și să plasați fișiere oriunde pentru a le importa.',
  'viewer.openSample': 'Deschideți exemplul',
  'viewer.sampleName': 'exemplu de librărie',

  'drop.title': 'Plasați pentru a importa',
  'drop.formats':
    'Copii de rezervă, documente .erd, .vuerd și .json, SQL, DBML, AML și GraphQL',
  'drop.importing': 'Se importă fișierele…',
  'drop.importingHint': 'Plasați fișierele după ce se termină acest import',

  'import.imported': {
    one: 'S-a importat {count} schemă',
    few: 'S-au importat {count} scheme',
    other: 'S-au importat {count} de scheme',
  },
  'import.skippedInvalidFiles': {
    one: 'S-a omis {count} fișier nevalid',
    few: 'S-au omis {count} fișiere nevalide',
    other: 'S-au omis {count} de fișiere nevalide',
  },
  'import.skippedInvalidSchemas': {
    one: 'S-a omis {count} schemă nevalidă',
    few: 'S-au omis {count} scheme nevalide',
    other: 'S-au omis {count} de scheme nevalide',
  },
  'import.skippedOversized': {
    one: 'S-a omis {count} fișier de peste {size} MB',
    few: 'S-au omis {count} fișiere de peste {size} MB',
    other: 'S-au omis {count} de fișiere de peste {size} MB',
  },
  'import.nothing': 'Nimic de importat',
  'import.failed': 'Importul nu a reușit',
  'import.exportFailed': 'Exportul nu a reușit',

  'update.available': 'Este disponibilă o versiune nouă de ERD Editor.',
  'update.updatedElsewhere':
    'Aplicația a fost actualizată în altă filă — reîncărcați pentru a finaliza.',

  'live.invalidToken': 'Token de partajare nevalid.',
  'live.hostNotFound': 'Gazda nu a fost găsită.',
  'live.refresh': 'Reîmprospătați',
  'live.hostStopped': 'Gazda a oprit sesiunea.',
  'live.somethingWentWrong': 'A apărut o problemă.',
  'live.lookingForHost': 'Se caută o gazdă...',
  'live.waitingForHost': 'Se așteaptă o gazdă...',
  'live.session': 'Sesiune live',
  'live.inSession': {
    one: '{count} în sesiune',
    few: '{count} în sesiune',
    other: '{count} în sesiune',
  },
  'live.showParticipants': 'Afișați participanții',
  'live.hideParticipants': 'Ascundeți participanții',

  'gdrive.checkingSignIn': 'Se verifică conectarea la Google…',
  'gdrive.anotherAccount': 'alt cont',
  'gdrive.offline.title': 'Sunteți offline',
  'gdrive.offline.description':
    'ERD Editor vă verifică conectarea la Google când reveniți online.',
  'gdrive.scopeMissing.title': 'Accesul la Google Drive nu a fost acordat',
  'gdrive.scopeMissing.description':
    'ERD Editor are nevoie de acces la fișierele pe care le creați sau le deschideți cu el. Conectați-vă din nou și permiteți accesul la Google Drive.',
  'gdrive.mismatch.title': 'Google Drive a trimis acest fișier pentru alt cont',
  'gdrive.mismatch.description':
    'Sunteți conectat ca {email}. Comutați la contul cu care Google Drive l-a deschis sau continuați cu fișierele acestui cont.',
  'gdrive.mismatch.choose':
    'ERD Editor nu a putut preselecta acel cont, așa că alegeți-l când vă întreabă Google.',
  'gdrive.mismatch.switchAccount': 'Comutați contul',
  'gdrive.mismatch.showMyFiles': 'Afișați fișierele mele',
  'gdrive.accountChanged.title': 'Conectat cu alt cont',
  'gdrive.accountChanged.description':
    'Altă filă s-a conectat la un alt cont Google, așa că această filă s-a oprit. Reîncărcați-o pentru a continua cu acel cont.',
  'gdrive.unsaved.title': 'Modificările nu au fost salvate',
  'gdrive.unsaved.description':
    '{name} are modificări de la {email} care nu sunt în Google Drive, iar acum este conectat {account}. Descărcați-le înainte de a continua.',
  'gdrive.unsaved.descriptionUnnamed':
    'Fișierul pe care îl aveați deschis are modificări de la {email} care nu sunt în Google Drive, iar acum este conectat {account}. Descărcați-le înainte de a continua.',
  'gdrive.unsaved.continueWithout': 'Continuați fără ele',
  'gdrive.framed.title':
    'Deschideți editorul Google Drive din ERD Editor într-o filă separată',
  'gdrive.framed.description': 'Nu funcționează în interiorul altei pagini.',
  'gdrive.framed.link': 'Deschideți într-o filă nouă',
  'gdrive.notConfigured.title': 'Integrarea Google Drive nu este configurată',
  'gdrive.notConfigured.description':
    'Această versiune a ERD Editor nu are un client de conectare Google.',
  'gdrive.unsupportedOrigin.title': 'Google Drive nu este disponibil aici',
  'gdrive.unsupportedOrigin.description':
    'Conectarea cu Google funcționează doar pe erd-editor.io, iar aceasta este o previzualizare.',

  'gdrive.signIn.title': 'Deschideți fișierele ERD din Google Drive',
  'gdrive.signIn.description':
    'ERD Editor deschide și salvează doar fișierele pe care le creați sau le deschideți cu el.',
  'gdrive.signIn.fallbackDescription':
    'Serverul de conectare ERD Editor este ocupat, așa că Google vă conectează pentru câte o oră.',
  'gdrive.signIn.signIn': 'Conectați-vă cu Google',
  'gdrive.signIn.continue': 'Continuați cu Google',
  'gdrive.signIn.waitingTitle': 'Se așteaptă conectarea la Google…',
  'gdrive.signIn.waitingDescription':
    'Finalizați conectarea în fereastra deschisă de Google.',
  'gdrive.signIn.popupBlocked':
    'Browserul a blocat fereastra de conectare. Permiteți ferestrele pop-up pentru acest site, apoi reîncercați.',
  'gdrive.signIn.failed': 'Conectarea la Google nu s-a finalizat. Reîncercați.',
  'gdrive.signIn.gisBlocked':
    'Conectarea cu Google nu s-a putut încărca. Asigurați-vă că nimic nu blochează accounts.google.com, apoi reîncărcați pagina.',

  'gdrive.sidebar.label': 'Fișiere Drive',
  'gdrive.sidebar.newFile': 'Fișier nou',
  'gdrive.sidebar.import': 'Import',
  'gdrive.sidebar.searchFiles': 'Căutați fișiere',
  'gdrive.sidebar.newFileName': 'Numele fișierului nou',
  'gdrive.sidebar.fileName': 'Numele fișierului',
  'gdrive.sidebar.fileNamePlaceholder': 'numele fișierului',
  'gdrive.sidebar.loadingFiles': 'Se încarcă fișierele…',
  'gdrive.sidebar.loadFailed': 'Fișierele nu au putut fi încărcate.',

  'gdrive.viewer.noFileOpen': 'Niciun fișier deschis',
  'gdrive.viewer.noFileOpenHint':
    'Alegeți un fișier din bara laterală sau începeți unul nou.',
  'gdrive.viewer.noFilesYet': 'Încă nu există fișiere',
  'gdrive.viewer.noFilesYetHint':
    'Creați un fișier sau importați unul. Fișierele pe care le deschideți cu ERD Editor din Google Drive apar și aici.',
  'gdrive.viewer.waitingForOpener':
    'Se așteaptă fila care a deschis acest fișier…',
  'gdrive.viewer.notDocument': 'Acest fișier nu este un document ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor deschide diagramele pe care le-a salvat el însuși. Acest fișier rămâne așa cum este și nu va fi suprascris niciodată.',
  'gdrive.viewer.googleNativeHint':
    'Documentele, foile de calcul și dosarele Google se deschid în Google Drive.',
  'gdrive.viewer.trashed': 'Acest fișier este în coșul de gunoi',
  'gdrive.viewer.trashedHint':
    'Restabiliți-l în Google Drive pentru a-l deschide aici.',
  'gdrive.viewer.tooLarge': 'Acest fișier este prea mare',
  'gdrive.viewer.tooLargeHint':
    'ERD Editor deschide fișiere de până la {size} MB.',
  'gdrive.viewer.notFound': 'Acest fișier nu este disponibil',
  'gdrive.viewer.notFoundHint':
    'Este posibil să fi fost șters sau acest cont Google nu îl poate deschide.',
  'gdrive.viewer.waitingToken': 'Se așteaptă Google',
  'gdrive.viewer.waitingTokenHint':
    'Acest fișier se deschide când revine sesiunea Google.',
  'gdrive.viewer.failed': 'Acest fișier nu a putut fi deschis',
  'gdrive.viewer.failedHint':
    'Google Drive nu a răspuns. Verificați conexiunea și reîncercați.',
  'gdrive.viewer.savingBeforeLeave': 'Se salvează înainte să plecați…',

  'gdrive.status.saved': 'Salvat în Google Drive',
  'gdrive.status.saving': 'Se salvează…',
  'gdrive.status.failed': 'Nu s-a putut salva',
  'gdrive.status.conflict': 'Modificat în Google Drive',
  'gdrive.status.unconfirmed': 'Ultima salvare nu a putut fi confirmată',
  'gdrive.status.paused': 'Întrerupt până la reconectarea Google',
  'gdrive.status.deleted': 'Șters în Google Drive',
  'gdrive.status.readonly': 'Doar vizualizare',
  'gdrive.status.waitingLeader': 'Se așteaptă fila care salvează acest fișier',
  'gdrive.status.waitingSnapshot':
    'Se așteaptă fila care a deschis acest fișier',
  'gdrive.status.scopeMissing': 'Fără acces la Google Drive',

  'gdrive.banner.conflict':
    'Acest fișier s-a modificat în Google Drive, așa că salvarea s-a oprit. Modificările dvs. sunt încă aici.',
  'gdrive.banner.unconfirmed':
    'Ultima salvare nu a putut fi confirmată, așa că salvarea s-a oprit. Modificările dvs. sunt încă aici.',
  'gdrive.banner.deleted':
    'Acest fișier a fost șters sau mutat în coșul de gunoi în Google Drive, așa că salvarea s-a oprit.',
  'gdrive.banner.readonly':
    'Nu mai puteți edita acest fișier în Google Drive, așa că salvarea s-a oprit. Modificările dvs. sunt încă aici.',
  'gdrive.banner.checkDrive': 'Verificați Drive',
  'gdrive.banner.reloadFromDrive': 'Reîncărcați din Drive',
  'gdrive.banner.leaderNotResponding':
    'Fila care salvează acest fișier nu răspunde.',
  'gdrive.banner.openerNotResponding':
    'Fila care a deschis acest fișier nu răspunde.',
  'gdrive.banner.takeOver': 'Preluați salvarea',
  'gdrive.banner.openAndTakeOver': 'Deschideți din Drive și preluați',
  'gdrive.banner.popupBlocked':
    'Browserul a blocat fereastra Google. Permiteți ferestrele pop-up pentru acest site, apoi reconectați-vă.',
  'gdrive.banner.reconnectFailed': 'Google nu s-a reconectat. Reîncercați.',
  'gdrive.banner.sessionEnded':
    'Sesiunea Google s-a încheiat, așa că salvarea este întreruptă.',
  'gdrive.banner.sessionEndsSoon': 'Sesiunea Google se încheie în curând.',
  'gdrive.banner.reconnect': 'Reconectați Google',

  'gdrive.leave.title': 'Cele mai recente modificări nu sunt salvate',
  'gdrive.leave.description':
    'ERD Editor nu le-a putut salva în Google Drive. Descărcați-le pentru a păstra o copie sau plecați și pierdeți-le.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor nu le-a putut salva în Google Drive. Descărcați-le pentru a păstra o copie sau deconectați-vă și pierdeți-le.',
  'gdrive.leave.stay': 'Rămâneți',
  'gdrive.leave.leaveAnyway': 'Plecați oricum',
  'gdrive.leave.signOutAnyway': 'Deconectați-vă oricum',

  'gdrive.create.title': 'Fișier nou în Google Drive',
  'gdrive.create.inAppFolder': 'În dosarul ERD Editor',
  'gdrive.create.inFolderPending': 'Într-un dosar…',
  'gdrive.create.inHiddenFolder':
    'Într-un dosar pe care ERD Editor nu îl poate vedea',
  'gdrive.create.inFolder': 'În dosarul „{name}”',
  'gdrive.create.untitled': 'Fără titlu',
  'gdrive.create.savedAs': 'Va fi salvat ca {name}',
  'gdrive.create.folderRefused':
    'ERD Editor nu poate crea fișiere în acest dosar. Îl creați în dosarul ERD Editor?',
  'gdrive.create.failed': 'Fișierul nu a putut fi creat. Reîncercați.',
  'gdrive.create.createInAppFolder': 'Creați în dosarul ERD Editor',
  'gdrive.create.create': 'Creați',

  'gdrive.import.imported': {
    one: 'S-a importat {count} fișier în Google Drive',
    few: 'S-au importat {count} fișiere în Google Drive',
    other: 'S-au importat {count} de fișiere în Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: 'S-a omis {count} copie de rezervă: copiile de rezervă rămân în aplicația locală',
    few: 'S-au omis {count} copii de rezervă: copiile de rezervă rămân în aplicația locală',
    other:
      'S-au omis {count} de copii de rezervă: copiile de rezervă rămân în aplicația locală',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} încărcare nu a reușit',
    few: '{count} încărcări nu au reușit',
    other: '{count} de încărcări nu au reușit',
  },

  'gdrive.notice.unreadableState':
    'Google Drive a trimis un link pe care ERD Editor nu l-a putut citi',
  'gdrive.notice.renameFailed': 'Fișierul nu a putut fi redenumit',
  'gdrive.notice.createFailed': 'Fișierul nu a putut fi creat',
  'gdrive.notice.checkFailed':
    'Google Drive nu a putut fi accesat. Reîncercați.',
  'gdrive.notice.reloadFailed':
    'Nu s-a putut reîncărca din Google Drive. Reîncercați.',
  'gdrive.notice.reloadTrashed':
    'Nu se poate reîncărca: fișierul este în coșul de gunoi din Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Nu se poate reîncărca: fișierul din Google Drive depășește {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Nu se poate reîncărca: fișierul din Google Drive nu mai este un document ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'V-ați deconectat aici. Serverul ERD Editor nu a confirmat, așa că acest browser finalizează deconectarea data viitoare când se conectează',
  'gdrive.notice.signOutNotRevoked':
    'V-ați deconectat aici, dar Google nu a confirmat că a eliminat accesul ERD Editor, așa că celelalte dispozitive pot rămâne conectate până îl eliminați la myaccount.google.com/permissions',
} satisfies Messages;
