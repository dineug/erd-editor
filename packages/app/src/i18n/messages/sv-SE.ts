import type { Messages } from '@/i18n/translate';

/** The app's own text in Swedish, key for key as English writes it. */
export const svSE = {
  'common.cancel': 'Avbryt',
  'common.close': 'Stäng',
  'common.dismiss': 'Stäng',
  'common.tryAgain': 'Försök igen',
  'common.reload': 'Läs in igen',
  'common.loading': 'Läser in…',
  'common.search': 'Sök',
  'common.rename': 'Byt namn',
  'common.importFiles': 'Importera filer',
  'common.signOut': 'Logga ut',
  'common.downloadMyChanges': 'Ladda ned mina ändringar',
  'common.edited': 'Redigerad {time}',
  'common.system': 'System',
  'common.displayLanguage': 'Visningsspråk',
  'common.theme': 'Tema',
  'common.light': 'Ljust',
  'common.dark': 'Mörkt',
  'common.host': 'Värd',
  'common.guest': 'Gäst',
  'common.you': '(du)',
  'common.participants': 'Deltagare',
  'common.yourNickname': 'Ditt smeknamn',
  'common.privacy': 'Integritet',
  'common.terms': 'Villkor',
  'common.editingGuide': 'Redigeringsguide',
  'common.openSidebar': 'Öppna sidofältet',
  'common.closeSidebar': 'Stäng sidofältet',

  'time.justNow': 'nyss',
  'time.today': 'Idag',
  'time.yesterday': 'Igår',
  'time.previous7Days': 'Senaste 7 dagarna',
  'time.previous30Days': 'Senaste 30 dagarna',

  'sidebar.schemas': 'Scheman',
  'sidebar.newSchema': 'Nytt schema',
  'sidebar.importAndExport': 'Importera och exportera',
  'sidebar.exportBackup': 'Exportera säkerhetskopia',
  'sidebar.searchSchemas': 'Sök scheman',
  'sidebar.newSchemaName': 'Namn på nytt schema',
  'sidebar.schemaName': 'Schemanamn',
  'sidebar.schemaNamePlaceholder': 'schemanamn',
  'sidebar.duplicate': 'Duplicera',
  'sidebar.moveToTrash': 'Flytta till papperskorgen',
  'sidebar.actionsFor': 'Åtgärder för {name}',
  'sidebar.noResults': 'Inga resultat',

  'trash.button': 'Papperskorgen ({count})',
  'trash.title': 'Papperskorgen',
  'trash.description': {
    one: 'Scheman i papperskorgen raderas permanent efter {count} dag.',
    other: 'Scheman i papperskorgen raderas permanent efter {count} dagar.',
  },
  'trash.listLabel': 'Scheman i papperskorgen',
  'trash.deleted': 'Raderad {time}',
  'trash.deletesToday': 'raderas idag',
  'trash.deletesTomorrow': 'raderas imorgon',
  'trash.deletesIn': {
    one: 'raderas om {count} dag',
    other: 'raderas om {count} dagar',
  },
  'trash.restore': 'Återställ',
  'trash.deletePermanently': 'Radera permanent',
  'trash.cannotBeUndone': 'Det går inte att ångra.',
  'trash.delete': 'Radera',
  'trash.empty': 'Papperskorgen är tom.',
  'trash.emptyTrash': 'Töm papperskorgen',
  'trash.emptyConfirm': {
    one: 'Radera {count} schema permanent? Det går inte att ångra.',
    other: 'Radera {count} scheman permanent? Det går inte att ångra.',
  },

  'collaboration.for': 'Samarbete för {name}',
  'collaboration.guestsConnected': {
    one: '{count} gäst ansluten',
    other: '{count} gäster anslutna',
  },
  'collaboration.title': 'Samarbetsredigering',
  'collaboration.experiment': 'Experiment',
  'collaboration.description':
    'Deltagarna ansluter direkt via WebRTC och utbyter meddelanden med totalsträckskryptering.',
  'collaboration.nickname': 'Smeknamn',
  'collaboration.link': 'Länk',
  'collaboration.noOneJoined': 'Ingen annan har anslutit än.',
  'collaboration.startSession': 'Starta session',
  'collaboration.stopSession': 'Avsluta session',

  'viewer.noSchemaOpen': 'Inget schema öppet',
  'viewer.emptyHint':
    'Välj ett i sidofältet eller skapa ett här. Du kan också dra och släppa filer var som helst för att importera dem.',
  'viewer.openSample': 'Öppna exempel',
  'viewer.sampleName': 'bokhandelsexempel',

  'drop.title': 'Släpp för att importera',
  'drop.formats':
    'Säkerhetskopior, .erd-, .vuerd- och .json-dokument, SQL, DBML, AML och GraphQL',
  'drop.importing': 'Importerar filer…',
  'drop.importingHint': 'Släpp fler när den här importen är klar',

  'import.imported': {
    one: '{count} schema importerat',
    other: '{count} scheman importerade',
  },
  'import.skippedInvalidFiles': {
    one: '{count} ogiltig fil hoppades över',
    other: '{count} ogiltiga filer hoppades över',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} ogiltigt schema hoppades över',
    other: '{count} ogiltiga scheman hoppades över',
  },
  'import.skippedOversized': {
    one: '{count} fil över {size} MB hoppades över',
    other: '{count} filer över {size} MB hoppades över',
  },
  'import.nothing': 'Inget att importera',
  'import.failed': 'Importen misslyckades',
  'import.exportFailed': 'Exporten misslyckades',

  'update.available': 'En ny version av ERD Editor finns tillgänglig.',
  'update.updatedElsewhere':
    'Appen uppdaterades i en annan flik – läs in igen för att slutföra.',

  'live.invalidToken': 'Ogiltig delningslänk.',
  'live.hostNotFound': 'Värden hittades inte.',
  'live.refresh': 'Uppdatera',
  'live.hostStopped': 'Värden avslutade sessionen.',
  'live.somethingWentWrong': 'Något gick fel.',
  'live.lookingForHost': 'Letar efter en värd...',
  'live.waitingForHost': 'Väntar på en värd...',
  'live.session': 'Livesession',
  'live.inSession': {
    one: '{count} i sessionen',
    other: '{count} i sessionen',
  },
  'live.showParticipants': 'Visa deltagare',
  'live.hideParticipants': 'Dölj deltagare',

  'gdrive.checkingSignIn': 'Kontrollerar din Google-inloggning…',
  'gdrive.anotherAccount': 'ett annat konto',
  'gdrive.offline.title': 'Du är offline',
  'gdrive.offline.description':
    'ERD Editor kontrollerar din Google-inloggning när du är online igen.',
  'gdrive.scopeMissing.title': 'Åtkomst till Google Drive beviljades inte',
  'gdrive.scopeMissing.description':
    'ERD Editor behöver åtkomst till filerna du skapar eller öppnar med den. Logga in igen och tillåt åtkomst till Google Drive.',
  'gdrive.mismatch.title': 'Google Drive skickade det här för ett annat konto',
  'gdrive.mismatch.description':
    'Du är inloggad som {email}. Byt till kontot som Google Drive använde för att öppna det, eller fortsätt med det här kontots filer.',
  'gdrive.mismatch.choose':
    'ERD Editor kunde inte förvälja det kontot, så välj det när Google frågar.',
  'gdrive.mismatch.switchAccount': 'Byt konto',
  'gdrive.mismatch.showMyFiles': 'Visa mina filer',
  'gdrive.accountChanged.title': 'Inloggad med ett annat konto',
  'gdrive.accountChanged.description':
    'En annan flik loggade in på ett annat Google-konto, så den här fliken stoppades. Läs in den igen för att fortsätta med det kontot.',
  'gdrive.unsaved.title': 'Dina ändringar sparades inte',
  'gdrive.unsaved.description':
    '{name} har ändringar från {email} som inte finns i Google Drive, och nu är du inloggad som {account}. Ladda ned dem innan du fortsätter.',
  'gdrive.unsaved.descriptionUnnamed':
    'Filen du hade öppen har ändringar från {email} som inte finns i Google Drive, och nu är du inloggad som {account}. Ladda ned dem innan du fortsätter.',
  'gdrive.unsaved.continueWithout': 'Fortsätt utan dem',
  'gdrive.framed.title':
    'Öppna ERD Editors Google Drive-redigerare i en egen flik',
  'gdrive.framed.description': 'Den körs inte inuti en annan sida.',
  'gdrive.framed.link': 'Öppna i ny flik',
  'gdrive.notConfigured.title':
    'Google Drive-integrationen är inte konfigurerad',
  'gdrive.notConfigured.description':
    'Den här versionen av ERD Editor har ingen Google-inloggningsklient.',
  'gdrive.unsupportedOrigin.title': 'Google Drive är inte tillgängligt här',
  'gdrive.unsupportedOrigin.description':
    'Google-inloggning fungerar bara på erd-editor.io, och det här är en förhandsversion.',

  'gdrive.signIn.title': 'Öppna dina ERD-filer från Google Drive',
  'gdrive.signIn.description':
    'ERD Editor öppnar och sparar bara filerna du skapar eller öppnar med den.',
  'gdrive.signIn.fallbackDescription':
    'ERD Editors inloggningsserver är upptagen, så Google loggar in dig en timme i taget.',
  'gdrive.signIn.signIn': 'Logga in med Google',
  'gdrive.signIn.continue': 'Fortsätt med Google',
  'gdrive.signIn.waitingTitle': 'Väntar på Google-inloggning…',
  'gdrive.signIn.waitingDescription':
    'Slutför inloggningen i fönstret som Google öppnade.',
  'gdrive.signIn.popupBlocked':
    'Webbläsaren blockerade inloggningsfönstret. Tillåt popup-fönster för den här webbplatsen och försök igen.',
  'gdrive.signIn.failed': 'Google-inloggningen slutfördes inte. Försök igen.',
  'gdrive.signIn.gisBlocked':
    'Google-inloggningen kunde inte läsas in. Kontrollera att inget blockerar accounts.google.com och läs sedan in sidan igen.',

  'gdrive.sidebar.label': 'Drive-filer',
  'gdrive.sidebar.newFile': 'Ny fil',
  'gdrive.sidebar.import': 'Importera',
  'gdrive.sidebar.searchFiles': 'Sök filer',
  'gdrive.sidebar.newFileName': 'Namn på ny fil',
  'gdrive.sidebar.fileName': 'Filnamn',
  'gdrive.sidebar.fileNamePlaceholder': 'filnamn',
  'gdrive.sidebar.loadingFiles': 'Läser in filer…',
  'gdrive.sidebar.loadFailed': 'Det gick inte att läsa in dina filer.',

  'gdrive.viewer.noFileOpen': 'Ingen fil öppen',
  'gdrive.viewer.noFileOpenHint': 'Välj en fil i sidofältet eller skapa en ny.',
  'gdrive.viewer.noFilesYet': 'Inga filer än',
  'gdrive.viewer.noFilesYetHint':
    'Skapa en fil eller importera en. Filer som du öppnar med ERD Editor från Google Drive visas också här.',
  'gdrive.viewer.waitingForOpener':
    'Väntar på fliken som öppnade den här filen…',
  'gdrive.viewer.notDocument': 'Den här filen är inget ERD Editor-dokument',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor öppnar diagram som den själv har sparat. Den lämnar den här filen som den är och skriver aldrig över den.',
  'gdrive.viewer.googleNativeHint':
    'Google Dokument, Kalkylark och mappar öppnas i Google Drive.',
  'gdrive.viewer.trashed': 'Den här filen ligger i papperskorgen',
  'gdrive.viewer.trashedHint':
    'Återställ den i Google Drive för att öppna den i ERD Editor.',
  'gdrive.viewer.tooLarge': 'Den här filen är för stor',
  'gdrive.viewer.tooLargeHint': 'ERD Editor öppnar filer upp till {size} MB.',
  'gdrive.viewer.notFound': 'Den här filen är inte tillgänglig',
  'gdrive.viewer.notFoundHint':
    'Den kan ha raderats, eller så kan det här Google-kontot inte öppna den.',
  'gdrive.viewer.waitingToken': 'Väntar på Google',
  'gdrive.viewer.waitingTokenHint':
    'Filen öppnas när din Google-session är tillbaka.',
  'gdrive.viewer.failed': 'Det gick inte att öppna den här filen',
  'gdrive.viewer.failedHint':
    'Google Drive svarade inte. Kontrollera anslutningen och försök igen.',
  'gdrive.viewer.savingBeforeLeave': 'Sparar innan du lämnar…',

  'gdrive.status.saved': 'Sparad i Google Drive',
  'gdrive.status.saving': 'Sparar…',
  'gdrive.status.failed': 'Det gick inte att spara',
  'gdrive.status.conflict': 'Ändrad i Google Drive',
  'gdrive.status.unconfirmed':
    'Det gick inte att bekräfta den senaste sparningen',
  'gdrive.status.paused': 'Pausad tills Google ansluter igen',
  'gdrive.status.deleted': 'Raderad i Google Drive',
  'gdrive.status.readonly': 'Endast visning',
  'gdrive.status.waitingLeader': 'Väntar på fliken som sparar den här filen',
  'gdrive.status.waitingSnapshot': 'Väntar på fliken som öppnade den här filen',
  'gdrive.status.scopeMissing': 'Ingen åtkomst till Google Drive',

  'gdrive.banner.conflict':
    'Den här filen ändrades i Google Drive, så sparandet stoppades. Dina ändringar finns kvar här.',
  'gdrive.banner.unconfirmed':
    'Den senaste sparningen kunde inte bekräftas, så sparandet stoppades. Dina ändringar finns kvar här.',
  'gdrive.banner.deleted':
    'Den här filen raderades eller flyttades till papperskorgen i Google Drive, så sparandet stoppades.',
  'gdrive.banner.readonly':
    'Du kan inte längre redigera den här filen i Google Drive, så sparandet stoppades. Dina ändringar finns kvar här.',
  'gdrive.banner.checkDrive': 'Kontrollera Drive',
  'gdrive.banner.reloadFromDrive': 'Läs in igen från Drive',
  'gdrive.banner.leaderNotResponding':
    'Fliken som sparar den här filen svarar inte.',
  'gdrive.banner.openerNotResponding':
    'Fliken som öppnade den här filen svarar inte.',
  'gdrive.banner.takeOver': 'Ta över sparandet',
  'gdrive.banner.openAndTakeOver': 'Öppna från Drive och ta över',
  'gdrive.banner.popupBlocked':
    'Webbläsaren blockerade Google-fönstret. Tillåt popup-fönster för den här webbplatsen och anslut sedan igen.',
  'gdrive.banner.reconnectFailed':
    'Det gick inte att ansluta till Google igen. Försök igen.',
  'gdrive.banner.sessionEnded':
    'Din Google-session har upphört, så sparandet är pausat.',
  'gdrive.banner.sessionEndsSoon': 'Din Google-session upphör snart.',
  'gdrive.banner.reconnect': 'Anslut Google igen',

  'gdrive.leave.title': 'Dina senaste ändringar har inte sparats',
  'gdrive.leave.description':
    'ERD Editor kunde inte spara dem i Google Drive. Ladda ned dem för att behålla en kopia, eller lämna och förlora dem.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor kunde inte spara dem i Google Drive. Ladda ned dem för att behålla en kopia, eller logga ut och förlora dem.',
  'gdrive.leave.stay': 'Stanna',
  'gdrive.leave.leaveAnyway': 'Lämna ändå',
  'gdrive.leave.signOutAnyway': 'Logga ut ändå',

  'gdrive.create.title': 'Ny fil i Google Drive',
  'gdrive.create.inAppFolder': 'I mappen ERD Editor',
  'gdrive.create.inFolderPending': 'I en mapp…',
  'gdrive.create.inHiddenFolder': 'I en mapp som ERD Editor inte kan se',
  'gdrive.create.inFolder': 'I mappen ”{name}”',
  'gdrive.create.untitled': 'Namnlös',
  'gdrive.create.savedAs': 'Sparas som {name}',
  'gdrive.create.folderRefused':
    'ERD Editor kan inte skapa filer i den här mappen. Skapa den i mappen ERD Editor i stället?',
  'gdrive.create.failed': 'Det gick inte att skapa filen. Försök igen.',
  'gdrive.create.createInAppFolder': 'Skapa i mappen ERD Editor',
  'gdrive.create.create': 'Skapa',

  'gdrive.import.imported': {
    one: '{count} fil importerad till Google Drive',
    other: '{count} filer importerade till Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} säkerhetskopia hoppades över: säkerhetskopior stannar i den lokala appen',
    other:
      '{count} säkerhetskopior hoppades över: säkerhetskopior stannar i den lokala appen',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} uppladdning misslyckades',
    other: '{count} uppladdningar misslyckades',
  },

  'gdrive.notice.unreadableState':
    'Google Drive skickade en länk som ERD Editor inte kunde läsa',
  'gdrive.notice.renameFailed': 'Det gick inte att byta namn på filen',
  'gdrive.notice.createFailed': 'Det gick inte att skapa filen',
  'gdrive.notice.checkFailed':
    'Det gick inte att nå Google Drive. Försök igen.',
  'gdrive.notice.reloadFailed':
    'Det gick inte att läsa in igen från Google Drive. Försök igen.',
  'gdrive.notice.reloadTrashed':
    'Kunde inte läsa in igen: filen ligger i papperskorgen i Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Kunde inte läsa in igen: filen i Google Drive är större än {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Kunde inte läsa in igen: filen i Google Drive är inte längre ett ERD Editor-dokument',
  'gdrive.notice.signOutUnconfirmed':
    'Utloggad här. ERD Editors server bekräftade det inte, så den här webbläsaren slutför utloggningen nästa gång den ansluter',
  'gdrive.notice.signOutNotRevoked':
    'Utloggad här, men Google bekräftade inte att ERD Editors åtkomst togs bort, så dina andra enheter kan förbli inloggade tills du tar bort den på myaccount.google.com/permissions',
} satisfies Messages;
