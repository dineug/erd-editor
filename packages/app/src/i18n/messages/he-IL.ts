import type { Messages } from '@/i18n/translate';

/** The app's own text in Hebrew, key for key as English writes it. */
export const heIL = {
  'common.cancel': 'ביטול',
  'common.close': 'סגירה',
  'common.dismiss': 'סגירה',
  'common.tryAgain': 'ניסיון חוזר',
  'common.reload': 'טעינה מחדש',
  'common.loading': 'בטעינה…',
  'common.search': 'חיפוש',
  'common.rename': 'שינוי שם',
  'common.importFiles': 'ייבוא קבצים',
  'common.signOut': 'התנתקות',
  'common.downloadMyChanges': 'הורדת השינויים שלי',
  'common.edited': 'נערך {time}',
  'common.system': 'מערכת',
  'common.displayLanguage': 'שפת תצוגה',
  'common.theme': 'ערכת נושא',
  'common.light': 'בהיר',
  'common.dark': 'כהה',
  'common.host': 'מארח',
  'common.guest': 'אורח',
  'common.you': '(את/ה)',
  'common.participants': 'משתתפים',
  'common.yourNickname': 'הכינוי שלך',
  'common.privacy': 'פרטיות',
  'common.terms': 'תנאים',
  'common.editingGuide': 'מדריך עריכה',
  'common.openSidebar': 'פתיחת סרגל הצד',
  'common.closeSidebar': 'סגירת סרגל הצד',

  'time.justNow': 'זה עתה',
  'time.today': 'היום',
  'time.yesterday': 'אתמול',
  'time.previous7Days': '7 הימים האחרונים',
  'time.previous30Days': '30 הימים האחרונים',

  'sidebar.schemas': 'סכימות',
  'sidebar.newSchema': 'סכימה חדשה',
  'sidebar.importAndExport': 'ייבוא וייצוא',
  'sidebar.exportBackup': 'ייצוא גיבוי',
  'sidebar.searchSchemas': 'חיפוש סכימות',
  'sidebar.newSchemaName': 'שם הסכימה החדשה',
  'sidebar.schemaName': 'שם הסכימה',
  'sidebar.schemaNamePlaceholder': 'שם הסכימה',
  'sidebar.duplicate': 'שכפול',
  'sidebar.moveToTrash': 'העברה לאשפה',
  'sidebar.actionsFor': 'פעולות עבור {name}',
  'sidebar.noResults': 'אין תוצאות',

  'trash.button': 'אשפה ({count})',
  'trash.title': 'אשפה',
  'trash.description': {
    one: 'סכימות באשפה נמחקות לצמיתות אחרי יום {count}.',
    two: 'סכימות באשפה נמחקות לצמיתות אחרי {count} ימים.',
    other: 'סכימות באשפה נמחקות לצמיתות אחרי {count} ימים.',
  },
  'trash.listLabel': 'סכימות באשפה',
  'trash.deleted': 'נמחק {time}',
  'trash.deletesToday': 'יימחק היום',
  'trash.deletesTomorrow': 'יימחק מחר',
  'trash.deletesIn': {
    one: 'יימחק בעוד יום {count}',
    two: 'יימחק בעוד {count} ימים',
    other: 'יימחק בעוד {count} ימים',
  },
  'trash.restore': 'שחזור',
  'trash.deletePermanently': 'מחיקה לצמיתות',
  'trash.cannotBeUndone': 'אי אפשר לבטל את הפעולה.',
  'trash.delete': 'מחיקה',
  'trash.empty': 'האשפה ריקה.',
  'trash.emptyTrash': 'ריקון האשפה',
  'trash.emptyConfirm': {
    one: 'למחוק לצמיתות סכימה {count}? אי אפשר לבטל את הפעולה.',
    two: 'למחוק לצמיתות {count} סכימות? אי אפשר לבטל את הפעולה.',
    other: 'למחוק לצמיתות {count} סכימות? אי אפשר לבטל את הפעולה.',
  },

  'collaboration.for': 'שיתוף פעולה ב-{name}',
  'collaboration.guestsConnected': {
    one: 'אורח {count} מחובר',
    two: '{count} אורחים מחוברים',
    other: '{count} אורחים מחוברים',
  },
  'collaboration.title': 'עריכה משותפת',
  'collaboration.experiment': 'ניסיוני',
  'collaboration.description':
    'המשתתפים מתחברים ישירות דרך WebRTC ומחליפים הודעות בהצפנה מקצה לקצה.',
  'collaboration.nickname': 'כינוי',
  'collaboration.link': 'קישור',
  'collaboration.noOneJoined': 'אף אחד אחר עוד לא הצטרף.',
  'collaboration.startSession': 'התחלת סשן',
  'collaboration.stopSession': 'עצירת הסשן',

  'viewer.noSchemaOpen': 'אין סכימה פתוחה',
  'viewer.emptyHint':
    'אפשר לבחור סכימה בסרגל הצד או להתחיל חדשה כאן. אפשר גם לשחרר קבצים בכל מקום כדי לייבא אותם.',
  'viewer.openSample': 'פתיחת דוגמה',
  'viewer.sampleName': 'דוגמת חנות ספרים',

  'drop.title': 'שחררו כדי לייבא',
  'drop.formats':
    'גיבויים, SQL, DBML, AML, GraphQL ומסמכי ERD: .erd, .vuerd, .json',
  'drop.importing': 'מייבא קבצים…',
  'drop.importingHint': 'אפשר לשחרר עוד אחרי שהייבוא הזה יסתיים',

  'import.imported': {
    one: 'יובאה סכימה {count}',
    two: 'יובאו {count} סכימות',
    other: 'יובאו {count} סכימות',
  },
  'import.skippedInvalidFiles': {
    one: 'דולג על קובץ לא תקין {count}',
    two: 'דולג על {count} קבצים לא תקינים',
    other: 'דולג על {count} קבצים לא תקינים',
  },
  'import.skippedInvalidSchemas': {
    one: 'דולג על סכימה לא תקינה {count}',
    two: 'דולג על {count} סכימות לא תקינות',
    other: 'דולג על {count} סכימות לא תקינות',
  },
  'import.skippedOversized': {
    one: 'דולג על קובץ {count} שגדול מ-{size} MB',
    two: 'דולג על {count} קבצים שגדולים מ-{size} MB',
    other: 'דולג על {count} קבצים שגדולים מ-{size} MB',
  },
  'import.nothing': 'אין מה לייבא',
  'import.failed': 'הייבוא נכשל',
  'import.exportFailed': 'הייצוא נכשל',

  'update.available': 'גרסה חדשה של ERD Editor זמינה.',
  'update.updatedElsewhere':
    'האפליקציה עודכנה בכרטיסייה אחרת — יש לטעון מחדש כדי לסיים.',

  'live.invalidToken': 'קישור השיתוף לא תקין.',
  'live.hostNotFound': 'המארח לא נמצא.',
  'live.refresh': 'רענון',
  'live.hostStopped': 'המארח עצר את הסשן.',
  'live.somethingWentWrong': 'משהו השתבש.',
  'live.lookingForHost': 'מחפש מארח...',
  'live.waitingForHost': 'ממתין למארח...',
  'live.session': 'סשן חי',
  'live.inSession': {
    one: '{count} בסשן',
    two: '{count} בסשן',
    other: '{count} בסשן',
  },
  'live.showParticipants': 'הצגת המשתתפים',
  'live.hideParticipants': 'הסתרת המשתתפים',

  'gdrive.checkingSignIn': 'בודק את הכניסה שלך ל-Google…',
  'gdrive.anotherAccount': 'חשבון אחר',
  'gdrive.offline.title': 'אין חיבור לאינטרנט',
  'gdrive.offline.description':
    'ERD Editor יבדוק את הכניסה שלך ל-Google כשהחיבור יחזור.',
  'gdrive.scopeMissing.title': 'לא ניתנה גישה ל-Google Drive',
  'gdrive.scopeMissing.description':
    'ERD Editor צריך גישה לקבצים שיוצרים או פותחים בו. יש להיכנס שוב ולאשר גישה ל-Google Drive.',
  'gdrive.mismatch.title': 'Google Drive שלח את זה עבור חשבון אחר',
  'gdrive.mismatch.description':
    'נכנסת בתור {email}. אפשר לעבור לחשבון ש-Google Drive פתח בו את הקובץ, או להמשיך עם הקבצים של החשבון הזה.',
  'gdrive.mismatch.choose':
    'ERD Editor לא הצליח לבחור מראש את החשבון הזה, לכן יש לבחור בו כש-Google ישאל.',
  'gdrive.mismatch.switchAccount': 'החלפת חשבון',
  'gdrive.mismatch.showMyFiles': 'הצגת הקבצים שלי',
  'gdrive.accountChanged.title': 'נכנסת עם חשבון אחר',
  'gdrive.accountChanged.description':
    'כרטיסייה אחרת נכנסה לחשבון Google אחר, ולכן הכרטיסייה הזו נעצרה. יש לטעון אותה מחדש כדי להמשיך עם החשבון הזה.',
  'gdrive.unsaved.title': 'השינויים שלך לא נשמרו',
  'gdrive.unsaved.description':
    'ב-{name} יש שינויים של {email} שאינם ב-Google Drive, וכעת מחובר {account}. יש להוריד אותם לפני שממשיכים.',
  'gdrive.unsaved.descriptionUnnamed':
    'בקובץ שהיה פתוח יש שינויים של {email} שאינם ב-Google Drive, וכעת מחובר {account}. יש להוריד אותם לפני שממשיכים.',
  'gdrive.unsaved.continueWithout': 'המשך בלעדיהם',
  'gdrive.framed.title':
    'יש לפתוח את עורך Google Drive של ERD Editor בכרטיסייה נפרדת',
  'gdrive.framed.description': 'הוא לא פועל בתוך דף אחר.',
  'gdrive.framed.link': 'פתיחה בכרטיסייה חדשה',
  'gdrive.notConfigured.title': 'השילוב עם Google Drive לא הוגדר',
  'gdrive.notConfigured.description':
    'בגרסה הזו של ERD Editor אין לקוח כניסה של Google.',
  'gdrive.unsupportedOrigin.title': 'Google Drive לא זמין כאן',
  'gdrive.unsupportedOrigin.description':
    'הכניסה עם Google פועלת רק ב-erd-editor.io, וזו גרסת תצוגה מקדימה.',

  'gdrive.signIn.title': 'פתיחת קובצי ERD שלך ב-Google Drive',
  'gdrive.signIn.description':
    'ERD Editor פותח ושומר רק קבצים שיוצרים או פותחים בו.',
  'gdrive.signIn.fallbackDescription':
    'שרת הכניסה של ERD Editor עמוס, ולכן Google מכניס אותך לשעה בכל פעם.',
  'gdrive.signIn.signIn': 'כניסה באמצעות Google',
  'gdrive.signIn.continue': 'המשך עם Google',
  'gdrive.signIn.waitingTitle': 'ממתין לכניסה ל-Google…',
  'gdrive.signIn.waitingDescription': 'יש להשלים את הכניסה בחלון ש-Google פתח.',
  'gdrive.signIn.popupBlocked':
    'הדפדפן חסם את חלון הכניסה. יש לאפשר חלונות קופצים לאתר הזה ולנסות שוב.',
  'gdrive.signIn.failed': 'הכניסה ל-Google לא הושלמה. יש לנסות שוב.',
  'gdrive.signIn.gisBlocked':
    'לא ניתן לטעון את הכניסה עם Google. יש לוודא ששום דבר לא חוסם את accounts.google.com, ואז לטעון את הדף מחדש.',

  'gdrive.sidebar.label': 'קבצים ב-Drive',
  'gdrive.sidebar.newFile': 'קובץ חדש',
  'gdrive.sidebar.import': 'ייבוא',
  'gdrive.sidebar.searchFiles': 'חיפוש קבצים',
  'gdrive.sidebar.newFileName': 'שם הקובץ החדש',
  'gdrive.sidebar.fileName': 'שם הקובץ',
  'gdrive.sidebar.fileNamePlaceholder': 'שם הקובץ',
  'gdrive.sidebar.loadingFiles': 'טוען קבצים…',
  'gdrive.sidebar.loadFailed': 'לא ניתן לטעון את הקבצים שלך.',

  'gdrive.viewer.noFileOpen': 'אין קובץ פתוח',
  'gdrive.viewer.noFileOpenHint':
    'אפשר לבחור קובץ בסרגל הצד או להתחיל קובץ חדש.',
  'gdrive.viewer.noFilesYet': 'עדיין אין קבצים',
  'gdrive.viewer.noFilesYetHint':
    'אפשר ליצור קובץ או לייבא קובץ. קבצים שפותחים עם ERD Editor מתוך Google Drive יופיעו כאן גם הם.',
  'gdrive.viewer.waitingForOpener': 'ממתין לכרטיסייה שפתחה את הקובץ…',
  'gdrive.viewer.notDocument': 'הקובץ הזה אינו מסמך של ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor פותח תרשימים שהוא עצמו שמר. הקובץ הזה נשאר כמו שהוא ולעולם לא נדרס.',
  'gdrive.viewer.googleNativeHint':
    'מסמכי Google, גיליונות ותיקיות נפתחים ב-Google Drive.',
  'gdrive.viewer.trashed': 'הקובץ הזה נמצא באשפה',
  'gdrive.viewer.trashedHint':
    'יש לשחזר אותו ב-Google Drive כדי לפתוח אותו כאן.',
  'gdrive.viewer.tooLarge': 'הקובץ הזה גדול מדי',
  'gdrive.viewer.tooLargeHint': 'ERD Editor פותח קבצים בגודל של עד {size} MB.',
  'gdrive.viewer.notFound': 'הקובץ הזה לא זמין',
  'gdrive.viewer.notFoundHint':
    'ייתכן שהוא נמחק, או שחשבון Google הזה לא יכול לפתוח אותו.',
  'gdrive.viewer.waitingToken': 'ממתין ל-Google',
  'gdrive.viewer.waitingTokenHint': 'הקובץ ייפתח כשהסשן שלך ב-Google יחזור.',
  'gdrive.viewer.failed': 'לא ניתן לפתוח את הקובץ הזה',
  'gdrive.viewer.failedHint':
    'Google Drive לא הגיב. יש לבדוק את החיבור ולנסות שוב.',
  'gdrive.viewer.savingBeforeLeave': 'שומר לפני היציאה…',

  'gdrive.status.saved': 'נשמר ב-Google Drive',
  'gdrive.status.saving': 'שומר…',
  'gdrive.status.failed': 'השמירה נכשלה',
  'gdrive.status.conflict': 'השתנה ב-Google Drive',
  'gdrive.status.unconfirmed': 'לא ניתן לאמת את השמירה האחרונה',
  'gdrive.status.paused': 'מושהה עד ש-Google יתחבר שוב',
  'gdrive.status.deleted': 'נמחק ב-Google Drive',
  'gdrive.status.readonly': 'צפייה בלבד',
  'gdrive.status.waitingLeader': 'ממתין לכרטיסייה ששומרת את הקובץ',
  'gdrive.status.waitingSnapshot': 'ממתין לכרטיסייה שפתחה את הקובץ',
  'gdrive.status.scopeMissing': 'אין גישה ל-Google Drive',

  'gdrive.banner.conflict':
    'הקובץ הזה השתנה ב-Google Drive, ולכן השמירה נעצרה. השינויים שלך עדיין כאן.',
  'gdrive.banner.unconfirmed':
    'לא ניתן לאמת את השמירה האחרונה, ולכן השמירה נעצרה. השינויים שלך עדיין כאן.',
  'gdrive.banner.deleted':
    'הקובץ הזה נמחק או הועבר לאשפה ב-Google Drive, ולכן השמירה נעצרה.',
  'gdrive.banner.readonly':
    'כבר אי אפשר לערוך את הקובץ הזה ב-Google Drive, ולכן השמירה נעצרה. השינויים שלך עדיין כאן.',
  'gdrive.banner.checkDrive': 'בדיקה ב-Drive',
  'gdrive.banner.reloadFromDrive': 'טעינה מחדש מ-Drive',
  'gdrive.banner.leaderNotResponding': 'הכרטיסייה ששומרת את הקובץ לא מגיבה.',
  'gdrive.banner.openerNotResponding': 'הכרטיסייה שפתחה את הקובץ לא מגיבה.',
  'gdrive.banner.takeOver': 'לקיחת אחריות על השמירה',
  'gdrive.banner.openAndTakeOver': 'פתיחה מ-Drive ולקיחת אחריות על השמירה',
  'gdrive.banner.popupBlocked':
    'הדפדפן חסם את החלון של Google. יש לאפשר חלונות קופצים לאתר הזה ואז להתחבר מחדש.',
  'gdrive.banner.reconnectFailed': 'Google לא התחבר מחדש. יש לנסות שוב.',
  'gdrive.banner.sessionEnded': 'הסשן שלך ב-Google הסתיים, ולכן השמירה מושהית.',
  'gdrive.banner.sessionEndsSoon': 'הסשן שלך ב-Google יסתיים בקרוב.',
  'gdrive.banner.reconnect': 'חיבור מחדש ל-Google',

  'gdrive.leave.title': 'השינויים האחרונים שלך לא נשמרו',
  'gdrive.leave.description':
    'ERD Editor לא הצליח לשמור אותם ב-Google Drive. אפשר להוריד אותם כדי לשמור עותק, או לצאת ולאבד אותם.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor לא הצליח לשמור אותם ב-Google Drive. אפשר להוריד אותם כדי לשמור עותק, או להתנתק ולאבד אותם.',
  'gdrive.leave.stay': 'חזרה לקובץ',
  'gdrive.leave.leaveAnyway': 'יציאה בכל זאת',
  'gdrive.leave.signOutAnyway': 'התנתקות בכל זאת',

  'gdrive.create.title': 'קובץ חדש ב-Google Drive',
  'gdrive.create.inAppFolder': 'בתיקייה ERD Editor',
  'gdrive.create.inFolderPending': 'בתיקייה…',
  'gdrive.create.inHiddenFolder': 'בתיקייה ש-ERD Editor לא יכול לראות',
  'gdrive.create.inFolder': 'בתיקייה „{name}”',
  'gdrive.create.untitled': 'ללא שם',
  'gdrive.create.savedAs': 'יישמר בשם {name}',
  'gdrive.create.folderRefused':
    'ERD Editor לא יכול ליצור קבצים בתיקייה הזו. ליצור את הקובץ בתיקייה ERD Editor במקום זאת?',
  'gdrive.create.failed': 'לא ניתן ליצור את הקובץ. יש לנסות שוב.',
  'gdrive.create.createInAppFolder': 'יצירה בתיקייה ERD Editor',
  'gdrive.create.create': 'יצירה',

  'gdrive.import.imported': {
    one: 'קובץ {count} יובא ל-Google Drive',
    two: '{count} קבצים יובאו ל-Google Drive',
    other: '{count} קבצים יובאו ל-Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: 'דולג על גיבוי {count}: גיבויים נשארים באפליקציה המקומית',
    two: 'דולג על {count} גיבויים: גיבויים נשארים באפליקציה המקומית',
    other: 'דולג על {count} גיבויים: גיבויים נשארים באפליקציה המקומית',
  },
  'gdrive.import.uploadsFailed': {
    one: 'העלאה {count} נכשלה',
    two: '{count} העלאות נכשלו',
    other: '{count} העלאות נכשלו',
  },

  'gdrive.notice.unreadableState':
    'Google Drive שלח קישור ש-ERD Editor לא הצליח לקרוא',
  'gdrive.notice.renameFailed': 'לא ניתן לשנות את שם הקובץ',
  'gdrive.notice.createFailed': 'לא ניתן ליצור את הקובץ',
  'gdrive.notice.checkFailed': 'לא ניתן להגיע ל-Google Drive. יש לנסות שוב.',
  'gdrive.notice.reloadFailed':
    'לא ניתן לטעון מחדש מ-Google Drive. יש לנסות שוב.',
  'gdrive.notice.reloadTrashed':
    'לא ניתן לטעון מחדש: הקובץ נמצא באשפה של Google Drive',
  'gdrive.notice.reloadTooLarge':
    'לא ניתן לטעון מחדש: הקובץ ב-Google Drive גדול מ-{size} MB',
  'gdrive.notice.reloadNotDocument':
    'לא ניתן לטעון מחדש: הקובץ ב-Google Drive כבר אינו מסמך של ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'התנתקת כאן. השרת של ERD Editor לא אישר זאת, ולכן הדפדפן הזה ישלים את ההתנתקות בפעם הבאה שיתחבר',
  'gdrive.notice.signOutNotRevoked':
    'התנתקת כאן, אבל Google לא אישר שהגישה של ERD Editor הוסרה, ולכן ייתכן שהמכשירים האחרים שלך יישארו מחוברים עד שמסירים אותה ב-myaccount.google.com/permissions',
} satisfies Messages;
