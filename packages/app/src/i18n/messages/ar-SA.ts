import type { Messages } from '@/i18n/translate';

/** The app's own text in Arabic, key for key as English writes it. */
export const arSA = {
  'common.cancel': 'إلغاء',
  'common.close': 'إغلاق',
  'common.dismiss': 'إغلاق',
  'common.tryAgain': 'إعادة المحاولة',
  'common.reload': 'إعادة التحميل',
  'common.loading': 'جارٍ التحميل…',
  'common.search': 'بحث',
  'common.rename': 'إعادة التسمية',
  'common.importFiles': 'استيراد ملفات',
  'common.signOut': 'تسجيل الخروج',
  'common.downloadMyChanges': 'تنزيل تغييراتي',
  'common.edited': 'عُدِّل {time}',
  'common.system': 'النظام',
  'common.displayLanguage': 'لغة العرض',
  'common.theme': 'النسق',
  'common.light': 'فاتح',
  'common.dark': 'داكن',
  'common.host': 'المضيف',
  'common.guest': 'ضيف',
  'common.you': '(أنت)',
  'common.participants': 'المشاركون',
  'common.yourNickname': 'اسمك المستعار',
  'common.privacy': 'الخصوصية',
  'common.terms': 'الشروط',
  'common.editingGuide': 'دليل التحرير',
  'common.openSidebar': 'فتح الشريط الجانبي',
  'common.closeSidebar': 'إغلاق الشريط الجانبي',

  'time.justNow': 'الآن',
  'time.today': 'اليوم',
  'time.yesterday': 'أمس',
  'time.previous7Days': 'آخر 7 أيام',
  'time.previous30Days': 'آخر 30 يومًا',

  'sidebar.schemas': 'المخططات',
  'sidebar.newSchema': 'مخطط جديد',
  'sidebar.importAndExport': 'الاستيراد والتصدير',
  'sidebar.exportBackup': 'تصدير نسخة احتياطية',
  'sidebar.searchSchemas': 'البحث في المخططات',
  'sidebar.newSchemaName': 'اسم المخطط الجديد',
  'sidebar.schemaName': 'اسم المخطط',
  'sidebar.schemaNamePlaceholder': 'اسم المخطط',
  'sidebar.duplicate': 'تكرار',
  'sidebar.moveToTrash': 'نقل إلى المهملات',
  'sidebar.actionsFor': 'إجراءات {name}',
  'sidebar.noResults': 'لا توجد نتائج',

  'trash.button': 'المهملات ({count})',
  'trash.title': 'المهملات',
  'trash.description': {
    zero: 'تُحذف المخططات في المهملات نهائيًا بعد {count} يوم.',
    one: 'تُحذف المخططات في المهملات نهائيًا بعد {count} يوم.',
    two: 'تُحذف المخططات في المهملات نهائيًا بعد {count} يومين.',
    few: 'تُحذف المخططات في المهملات نهائيًا بعد {count} أيام.',
    many: 'تُحذف المخططات في المهملات نهائيًا بعد {count} يومًا.',
    other: 'تُحذف المخططات في المهملات نهائيًا بعد {count} يوم.',
  },
  'trash.listLabel': 'المخططات في المهملات',
  'trash.deleted': 'حُذف {time}',
  'trash.deletesToday': 'يُحذف اليوم',
  'trash.deletesTomorrow': 'يُحذف غدًا',
  'trash.deletesIn': {
    zero: 'يُحذف بعد {count} يوم',
    one: 'يُحذف بعد {count} يوم',
    two: 'يُحذف بعد {count} يومين',
    few: 'يُحذف بعد {count} أيام',
    many: 'يُحذف بعد {count} يومًا',
    other: 'يُحذف بعد {count} يوم',
  },
  'trash.restore': 'استعادة',
  'trash.deletePermanently': 'حذف نهائي',
  'trash.cannotBeUndone': 'لا يمكن التراجع عن هذا الإجراء.',
  'trash.delete': 'حذف',
  'trash.empty': 'المهملات فارغة.',
  'trash.emptyTrash': 'إفراغ المهملات',
  'trash.emptyConfirm': {
    zero: 'هل تريد حذف {count} مخطط نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.',
    one: 'هل تريد حذف {count} مخطط نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.',
    two: 'هل تريد حذف {count} مخططين نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.',
    few: 'هل تريد حذف {count} مخططات نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.',
    many: 'هل تريد حذف {count} مخططًا نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.',
    other: 'هل تريد حذف {count} مخطط نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.',
  },

  'collaboration.for': 'التعاون في {name}',
  'collaboration.guestsConnected': {
    zero: '{count} ضيف متصل',
    one: '{count} ضيف متصل',
    two: '{count} ضيفان متصلان',
    few: '{count} ضيوف متصلون',
    many: '{count} ضيفًا متصلًا',
    other: '{count} ضيف متصل',
  },
  'collaboration.title': 'التحرير التعاوني',
  'collaboration.experiment': 'تجريبي',
  'collaboration.description':
    'يتصل المشاركون مباشرة عبر WebRTC ويتبادلون الرسائل بتشفير تام بين الطرفين.',
  'collaboration.nickname': 'الاسم المستعار',
  'collaboration.link': 'الرابط',
  'collaboration.noOneJoined': 'لم ينضم أحد آخر بعد.',
  'collaboration.startSession': 'بدء الجلسة',
  'collaboration.stopSession': 'إيقاف الجلسة',

  'viewer.noSchemaOpen': 'لا يوجد مخطط مفتوح',
  'viewer.emptyHint':
    'اختر مخططًا من الشريط الجانبي أو ابدأ مخططًا هنا. يمكنك أيضًا إفلات الملفات في أي مكان لاستيرادها.',
  'viewer.openSample': 'فتح المثال',
  'viewer.sampleName': 'مثال متجر الكتب',

  'drop.title': 'أفلِت للاستيراد',
  'drop.formats':
    'النسخ الاحتياطية، ومستندات ERD (.erd، .vuerd، .json)، وSQL وDBML وAML وGraphQL',
  'drop.importing': 'جارٍ استيراد الملفات…',
  'drop.importingHint': 'أفلِت المزيد بعد انتهاء هذا الاستيراد',

  'import.imported': {
    zero: 'استُورد {count} مخطط',
    one: 'استُورد {count} مخطط',
    two: 'استُورد {count} مخططان',
    few: 'استُوردت {count} مخططات',
    many: 'استُورد {count} مخططًا',
    other: 'استُورد {count} مخطط',
  },
  'import.skippedInvalidFiles': {
    zero: 'تم تخطي {count} ملف غير صالح',
    one: 'تم تخطي {count} ملف غير صالح',
    two: 'تم تخطي {count} ملفين غير صالحين',
    few: 'تم تخطي {count} ملفات غير صالحة',
    many: 'تم تخطي {count} ملفًا غير صالح',
    other: 'تم تخطي {count} ملف غير صالح',
  },
  'import.skippedInvalidSchemas': {
    zero: 'تم تخطي {count} مخطط غير صالح',
    one: 'تم تخطي {count} مخطط غير صالح',
    two: 'تم تخطي {count} مخططين غير صالحين',
    few: 'تم تخطي {count} مخططات غير صالحة',
    many: 'تم تخطي {count} مخططًا غير صالح',
    other: 'تم تخطي {count} مخطط غير صالح',
  },
  'import.skippedOversized': {
    zero: 'تم تخطي {count} ملف يزيد على {size} MB',
    one: 'تم تخطي {count} ملف يزيد على {size} MB',
    two: 'تم تخطي {count} ملفين يزيدان على {size} MB',
    few: 'تم تخطي {count} ملفات تزيد على {size} MB',
    many: 'تم تخطي {count} ملفًا يزيد على {size} MB',
    other: 'تم تخطي {count} ملف يزيد على {size} MB',
  },
  'import.nothing': 'لا يوجد ما يُستورد',
  'import.failed': 'فشل الاستيراد',
  'import.exportFailed': 'فشل التصدير',

  'update.available': 'يتوفر إصدار جديد من ERD Editor.',
  'update.updatedElsewhere':
    'حُدّث التطبيق في علامة تبويب أخرى — أعد التحميل للإنهاء.',

  'live.invalidToken': 'رمز المشاركة غير صالح.',
  'live.hostNotFound': 'لم يُعثر على المضيف.',
  'live.refresh': 'تحديث',
  'live.hostStopped': 'أوقف المضيف الجلسة.',
  'live.somethingWentWrong': 'حدث خطأ ما.',
  'live.lookingForHost': 'جارٍ البحث عن مضيف...',
  'live.waitingForHost': 'في انتظار مضيف...',
  'live.session': 'جلسة مباشرة',
  'live.inSession': {
    zero: '{count} في الجلسة',
    one: '{count} في الجلسة',
    two: '{count} في الجلسة',
    few: '{count} في الجلسة',
    many: '{count} في الجلسة',
    other: '{count} في الجلسة',
  },
  'live.showParticipants': 'إظهار المشاركين',
  'live.hideParticipants': 'إخفاء المشاركين',

  'gdrive.checkingSignIn': 'جارٍ التحقق من تسجيل دخولك إلى Google…',
  'gdrive.anotherAccount': 'حساب آخر',
  'gdrive.offline.title': 'أنت غير متصل بالإنترنت',
  'gdrive.offline.description':
    'سيتحقق ERD Editor من تسجيل دخولك إلى Google عند عودة الاتصال بالإنترنت.',
  'gdrive.scopeMissing.title': 'لم يُمنح الوصول إلى Google Drive',
  'gdrive.scopeMissing.description':
    'يحتاج ERD Editor إلى الوصول إلى الملفات التي تنشئها أو تفتحها به. سجّل الدخول مرة أخرى واسمح بالوصول إلى Google Drive.',
  'gdrive.mismatch.title': 'هذا الطلب من Google Drive مخصّص لحساب آخر',
  'gdrive.mismatch.description':
    'أنت مسجّل الدخول باسم {email}. بدّل إلى الحساب الذي استخدمه Google Drive لفتحه، أو تابع بملفات هذا الحساب.',
  'gdrive.mismatch.choose':
    'تعذّر على ERD Editor تحديد ذلك الحساب مسبقًا، لذا اختره عندما يسألك Google.',
  'gdrive.mismatch.switchAccount': 'تبديل الحساب',
  'gdrive.mismatch.showMyFiles': 'عرض ملفاتي',
  'gdrive.accountChanged.title': 'تم تسجيل الدخول بحساب آخر',
  'gdrive.accountChanged.description':
    'سجّلت علامة تبويب أخرى الدخول إلى حساب Google مختلف، لذا توقفت علامة التبويب هذه. أعد تحميلها للمتابعة بذلك الحساب.',
  'gdrive.unsaved.title': 'لم تُحفظ تغييراتك',
  'gdrive.unsaved.description':
    'يحتوي {name} على تغييرات من {email} غير موجودة في Google Drive، والحساب الذي سُجّل الدخول به الآن هو {account}. نزّلها قبل المتابعة.',
  'gdrive.unsaved.descriptionUnnamed':
    'يحتوي الملف الذي كان مفتوحًا على تغييرات من {email} غير موجودة في Google Drive، والحساب الذي سُجّل الدخول به الآن هو {account}. نزّلها قبل المتابعة.',
  'gdrive.unsaved.continueWithout': 'المتابعة بدونها',
  'gdrive.framed.title':
    'افتح محرر Google Drive الخاص بـ ERD Editor في علامة تبويب مستقلة',
  'gdrive.framed.description': 'لا يعمل داخل صفحة أخرى.',
  'gdrive.framed.link': 'فتح في علامة تبويب جديدة',
  'gdrive.notConfigured.title': 'لم يُضبط التكامل مع Google Drive',
  'gdrive.notConfigured.description':
    'لا يحتوي هذا الإصدار من ERD Editor على عميل تسجيل دخول Google.',
  'gdrive.unsupportedOrigin.title': 'Google Drive غير متاح هنا',
  'gdrive.unsupportedOrigin.description':
    'يعمل تسجيل الدخول باستخدام Google على erd-editor.io فقط، وهذه نسخة معاينة.',

  'gdrive.signIn.title': 'افتح ملفات ERD في Google Drive',
  'gdrive.signIn.description':
    'يفتح ERD Editor ويحفظ فقط الملفات التي تنشئها أو تفتحها به.',
  'gdrive.signIn.fallbackDescription':
    'خادم تسجيل الدخول في ERD Editor مشغول، لذا يسجّل Google دخولك لمدة ساعة في كل مرة.',
  'gdrive.signIn.signIn': 'تسجيل الدخول باستخدام Google',
  'gdrive.signIn.continue': 'المتابعة باستخدام Google',
  'gdrive.signIn.waitingTitle': 'في انتظار تسجيل الدخول إلى Google…',
  'gdrive.signIn.waitingDescription':
    'أكمل تسجيل الدخول في النافذة التي فتحها Google.',
  'gdrive.signIn.popupBlocked':
    'حظر المتصفح نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة لهذا الموقع، ثم أعد المحاولة.',
  'gdrive.signIn.failed': 'لم يكتمل تسجيل الدخول إلى Google. أعد المحاولة.',
  'gdrive.signIn.gisBlocked':
    'تعذّر تحميل تسجيل الدخول باستخدام Google. تأكد من عدم حظر accounts.google.com، ثم أعد تحميل الصفحة.',

  'gdrive.sidebar.label': 'ملفات Drive',
  'gdrive.sidebar.newFile': 'ملف جديد',
  'gdrive.sidebar.import': 'استيراد',
  'gdrive.sidebar.searchFiles': 'البحث في الملفات',
  'gdrive.sidebar.newFileName': 'اسم الملف الجديد',
  'gdrive.sidebar.fileName': 'اسم الملف',
  'gdrive.sidebar.fileNamePlaceholder': 'اسم الملف',
  'gdrive.sidebar.loadingFiles': 'جارٍ تحميل الملفات…',
  'gdrive.sidebar.loadFailed': 'تعذّر تحميل ملفاتك.',

  'gdrive.viewer.noFileOpen': 'لا يوجد ملف مفتوح',
  'gdrive.viewer.noFileOpenHint':
    'اختر ملفًا من الشريط الجانبي، أو ابدأ ملفًا جديدًا.',
  'gdrive.viewer.noFilesYet': 'لا توجد ملفات بعد',
  'gdrive.viewer.noFilesYetHint':
    'أنشئ ملفًا أو استورد واحدًا. تظهر هنا أيضًا الملفات التي تفتحها باستخدام ERD Editor من Google Drive.',
  'gdrive.viewer.waitingForOpener':
    'في انتظار علامة التبويب التي فتحت هذا الملف…',
  'gdrive.viewer.notDocument': 'هذا الملف ليس مستند ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'يفتح ERD Editor المخططات التي حفظها بنفسه. يترك هذا الملف كما هو ولا يكتب فوقه أبدًا.',
  'gdrive.viewer.googleNativeHint':
    'تُفتح مستندات Google وجداول بيانات Google والمجلدات في Google Drive.',
  'gdrive.viewer.trashed': 'هذا الملف في المهملات',
  'gdrive.viewer.trashedHint': 'استعده في Google Drive لفتحه هنا.',
  'gdrive.viewer.tooLarge': 'هذا الملف كبير جدًا',
  'gdrive.viewer.tooLargeHint': 'يفتح ERD Editor الملفات حتى {size} MB.',
  'gdrive.viewer.notFound': 'هذا الملف غير متاح',
  'gdrive.viewer.notFoundHint': 'ربما حُذف، أو لا يستطيع حساب Google هذا فتحه.',
  'gdrive.viewer.waitingToken': 'في انتظار Google',
  'gdrive.viewer.waitingTokenHint': 'يُفتح هذا الملف عند عودة جلسة Google.',
  'gdrive.viewer.failed': 'تعذّر فتح هذا الملف',
  'gdrive.viewer.failedHint':
    'لم يستجب Google Drive. تحقق من الاتصال وأعد المحاولة.',
  'gdrive.viewer.savingBeforeLeave': 'جارٍ الحفظ قبل المغادرة…',

  'gdrive.status.saved': 'حُفظ في Google Drive',
  'gdrive.status.saving': 'جارٍ الحفظ…',
  'gdrive.status.failed': 'تعذّر الحفظ',
  'gdrive.status.conflict': 'تغيّر في Google Drive',
  'gdrive.status.unconfirmed': 'تعذّر تأكيد آخر حفظ',
  'gdrive.status.paused': 'متوقف مؤقتًا حتى يعاود Google الاتصال',
  'gdrive.status.deleted': 'حُذف في Google Drive',
  'gdrive.status.readonly': 'للعرض فقط',
  'gdrive.status.waitingLeader': 'في انتظار علامة التبويب التي تحفظ هذا الملف',
  'gdrive.status.waitingSnapshot': 'في انتظار علامة التبويب التي فتحت هذا الملف',
  'gdrive.status.scopeMissing': 'لا يوجد إذن بالوصول إلى Google Drive',

  'gdrive.banner.conflict':
    'تغيّر هذا الملف في Google Drive، لذا توقف الحفظ. لا تزال تغييراتك هنا.',
  'gdrive.banner.unconfirmed':
    'تعذّر تأكيد آخر حفظ، لذا توقف الحفظ. لا تزال تغييراتك هنا.',
  'gdrive.banner.deleted':
    'حُذف هذا الملف أو نُقل إلى المهملات في Google Drive، لذا توقف الحفظ.',
  'gdrive.banner.readonly':
    'لم يعد بإمكانك تعديل هذا الملف في Google Drive، لذا توقف الحفظ. لا تزال تغييراتك هنا.',
  'gdrive.banner.checkDrive': 'التحقق من Drive',
  'gdrive.banner.reloadFromDrive': 'إعادة التحميل من Drive',
  'gdrive.banner.leaderNotResponding':
    'علامة التبويب التي تحفظ هذا الملف لا تستجيب.',
  'gdrive.banner.openerNotResponding':
    'علامة التبويب التي فتحت هذا الملف لا تستجيب.',
  'gdrive.banner.takeOver': 'تولّي الحفظ',
  'gdrive.banner.openAndTakeOver': 'الفتح من Drive وتولّي الحفظ',
  'gdrive.banner.popupBlocked':
    'حظر المتصفح نافذة Google. اسمح بالنوافذ المنبثقة لهذا الموقع، ثم أعد الاتصال.',
  'gdrive.banner.reconnectFailed': 'لم يعاود Google الاتصال. أعد المحاولة.',
  'gdrive.banner.sessionEnded': 'انتهت جلسة Google، لذا توقف الحفظ مؤقتًا.',
  'gdrive.banner.sessionEndsSoon': 'تنتهي جلسة Google قريبًا.',
  'gdrive.banner.reconnect': 'إعادة الاتصال بـ Google',

  'gdrive.leave.title': 'لم تُحفظ أحدث تغييراتك',
  'gdrive.leave.description':
    'تعذّر على ERD Editor حفظها في Google Drive. نزّلها للاحتفاظ بنسخة، أو غادر وستفقدها.',
  'gdrive.leave.descriptionSignOut':
    'تعذّر على ERD Editor حفظها في Google Drive. نزّلها للاحتفاظ بنسخة، أو سجّل الخروج وستفقدها.',
  'gdrive.leave.stay': 'البقاء',
  'gdrive.leave.leaveAnyway': 'المغادرة على أي حال',
  'gdrive.leave.signOutAnyway': 'تسجيل الخروج على أي حال',

  'gdrive.create.title': 'ملف جديد في Google Drive',
  'gdrive.create.inAppFolder': 'في مجلد ERD Editor',
  'gdrive.create.inFolderPending': 'في مجلد…',
  'gdrive.create.inHiddenFolder': 'في مجلد لا يستطيع ERD Editor رؤيته',
  'gdrive.create.inFolder': 'في المجلد «{name}»',
  'gdrive.create.untitled': 'بلا عنوان',
  'gdrive.create.savedAs': 'سيُحفظ باسم {name}',
  'gdrive.create.folderRefused':
    'لا يستطيع ERD Editor إنشاء ملفات في هذا المجلد. هل تريد إنشاءه في مجلد ERD Editor بدلًا من ذلك؟',
  'gdrive.create.failed': 'تعذّر إنشاء الملف. أعد المحاولة.',
  'gdrive.create.createInAppFolder': 'إنشاء في مجلد ERD Editor',
  'gdrive.create.create': 'إنشاء',

  'gdrive.import.imported': {
    zero: 'استُورد {count} ملف إلى Google Drive',
    one: 'استُورد {count} ملف إلى Google Drive',
    two: 'استُورد {count} ملفان إلى Google Drive',
    few: 'استُوردت {count} ملفات إلى Google Drive',
    many: 'استُورد {count} ملفًا إلى Google Drive',
    other: 'استُورد {count} ملف إلى Google Drive',
  },
  'gdrive.import.skippedBackups': {
    zero: 'تم تخطي {count} نسخة احتياطية: تبقى النسخ الاحتياطية في التطبيق المحلي',
    one: 'تم تخطي {count} نسخة احتياطية: تبقى النسخ الاحتياطية في التطبيق المحلي',
    two: 'تم تخطي {count} نسختين احتياطيتين: تبقى النسخ الاحتياطية في التطبيق المحلي',
    few: 'تم تخطي {count} نسخ احتياطية: تبقى النسخ الاحتياطية في التطبيق المحلي',
    many: 'تم تخطي {count} نسخة احتياطية: تبقى النسخ الاحتياطية في التطبيق المحلي',
    other:
      'تم تخطي {count} نسخة احتياطية: تبقى النسخ الاحتياطية في التطبيق المحلي',
  },
  'gdrive.import.uploadsFailed': {
    zero: 'فشلت {count} عملية رفع',
    one: 'فشلت {count} عملية رفع',
    two: 'فشلت {count} عمليتا رفع',
    few: 'فشلت {count} عمليات رفع',
    many: 'فشلت {count} عملية رفع',
    other: 'فشلت {count} عملية رفع',
  },

  'gdrive.notice.unreadableState':
    'أرسل Google Drive رابطًا تعذّر على ERD Editor قراءته',
  'gdrive.notice.renameFailed': 'تعذّرت إعادة تسمية الملف',
  'gdrive.notice.createFailed': 'تعذّر إنشاء الملف',
  'gdrive.notice.checkFailed': 'تعذّر الوصول إلى Google Drive. أعد المحاولة.',
  'gdrive.notice.reloadFailed':
    'تعذّرت إعادة التحميل من Google Drive. أعد المحاولة.',
  'gdrive.notice.reloadTrashed':
    'تعذّرت إعادة التحميل: الملف في مهملات Google Drive',
  'gdrive.notice.reloadTooLarge':
    'تعذّرت إعادة التحميل: يزيد الملف في Google Drive على {size} MB',
  'gdrive.notice.reloadNotDocument':
    'تعذّرت إعادة التحميل: لم يعد الملف في Google Drive مستند ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'سُجّل الخروج هنا. لم يؤكد خادم ERD Editor ذلك، لذا سيُكمل هذا المتصفح تسجيل الخروج في المرة التالية التي يتصل فيها',
  'gdrive.notice.signOutNotRevoked':
    'سُجّل الخروج هنا، لكن Google لم يؤكد إزالة وصول ERD Editor، لذا قد تبقى أجهزتك الأخرى مسجّلة الدخول حتى تزيله من myaccount.google.com/permissions',
} satisfies Messages;
