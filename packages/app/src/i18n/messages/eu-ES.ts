import type { Messages } from '@/i18n/translate';

/** The app's own text in Basque, key for key as English writes it. */
export const euES = {
  'common.cancel': 'Utzi',
  'common.close': 'Itxi',
  'common.dismiss': 'Itxi',
  'common.tryAgain': 'Saiatu berriro',
  'common.reload': 'Kargatu berriro',
  'common.loading': 'Kargatzen…',
  'common.search': 'Bilaketa',
  'common.rename': 'Aldatu izena',
  'common.importFiles': 'Inportatu fitxategiak',
  'common.signOut': 'Amaitu saioa',
  'common.downloadMyChanges': 'Deskargatu nire aldaketak',
  'common.edited': 'Editatua: {time}',
  'common.system': 'Sistema',
  'common.displayLanguage': 'Bistaratze-hizkuntza',
  'common.theme': 'Gaia',
  'common.light': 'Argia',
  'common.dark': 'Iluna',
  'common.host': 'Ostalaria',
  'common.guest': 'Gonbidatua',
  'common.you': '(zu)',
  'common.participants': 'Parte-hartzaileak',
  'common.yourNickname': 'Zure ezizena',
  'common.privacy': 'Pribatutasuna',
  'common.terms': 'Baldintzak',
  'common.editingGuide': 'Edizio-gida',
  'common.openSidebar': 'Ireki alboko barra',
  'common.closeSidebar': 'Itxi alboko barra',

  'time.justNow': 'oraintxe',
  'time.today': 'Gaur',
  'time.yesterday': 'Atzo',
  'time.previous7Days': 'Azken 7 egunak',
  'time.previous30Days': 'Azken 30 egunak',

  'sidebar.schemas': 'Eskemak',
  'sidebar.newSchema': 'Eskema berria',
  'sidebar.importAndExport': 'Inportatu eta esportatu',
  'sidebar.exportBackup': 'Esportatu babeskopia',
  'sidebar.searchSchemas': 'Bilatu eskemak',
  'sidebar.newSchemaName': 'Eskema berriaren izena',
  'sidebar.schemaName': 'Eskemaren izena',
  'sidebar.schemaNamePlaceholder': 'eskemaren izena',
  'sidebar.duplicate': 'Bikoiztu',
  'sidebar.moveToTrash': 'Bota zakarrontzira',
  'sidebar.actionsFor': 'Ekintzak: {name}',
  'sidebar.noResults': 'Emaitzarik ez',

  'trash.button': 'Zakarrontzia ({count})',
  'trash.title': 'Zakarrontzia',
  'trash.description': {
    one: 'Zakarrontziko eskemak betiko ezabatzen dira {count} egun igarotakoan.',
    other:
      'Zakarrontziko eskemak betiko ezabatzen dira {count} egun igarotakoan.',
  },
  'trash.listLabel': 'Zakarrontziko eskemak',
  'trash.deleted': 'Ezabatua: {time}',
  'trash.deletesToday': 'gaur ezabatuko da',
  'trash.deletesTomorrow': 'bihar ezabatuko da',
  'trash.deletesIn': {
    one: '{count} egun barru ezabatuko da',
    other: '{count} egun barru ezabatuko da',
  },
  'trash.restore': 'Leheneratu',
  'trash.deletePermanently': 'Ezabatu betiko',
  'trash.cannotBeUndone': 'Ezin da desegin.',
  'trash.delete': 'Ezabatu',
  'trash.empty': 'Zakarrontzia hutsik dago.',
  'trash.emptyTrash': 'Hustu zakarrontzia',
  'trash.emptyConfirm': {
    one: 'Eskema {count} betiko ezabatu? Ezin da desegin.',
    other: '{count} eskema betiko ezabatu? Ezin da desegin.',
  },

  'collaboration.for': '{name} eskemaren lankidetza',
  'collaboration.guestsConnected': {
    one: 'Gonbidatu {count} konektatuta',
    other: '{count} gonbidatu konektatuta',
  },
  'collaboration.title': 'Lankidetzako edizioa',
  'collaboration.experiment': 'Esperimentala',
  'collaboration.description':
    'Parte-hartzaileak zuzenean konektatzen dira WebRTC bidez, eta muturretik muturrerako enkriptatzearekin trukatzen dituzte mezuak.',
  'collaboration.nickname': 'Ezizena',
  'collaboration.link': 'Esteka',
  'collaboration.noOneJoined': 'Oraindik ez da beste inor batu.',
  'collaboration.startSession': 'Hasi zuzeneko saioa',
  'collaboration.stopSession': 'Gelditu saioa',

  'viewer.noSchemaOpen': 'Ez dago eskemarik irekita',
  'viewer.emptyHint':
    'Aukeratu bat alboko barran, edo hasi berri bat hemen. Fitxategiak edonon jaregin ditzakezu inportatzeko.',
  'viewer.openSample': 'Ireki adibidea',
  'viewer.sampleName': 'liburu-denda adibidea',

  'drop.title': 'Jaregin inportatzeko',
  'drop.formats':
    'Babeskopiak, .erd, .vuerd eta .json dokumentuak, SQL, DBML, AML eta GraphQL',
  'drop.importing': 'Fitxategiak inportatzen…',
  'drop.importingHint': 'Jaregin gehiago inportazio hau amaitutakoan',

  'import.imported': {
    one: 'Eskema {count} inportatu da',
    other: '{count} eskema inportatu dira',
  },
  'import.skippedInvalidFiles': {
    one: 'Fitxategi baliogabe {count} saltatu da',
    other: '{count} fitxategi baliogabe saltatu dira',
  },
  'import.skippedInvalidSchemas': {
    one: 'Eskema baliogabe {count} saltatu da',
    other: '{count} eskema baliogabe saltatu dira',
  },
  'import.skippedOversized': {
    one: '{size} MB baino handiagoa den fitxategi {count} saltatu da',
    other: '{size} MB baino handiagoak diren {count} fitxategi saltatu dira',
  },
  'import.nothing': 'Ez dago ezer inportatzeko',
  'import.failed': 'Inportazioak huts egin du',
  'import.exportFailed': 'Esportazioak huts egin du',

  'update.available': 'ERD Editor-en bertsio berri bat dago.',
  'update.updatedElsewhere':
    'Aplikazioa beste fitxa batean eguneratu da; kargatu berriro amaitzeko.',

  'live.invalidToken': 'Partekatze-tokena baliogabea da.',
  'live.hostNotFound': 'Ez da ostalaria aurkitu.',
  'live.refresh': 'Freskatu',
  'live.hostStopped': 'Ostalariak saioa gelditu du.',
  'live.somethingWentWrong': 'Arazo bat izan da.',
  'live.lookingForHost': 'Ostalaria bilatzen...',
  'live.waitingForHost': 'Ostalariaren zain...',
  'live.session': 'Zuzeneko saioa',
  'live.inSession': {
    one: 'Saioan: {count}',
    other: 'Saioan: {count}',
  },
  'live.showParticipants': 'Erakutsi parte-hartzaileak',
  'live.hideParticipants': 'Ezkutatu parte-hartzaileak',

  'gdrive.checkingSignIn': 'Zure Google saioa egiaztatzen…',
  'gdrive.anotherAccount': 'beste kontu bat',
  'gdrive.offline.title': 'Lineaz kanpo zaude',
  'gdrive.offline.description':
    'ERD Editor-ek zure Google saioa egiaztatuko du berriro linean zaudenean.',
  'gdrive.scopeMissing.title': 'Ez da Google Drive-rako sarbiderik eman',
  'gdrive.scopeMissing.description':
    'ERD Editor-ek berarekin sortzen edo irekitzen dituzun fitxategietarako sarbidea behar du. Hasi saioa berriro eta baimendu Google Drive-rako sarbidea.',
  'gdrive.mismatch.title': 'Google Drive-k beste kontu baterako bidali du hau',
  'gdrive.mismatch.description':
    '{email} gisa hasi duzu saioa. Aldatu Google Drive-k irekitzeko erabili duen kontura, edo jarraitu kontu honen fitxategiekin.',
  'gdrive.mismatch.choose':
    'ERD Editor-ek ezin izan du kontu hori aurretik hautatu; beraz, aukeratu Google-k galdetzen dizunean.',
  'gdrive.mismatch.switchAccount': 'Aldatu kontua',
  'gdrive.mismatch.showMyFiles': 'Erakutsi nire fitxategiak',
  'gdrive.accountChanged.title': 'Beste kontu batekin hasi da saioa',
  'gdrive.accountChanged.description':
    'Beste fitxa batek beste Google kontu batekin hasi du saioa; beraz, fitxa hau gelditu egin da. Kargatu berriro kontu horrekin jarraitzeko.',
  'gdrive.unsaved.title': 'Zure aldaketak ez dira gorde',
  'gdrive.unsaved.description':
    '{name} fitxategiak Google Drive-n ez dauden {email} kontuaren aldaketak ditu, eta orain {account} dago saioan. Deskargatu itzazu jarraitu aurretik.',
  'gdrive.unsaved.descriptionUnnamed':
    'Irekita zenuen fitxategiak Google Drive-n ez dauden {email} kontuaren aldaketak ditu, eta orain {account} dago saioan. Deskargatu itzazu jarraitu aurretik.',
  'gdrive.unsaved.continueWithout': 'Jarraitu haiek gabe',
  'gdrive.framed.title':
    'Ireki ERD Editor-en Google Drive editorea bere fitxan',
  'gdrive.framed.description': 'Ez dabil beste orri baten barruan.',
  'gdrive.framed.link': 'Ireki fitxa berrian',
  'gdrive.notConfigured.title':
    'Google Drive integrazioa ez dago konfiguratuta',
  'gdrive.notConfigured.description':
    'ERD Editor-en konpilazio honek ez du Google saio-hasierako bezerorik.',
  'gdrive.unsupportedOrigin.title': 'Google Drive ez dago erabilgarri hemen',
  'gdrive.unsupportedOrigin.description':
    'Google saio-hasierak erd-editor.io-n bakarrik funtzionatzen du, eta hau aurrebista bat da.',

  'gdrive.signIn.title': 'Ireki Google Drive-ko zure ERD fitxategiak',
  'gdrive.signIn.description':
    'ERD Editor-ek berarekin sortzen edo irekitzen dituzun fitxategiak bakarrik irekitzen eta gordetzen ditu.',
  'gdrive.signIn.fallbackDescription':
    'ERD Editor-en saio-hasierako zerbitzaria lanpetuta dago; beraz, Google-k ordubeteko saioa hasten dizu aldi bakoitzean.',
  'gdrive.signIn.signIn': 'Hasi saioa Google-rekin',
  'gdrive.signIn.continue': 'Jarraitu Google-rekin',
  'gdrive.signIn.waitingTitle': 'Google saio-hasieraren zain…',
  'gdrive.signIn.waitingDescription':
    'Amaitu saio-hasiera Google-k ireki duen leihoan.',
  'gdrive.signIn.popupBlocked':
    'Arakatzaileak saio-hasierako leihoa blokeatu du. Baimendu gune honetako leiho gainerakorrak eta saiatu berriro.',
  'gdrive.signIn.failed': 'Google saio-hasiera ez da amaitu. Saiatu berriro.',
  'gdrive.signIn.gisBlocked':
    'Ezin izan da Google saio-hasiera kargatu. Egiaztatu ezerk ez duela accounts.google.com blokeatzen, eta kargatu berriro orria.',

  'gdrive.sidebar.label': 'Drive fitxategiak',
  'gdrive.sidebar.newFile': 'Fitxategi berria',
  'gdrive.sidebar.import': 'Inportatu',
  'gdrive.sidebar.searchFiles': 'Bilatu fitxategiak',
  'gdrive.sidebar.newFileName': 'Fitxategi berriaren izena',
  'gdrive.sidebar.fileName': 'Fitxategi-izena',
  'gdrive.sidebar.fileNamePlaceholder': 'fitxategi-izena',
  'gdrive.sidebar.loadingFiles': 'Fitxategiak kargatzen…',
  'gdrive.sidebar.loadFailed': 'Ezin izan dira zure fitxategiak kargatu.',

  'gdrive.viewer.noFileOpen': 'Ez dago fitxategirik irekita',
  'gdrive.viewer.noFileOpenHint':
    'Aukeratu fitxategi bat alboko barran, edo hasi berri bat.',
  'gdrive.viewer.noFilesYet': 'Oraindik ez dago fitxategirik',
  'gdrive.viewer.noFilesYetHint':
    'Sortu fitxategi bat edo inportatu bat. Google Drive-tik ERD Editor-ekin irekitzen dituzun fitxategiak ere hemen agertzen dira.',
  'gdrive.viewer.waitingForOpener': 'Fitxategi hau ireki duen fitxaren zain…',
  'gdrive.viewer.notDocument': 'Fitxategi hau ez da ERD Editor dokumentu bat',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor-ek berak gordetako diagramak irekitzen ditu. Fitxategi hau dagoen bezala uzten du, eta ez du inoiz gainidazten.',
  'gdrive.viewer.googleNativeHint':
    'Google Dokumentuak, Kalkulu-orriak eta karpetak Google Drive-n irekitzen dira.',
  'gdrive.viewer.trashed': 'Fitxategi hau zakarrontzian dago',
  'gdrive.viewer.trashedHint': 'Leheneratu Google Drive-n hemen irekitzeko.',
  'gdrive.viewer.tooLarge': 'Fitxategi hau handiegia da',
  'gdrive.viewer.tooLargeHint':
    'ERD Editor-ek {size} MB arteko fitxategiak irekitzen ditu.',
  'gdrive.viewer.notFound': 'Fitxategi hau ez dago erabilgarri',
  'gdrive.viewer.notFoundHint':
    'Agian ezabatu egin da, edo Google kontu honek ezin du ireki.',
  'gdrive.viewer.waitingToken': 'Google-ren zain',
  'gdrive.viewer.waitingTokenHint':
    'Fitxategi hau irekiko da zure Google saioa berreskuratzen denean.',
  'gdrive.viewer.failed': 'Ezin izan da fitxategi hau ireki',
  'gdrive.viewer.failedHint':
    'Google Drive-k ez du erantzun. Egiaztatu konexioa eta saiatu berriro.',
  'gdrive.viewer.savingBeforeLeave': 'Irten aurretik gordetzen…',

  'gdrive.status.saved': 'Google Drive-n gordeta',
  'gdrive.status.saving': 'Gordetzen…',
  'gdrive.status.failed': 'Ezin izan da gorde',
  'gdrive.status.conflict': 'Google Drive-n aldatua',
  'gdrive.status.unconfirmed': 'Ezin izan da azken gordetzea berretsi',
  'gdrive.status.paused': 'Pausatuta Google berriro konektatu arte',
  'gdrive.status.deleted': 'Google Drive-n ezabatua',
  'gdrive.status.readonly': 'Ikusteko soilik',
  'gdrive.status.waitingLeader': 'Fitxategi hau gordetzen duen fitxaren zain',
  'gdrive.status.waitingSnapshot': 'Fitxategi hau ireki duen fitxaren zain',
  'gdrive.status.scopeMissing': 'Ez dago Google Drive-rako sarbiderik',

  'gdrive.banner.conflict':
    'Fitxategi hau Google Drive-n aldatu da; beraz, gordetzea gelditu da. Zure aldaketak hemen daude oraindik.',
  'gdrive.banner.unconfirmed':
    'Ezin izan da azken gordetzea berretsi; beraz, gordetzea gelditu da. Zure aldaketak hemen daude oraindik.',
  'gdrive.banner.deleted':
    'Fitxategi hau Google Drive-n ezabatu edo zakarrontzira bota da; beraz, gordetzea gelditu da.',
  'gdrive.banner.readonly':
    'Jada ezin duzu fitxategi hau Google Drive-n editatu; beraz, gordetzea gelditu da. Zure aldaketak hemen daude oraindik.',
  'gdrive.banner.checkDrive': 'Egiaztatu Drive',
  'gdrive.banner.reloadFromDrive': 'Kargatu berriro Drive-tik',
  'gdrive.banner.leaderNotResponding':
    'Fitxategi hau gordetzen duen fitxak ez du erantzuten.',
  'gdrive.banner.openerNotResponding':
    'Fitxategi hau ireki duen fitxak ez du erantzuten.',
  'gdrive.banner.takeOver': 'Hartu gordetzearen ardura',
  'gdrive.banner.openAndTakeOver': 'Ireki Drive-tik eta hartu ardura',
  'gdrive.banner.popupBlocked':
    'Arakatzaileak Google-ren leihoa blokeatu du. Baimendu gune honetako leiho gainerakorrak eta konektatu berriro.',
  'gdrive.banner.reconnectFailed':
    'Google ez da berriro konektatu. Saiatu berriro.',
  'gdrive.banner.sessionEnded':
    'Zure Google saioa amaitu da; beraz, gordetzea pausatuta dago.',
  'gdrive.banner.sessionEndsSoon': 'Zure Google saioa laster amaituko da.',
  'gdrive.banner.reconnect': 'Konektatu berriro Google',

  'gdrive.leave.title': 'Zure azken aldaketak ez daude gordeta',
  'gdrive.leave.description':
    'ERD Editor-ek ezin izan ditu Google Drive-n gorde. Deskargatu kopia bat gordetzeko, edo irten eta galdu itzazu.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor-ek ezin izan ditu Google Drive-n gorde. Deskargatu kopia bat gordetzeko, edo amaitu saioa eta galdu itzazu.',
  'gdrive.leave.stay': 'Geratu',
  'gdrive.leave.leaveAnyway': 'Irten hala ere',
  'gdrive.leave.signOutAnyway': 'Amaitu saioa hala ere',

  'gdrive.create.title': 'Fitxategi berria Google Drive-n',
  'gdrive.create.inAppFolder': 'ERD Editor karpetan',
  'gdrive.create.inFolderPending': 'Karpeta batean…',
  'gdrive.create.inHiddenFolder':
    'ERD Editor-ek ikusi ezin duen karpeta batean',
  'gdrive.create.inFolder': '“{name}” karpetan',
  'gdrive.create.untitled': 'Izengabea',
  'gdrive.create.savedAs': 'Honela gordeko da: {name}',
  'gdrive.create.folderRefused':
    'ERD Editor-ek ezin du karpeta honetan fitxategirik sortu. ERD Editor karpetan sortu nahi duzu?',
  'gdrive.create.failed': 'Ezin izan da fitxategia sortu. Saiatu berriro.',
  'gdrive.create.createInAppFolder': 'Sortu ERD Editor karpetan',
  'gdrive.create.create': 'Sortu',

  'gdrive.import.imported': {
    one: 'Fitxategi {count} inportatu da Google Drive-ra',
    other: '{count} fitxategi inportatu dira Google Drive-ra',
  },
  'gdrive.import.skippedBackups': {
    one: 'Babeskopia {count} saltatu da: babeskopiak aplikazio lokalean geratzen dira',
    other:
      '{count} babeskopia saltatu dira: babeskopiak aplikazio lokalean geratzen dira',
  },
  'gdrive.import.uploadsFailed': {
    one: 'Igoera {count}ek huts egin du',
    other: '{count} igoerak huts egin dute',
  },

  'gdrive.notice.unreadableState':
    'Google Drive-k ERD Editor-ek irakurri ezin duen esteka bat bidali du',
  'gdrive.notice.renameFailed': 'Ezin izan zaio fitxategiari izena aldatu',
  'gdrive.notice.createFailed': 'Ezin izan da fitxategia sortu',
  'gdrive.notice.checkFailed':
    'Ezin izan da Google Drive-ra konektatu. Saiatu berriro.',
  'gdrive.notice.reloadFailed':
    'Ezin izan da Google Drive-tik berriro kargatu. Saiatu berriro.',
  'gdrive.notice.reloadTrashed':
    'Ezin da berriro kargatu: fitxategia Google Drive-ko zakarrontzian dago',
  'gdrive.notice.reloadTooLarge':
    'Ezin da berriro kargatu: Google Drive-ko fitxategiak {size} MB baino gehiago ditu',
  'gdrive.notice.reloadNotDocument':
    'Ezin da berriro kargatu: Google Drive-ko fitxategia jada ez da ERD Editor dokumentu bat',
  'gdrive.notice.signOutUnconfirmed':
    'Saioa amaitu da hemen. ERD Editor-en zerbitzariak ez du berretsi; beraz, arakatzaile honek hurrengo konexioan amaituko du saioa',
  'gdrive.notice.signOutNotRevoked':
    'Saioa amaitu da hemen, baina Google-k ez du berretsi ERD Editor-en sarbidea kendu duenik; beraz, zure beste gailuek saioa irekita izan dezakete myaccount.google.com/permissions helbidean kendu arte',
} satisfies Messages;
