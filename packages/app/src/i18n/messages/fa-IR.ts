import type { Messages } from '@/i18n/translate';

/** The app's own text in Persian, key for key as English writes it. */
export const faIR = {
  'common.cancel': 'لغو',
  'common.close': 'بستن',
  'common.dismiss': 'بستن',
  'common.tryAgain': 'تلاش دوباره',
  'common.reload': 'بارگذاری دوباره',
  'common.loading': 'در حال بارگذاری…',
  'common.search': 'جست‌وجو',
  'common.rename': 'تغییر نام',
  'common.importFiles': 'وارد کردن فایل‌ها',
  'common.signOut': 'خروج از حساب',
  'common.downloadMyChanges': 'دانلود تغییراتم',
  'common.edited': 'ویرایش‌شده {time}',
  'common.system': 'سیستم',
  'common.displayLanguage': 'زبان نمایش',
  'common.theme': 'طرح زمینه',
  'common.light': 'روشن',
  'common.dark': 'تیره',
  'common.host': 'میزبان',
  'common.guest': 'مهمان',
  'common.you': '(شما)',
  'common.participants': 'شرکت‌کنندگان',
  'common.yourNickname': 'نام مستعار شما',
  'common.privacy': 'حریم خصوصی',
  'common.terms': 'شرایط',
  'common.editingGuide': 'راهنمای ویرایش',
  'common.openSidebar': 'باز کردن نوار کناری',
  'common.closeSidebar': 'بستن نوار کناری',

  'time.justNow': 'همین حالا',
  'time.today': 'امروز',
  'time.yesterday': 'دیروز',
  'time.previous7Days': '۷ روز گذشته',
  'time.previous30Days': '۳۰ روز گذشته',

  'sidebar.schemas': 'طرح‌واره‌ها',
  'sidebar.newSchema': 'طرح‌واره جدید',
  'sidebar.importAndExport': 'وارد کردن و صادر کردن',
  'sidebar.exportBackup': 'صادر کردن پشتیبان',
  'sidebar.searchSchemas': 'جست‌وجوی طرح‌واره‌ها',
  'sidebar.newSchemaName': 'نام طرح‌واره جدید',
  'sidebar.schemaName': 'نام طرح‌واره',
  'sidebar.schemaNamePlaceholder': 'نام طرح‌واره',
  'sidebar.duplicate': 'تکثیر',
  'sidebar.moveToTrash': 'انتقال به سطل زباله',
  'sidebar.actionsFor': 'کارهای {name}',
  'sidebar.noResults': 'نتیجه‌ای نیست',

  'trash.button': 'سطل زباله ({count})',
  'trash.title': 'سطل زباله',
  'trash.description': {
    one: 'طرح‌واره‌های سطل زباله پس از {count} روز برای همیشه حذف می‌شوند.',
    other: 'طرح‌واره‌های سطل زباله پس از {count} روز برای همیشه حذف می‌شوند.',
  },
  'trash.listLabel': 'طرح‌واره‌های سطل زباله',
  'trash.deleted': 'حذف‌شده {time}',
  'trash.deletesToday': 'امروز حذف می‌شود',
  'trash.deletesTomorrow': 'فردا حذف می‌شود',
  'trash.deletesIn': {
    one: '{count} روز دیگر حذف می‌شود',
    other: '{count} روز دیگر حذف می‌شود',
  },
  'trash.restore': 'بازیابی',
  'trash.deletePermanently': 'حذف همیشگی',
  'trash.cannotBeUndone': 'این کار برگشت‌پذیر نیست.',
  'trash.delete': 'حذف',
  'trash.empty': 'سطل زباله خالی است.',
  'trash.emptyTrash': 'خالی کردن سطل زباله',
  'trash.emptyConfirm': {
    one: '{count} طرح‌واره برای همیشه حذف شود؟ این کار برگشت‌پذیر نیست.',
    other: '{count} طرح‌واره برای همیشه حذف شوند؟ این کار برگشت‌پذیر نیست.',
  },

  'collaboration.for': 'همکاری در {name}',
  'collaboration.guestsConnected': {
    one: '{count} مهمان متصل است',
    other: '{count} مهمان متصل‌اند',
  },
  'collaboration.title': 'ویرایش گروهی',
  'collaboration.experiment': 'آزمایشی',
  'collaboration.description':
    'شرکت‌کنندگان مستقیماً از طریق WebRTC به هم وصل می‌شوند و پیام‌ها را با رمزگذاری سرتاسری رد و بدل می‌کنند.',
  'collaboration.nickname': 'نام مستعار',
  'collaboration.link': 'پیوند',
  'collaboration.noOneJoined': 'هنوز کس دیگری نپیوسته است.',
  'collaboration.startSession': 'شروع جلسه',
  'collaboration.stopSession': 'پایان جلسه',

  'viewer.noSchemaOpen': 'هیچ طرح‌واره‌ای باز نیست',
  'viewer.emptyHint':
    'یکی را از نوار کناری انتخاب کنید یا همین‌جا یکی بسازید. می‌توانید فایل‌ها را هر جایی رها کنید تا وارد شوند.',
  'viewer.openSample': 'باز کردن نمونه',
  'viewer.sampleName': 'نمونه کتاب‌فروشی',

  'drop.title': 'برای وارد کردن رها کنید',
  'drop.formats':
    'پشتیبان‌ها، سندهای .erd و .vuerd و .json، و SQL و DBML و AML و GraphQL',
  'drop.importing': 'در حال وارد کردن فایل‌ها…',
  'drop.importingHint': 'پس از پایان این وارد کردن، موارد بیشتری رها کنید',

  'import.imported': {
    one: '{count} طرح‌واره وارد شد',
    other: '{count} طرح‌واره وارد شد',
  },
  'import.skippedInvalidFiles': {
    one: '{count} فایل نامعتبر رد شد',
    other: '{count} فایل نامعتبر رد شد',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} طرح‌واره نامعتبر رد شد',
    other: '{count} طرح‌واره نامعتبر رد شد',
  },
  'import.skippedOversized': {
    one: '{count} فایل بزرگ‌تر از {size} MB رد شد',
    other: '{count} فایل بزرگ‌تر از {size} MB رد شد',
  },
  'import.nothing': 'چیزی برای وارد کردن نیست',
  'import.failed': 'وارد کردن ناموفق بود',
  'import.exportFailed': 'صادر کردن ناموفق بود',

  'update.available': 'نسخه جدیدی از ERD Editor در دسترس است.',
  'update.updatedElsewhere':
    'برنامه در زبانه دیگری به‌روز شد — برای تکمیل، دوباره بارگذاری کنید.',

  'live.invalidToken': 'توکن اشتراک‌گذاری نامعتبر است.',
  'live.hostNotFound': 'میزبان پیدا نشد.',
  'live.refresh': 'تازه‌سازی',
  'live.hostStopped': 'میزبان جلسه را متوقف کرد.',
  'live.somethingWentWrong': 'مشکلی پیش آمد.',
  'live.lookingForHost': 'در جست‌وجوی میزبان...',
  'live.waitingForHost': 'در انتظار میزبان...',
  'live.session': 'جلسه زنده',
  'live.inSession': {
    one: '{count} نفر در جلسه',
    other: '{count} نفر در جلسه',
  },
  'live.showParticipants': 'نمایش شرکت‌کنندگان',
  'live.hideParticipants': 'پنهان کردن شرکت‌کنندگان',

  'gdrive.checkingSignIn': 'در حال بررسی ورود شما به Google…',
  'gdrive.anotherAccount': 'حسابی دیگر',
  'gdrive.offline.title': 'آفلاین هستید',
  'gdrive.offline.description':
    'ERD Editor ورود شما به Google را پس از آنلاین شدن دوباره بررسی می‌کند.',
  'gdrive.scopeMissing.title': 'دسترسی به Google Drive داده نشد',
  'gdrive.scopeMissing.description':
    'ERD Editor به فایل‌هایی که با آن می‌سازید یا باز می‌کنید دسترسی لازم دارد. دوباره وارد شوید و اجازه دسترسی به Google Drive را بدهید.',
  'gdrive.mismatch.title': 'Google Drive این را برای حساب دیگری فرستاد',
  'gdrive.mismatch.description':
    'با {email} وارد شده‌اید. به حسابی بروید که Google Drive با آن این فایل را باز کرد، یا با فایل‌های همین حساب ادامه دهید.',
  'gdrive.mismatch.choose':
    'ERD Editor نتوانست آن حساب را از پیش انتخاب کند، پس وقتی Google پرسید آن را انتخاب کنید.',
  'gdrive.mismatch.switchAccount': 'تغییر حساب',
  'gdrive.mismatch.showMyFiles': 'نمایش فایل‌های من',
  'gdrive.accountChanged.title': 'با حساب دیگری وارد شده‌اید',
  'gdrive.accountChanged.description':
    'زبانه دیگری با حساب Google دیگری وارد شد، پس این زبانه متوقف شد. برای ادامه با آن حساب، آن را دوباره بارگذاری کنید.',
  'gdrive.unsaved.title': 'تغییرات شما ذخیره نشد',
  'gdrive.unsaved.description':
    '{name} تغییراتی از {email} دارد که در Google Drive نیست، و اکنون {account} وارد شده است. پیش از ادامه آن‌ها را دانلود کنید.',
  'gdrive.unsaved.descriptionUnnamed':
    'فایلی که باز بود تغییراتی از {email} دارد که در Google Drive نیست، و اکنون {account} وارد شده است. پیش از ادامه آن‌ها را دانلود کنید.',
  'gdrive.unsaved.continueWithout': 'ادامه بدون آن‌ها',
  'gdrive.framed.title':
    'ویرایشگر Google Drive در ERD Editor را در زبانه‌ای جداگانه باز کنید',
  'gdrive.framed.description': 'درون صفحه دیگری اجرا نمی‌شود.',
  'gdrive.framed.link': 'باز کردن در زبانه جدید',
  'gdrive.notConfigured.title': 'یکپارچگی با Google Drive پیکربندی نشده است',
  'gdrive.notConfigured.description':
    'این نسخه از ERD Editor کلاینت ورود Google ندارد.',
  'gdrive.unsupportedOrigin.title': 'Google Drive اینجا در دسترس نیست',
  'gdrive.unsupportedOrigin.description':
    'ورود با Google فقط در erd-editor.io کار می‌کند و این یک پیش‌نمایش است.',

  'gdrive.signIn.title': 'فایل‌های ERD خود را در Google Drive باز کنید',
  'gdrive.signIn.description':
    'ERD Editor فقط فایل‌هایی را باز و ذخیره می‌کند که با آن می‌سازید یا باز می‌کنید.',
  'gdrive.signIn.fallbackDescription':
    'سرور ورود ERD Editor شلوغ است، پس Google هر بار شما را برای یک ساعت وارد می‌کند.',
  'gdrive.signIn.signIn': 'ورود با Google',
  'gdrive.signIn.continue': 'ادامه با Google',
  'gdrive.signIn.waitingTitle': 'در انتظار ورود به Google…',
  'gdrive.signIn.waitingDescription':
    'ورود را در پنجره‌ای که Google باز کرد کامل کنید.',
  'gdrive.signIn.popupBlocked':
    'مرورگر پنجره ورود را مسدود کرد. پنجره‌های بازشو را برای این سایت مجاز کنید و دوباره تلاش کنید.',
  'gdrive.signIn.failed': 'ورود به Google کامل نشد. دوباره تلاش کنید.',
  'gdrive.signIn.gisBlocked':
    'ورود با Google بارگذاری نشد. مطمئن شوید چیزی accounts.google.com را مسدود نمی‌کند، سپس صفحه را دوباره بارگذاری کنید.',

  'gdrive.sidebar.label': 'فایل‌های Drive',
  'gdrive.sidebar.newFile': 'فایل جدید',
  'gdrive.sidebar.import': 'وارد کردن',
  'gdrive.sidebar.searchFiles': 'جست‌وجوی فایل‌ها',
  'gdrive.sidebar.newFileName': 'نام فایل جدید',
  'gdrive.sidebar.fileName': 'نام فایل',
  'gdrive.sidebar.fileNamePlaceholder': 'نام فایل',
  'gdrive.sidebar.loadingFiles': 'در حال بارگذاری فایل‌ها…',
  'gdrive.sidebar.loadFailed': 'فایل‌های شما بارگذاری نشد.',

  'gdrive.viewer.noFileOpen': 'هیچ فایلی باز نیست',
  'gdrive.viewer.noFileOpenHint':
    'فایلی را از نوار کناری انتخاب کنید یا فایل جدیدی بسازید.',
  'gdrive.viewer.noFilesYet': 'هنوز فایلی نیست',
  'gdrive.viewer.noFilesYetHint':
    'فایلی بسازید یا وارد کنید. فایل‌هایی که از Google Drive با ERD Editor باز می‌کنید هم اینجا نمایش داده می‌شوند.',
  'gdrive.viewer.waitingForOpener': 'در انتظار زبانه‌ای که این فایل را باز کرد…',
  'gdrive.viewer.notDocument': 'این فایل سند ERD Editor نیست',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor نمودارهایی را باز می‌کند که خودش ذخیره کرده است. این فایل را همان‌طور که هست رها می‌کند و هرگز روی آن نمی‌نویسد.',
  'gdrive.viewer.googleNativeHint':
    'سندها، برگه‌ها و پوشه‌های Google در Google Drive باز می‌شوند.',
  'gdrive.viewer.trashed': 'این فایل در سطل زباله است',
  'gdrive.viewer.trashedHint':
    'برای باز کردن آن در اینجا، آن را در Google Drive بازیابی کنید.',
  'gdrive.viewer.tooLarge': 'این فایل خیلی بزرگ است',
  'gdrive.viewer.tooLargeHint': 'ERD Editor فایل‌های تا {size} MB را باز می‌کند.',
  'gdrive.viewer.notFound': 'این فایل در دسترس نیست',
  'gdrive.viewer.notFoundHint':
    'شاید حذف شده باشد، یا این حساب Google نتواند آن را باز کند.',
  'gdrive.viewer.waitingToken': 'در انتظار Google',
  'gdrive.viewer.waitingTokenHint':
    'وقتی جلسه Google شما برگردد، این فایل باز می‌شود.',
  'gdrive.viewer.failed': 'این فایل باز نشد',
  'gdrive.viewer.failedHint':
    'Google Drive پاسخ نداد. اتصال را بررسی کنید و دوباره تلاش کنید.',
  'gdrive.viewer.savingBeforeLeave': 'در حال ذخیره پیش از رفتن…',

  'gdrive.status.saved': 'در Google Drive ذخیره شد',
  'gdrive.status.saving': 'در حال ذخیره…',
  'gdrive.status.failed': 'ذخیره نشد',
  'gdrive.status.conflict': 'در Google Drive تغییر کرد',
  'gdrive.status.unconfirmed': 'آخرین ذخیره تأیید نشد',
  'gdrive.status.paused': 'تا اتصال دوباره Google متوقف است',
  'gdrive.status.deleted': 'در Google Drive حذف شد',
  'gdrive.status.readonly': 'فقط مشاهده',
  'gdrive.status.waitingLeader': 'در انتظار زبانه‌ای که این فایل را ذخیره می‌کند',
  'gdrive.status.waitingSnapshot': 'در انتظار زبانه‌ای که این فایل را باز کرد',
  'gdrive.status.scopeMissing': 'دسترسی به Google Drive وجود ندارد',

  'gdrive.banner.conflict':
    'این فایل در Google Drive تغییر کرد، پس ذخیره متوقف شد. تغییرات شما هنوز اینجاست.',
  'gdrive.banner.unconfirmed':
    'آخرین ذخیره تأیید نشد، پس ذخیره متوقف شد. تغییرات شما هنوز اینجاست.',
  'gdrive.banner.deleted':
    'این فایل در Google Drive حذف یا به سطل زباله منتقل شد، پس ذخیره متوقف شد.',
  'gdrive.banner.readonly':
    'دیگر نمی‌توانید این فایل را در Google Drive ویرایش کنید، پس ذخیره متوقف شد. تغییرات شما هنوز اینجاست.',
  'gdrive.banner.checkDrive': 'بررسی Drive',
  'gdrive.banner.reloadFromDrive': 'بارگذاری دوباره از Drive',
  'gdrive.banner.leaderNotResponding':
    'زبانه‌ای که این فایل را ذخیره می‌کند پاسخ نمی‌دهد.',
  'gdrive.banner.openerNotResponding':
    'زبانه‌ای که این فایل را باز کرد پاسخ نمی‌دهد.',
  'gdrive.banner.takeOver': 'برعهده گرفتن ذخیره',
  'gdrive.banner.openAndTakeOver': 'باز کردن از Drive و برعهده گرفتن',
  'gdrive.banner.popupBlocked':
    'مرورگر پنجره Google را مسدود کرد. پنجره‌های بازشو را برای این سایت مجاز کنید، سپس دوباره وصل شوید.',
  'gdrive.banner.reconnectFailed': 'Google دوباره وصل نشد. دوباره تلاش کنید.',
  'gdrive.banner.sessionEnded':
    'جلسه Google شما پایان یافت، پس ذخیره متوقف شده است.',
  'gdrive.banner.sessionEndsSoon': 'جلسه Google شما به‌زودی پایان می‌یابد.',
  'gdrive.banner.reconnect': 'اتصال دوباره به Google',

  'gdrive.leave.title': 'آخرین تغییرات شما ذخیره نشده‌اند',
  'gdrive.leave.description':
    'ERD Editor نتوانست آن‌ها را در Google Drive ذخیره کند. برای نگه داشتن نسخه‌ای دانلودشان کنید، یا بروید و آن‌ها را از دست بدهید.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor نتوانست آن‌ها را در Google Drive ذخیره کند. برای نگه داشتن نسخه‌ای دانلودشان کنید، یا از حساب خارج شوید و آن‌ها را از دست بدهید.',
  'gdrive.leave.stay': 'ماندن',
  'gdrive.leave.leaveAnyway': 'به هر حال رفتن',
  'gdrive.leave.signOutAnyway': 'به هر حال خروج از حساب',

  'gdrive.create.title': 'فایل جدید در Google Drive',
  'gdrive.create.inAppFolder': 'در پوشه ERD Editor',
  'gdrive.create.inFolderPending': 'در یک پوشه…',
  'gdrive.create.inHiddenFolder': 'در پوشه‌ای که ERD Editor نمی‌تواند ببیند',
  'gdrive.create.inFolder': 'در پوشه «{name}»',
  'gdrive.create.untitled': 'بی‌عنوان',
  'gdrive.create.savedAs': 'با نام {name} ذخیره می‌شود',
  'gdrive.create.folderRefused':
    'ERD Editor نمی‌تواند در این پوشه فایل بسازد. به‌جای آن در پوشه ERD Editor ساخته شود؟',
  'gdrive.create.failed': 'فایل ساخته نشد. دوباره تلاش کنید.',
  'gdrive.create.createInAppFolder': 'ساختن در پوشه ERD Editor',
  'gdrive.create.create': 'ساختن',

  'gdrive.import.imported': {
    one: '{count} فایل به Google Drive وارد شد',
    other: '{count} فایل به Google Drive وارد شد',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} پشتیبان رد شد: پشتیبان‌ها در برنامه محلی می‌مانند',
    other: '{count} پشتیبان رد شد: پشتیبان‌ها در برنامه محلی می‌مانند',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} بارگذاری ناموفق بود',
    other: '{count} بارگذاری ناموفق بود',
  },

  'gdrive.notice.unreadableState':
    'Google Drive پیوندی فرستاد که ERD Editor نتوانست آن را بخواند',
  'gdrive.notice.renameFailed': 'نام فایل تغییر نکرد',
  'gdrive.notice.createFailed': 'فایل ساخته نشد',
  'gdrive.notice.checkFailed': 'به Google Drive دسترسی نبود. دوباره تلاش کنید.',
  'gdrive.notice.reloadFailed':
    'بارگذاری دوباره از Google Drive انجام نشد. دوباره تلاش کنید.',
  'gdrive.notice.reloadTrashed':
    'بارگذاری دوباره ممکن نیست: فایل در سطل زباله Google Drive است',
  'gdrive.notice.reloadTooLarge':
    'بارگذاری دوباره ممکن نیست: فایل در Google Drive بزرگ‌تر از {size} MB است',
  'gdrive.notice.reloadNotDocument':
    'بارگذاری دوباره ممکن نیست: فایل در Google Drive دیگر سند ERD Editor نیست',
  'gdrive.notice.signOutUnconfirmed':
    'اینجا از حساب خارج شدید. سرور ERD Editor آن را تأیید نکرد، پس این مرورگر خروج را در اتصال بعدی کامل می‌کند',
  'gdrive.notice.signOutNotRevoked':
    'اینجا از حساب خارج شدید، اما Google تأیید نکرد که دسترسی ERD Editor را برداشته است، پس ممکن است دستگاه‌های دیگرتان تا وقتی آن را در myaccount.google.com/permissions بردارید وارد بمانند',
} satisfies Messages;
