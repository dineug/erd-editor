import type { Messages } from '@/i18n/translate';

/** The app's own text in Turkish, key for key as English writes it. */
export const trTR = {
  'common.cancel': 'İptal',
  'common.close': 'Kapat',
  'common.dismiss': 'Kapat',
  'common.tryAgain': 'Tekrar dene',
  'common.reload': 'Yeniden yükle',
  'common.loading': 'Yükleniyor…',
  'common.search': 'Ara',
  'common.rename': 'Yeniden adlandır',
  'common.importFiles': 'Dosyaları içe aktar',
  'common.signOut': 'Oturumu kapat',
  'common.downloadMyChanges': 'Değişikliklerimi indir',
  'common.edited': 'Düzenlendi: {time}',
  'common.system': 'Sistem',
  'common.displayLanguage': 'Görüntüleme dili',
  'common.theme': 'Tema',
  'common.light': 'Açık',
  'common.dark': 'Koyu',
  'common.host': 'Sunucu',
  'common.guest': 'Konuk',
  'common.you': '(siz)',
  'common.participants': 'Katılımcılar',
  'common.yourNickname': 'Takma adınız',
  'common.privacy': 'Gizlilik',
  'common.terms': 'Şartlar',
  'common.editingGuide': 'Düzenleme Kılavuzu',
  'common.openSidebar': 'Kenar çubuğunu aç',
  'common.closeSidebar': 'Kenar çubuğunu kapat',

  'time.justNow': 'az önce',
  'time.today': 'Bugün',
  'time.yesterday': 'Dün',
  'time.previous7Days': 'Son 7 Gün',
  'time.previous30Days': 'Son 30 Gün',

  'sidebar.schemas': 'Şemalar',
  'sidebar.newSchema': 'Yeni şema',
  'sidebar.importAndExport': 'İçe ve dışa aktar',
  'sidebar.exportBackup': 'Yedeği dışa aktar',
  'sidebar.searchSchemas': 'Şemalarda ara',
  'sidebar.newSchemaName': 'Yeni şema adı',
  'sidebar.schemaName': 'Şema adı',
  'sidebar.schemaNamePlaceholder': 'şema adı',
  'sidebar.duplicate': 'Çoğalt',
  'sidebar.moveToTrash': 'Çöp kutusuna taşı',
  'sidebar.actionsFor': '{name} için işlemler',
  'sidebar.noResults': 'Sonuç yok',

  'trash.button': 'Çöp kutusu ({count})',
  'trash.title': 'Çöp kutusu',
  'trash.description': {
    one: 'Çöp kutusundaki şemalar {count} gün sonra kalıcı olarak silinir.',
    other: 'Çöp kutusundaki şemalar {count} gün sonra kalıcı olarak silinir.',
  },
  'trash.listLabel': 'Çöp kutusundaki şemalar',
  'trash.deleted': 'Silindi: {time}',
  'trash.deletesToday': 'bugün silinecek',
  'trash.deletesTomorrow': 'yarın silinecek',
  'trash.deletesIn': {
    one: '{count} gün içinde silinecek',
    other: '{count} gün içinde silinecek',
  },
  'trash.restore': 'Geri yükle',
  'trash.deletePermanently': 'Kalıcı olarak sil',
  'trash.cannotBeUndone': 'Bu işlem geri alınamaz.',
  'trash.delete': 'Sil',
  'trash.empty': 'Çöp kutusu boş.',
  'trash.emptyTrash': 'Çöp kutusunu boşalt',
  'trash.emptyConfirm': {
    one: '{count} şema kalıcı olarak silinsin mi? Bu işlem geri alınamaz.',
    other: '{count} şema kalıcı olarak silinsin mi? Bu işlem geri alınamaz.',
  },

  'collaboration.for': '{name} için ortak çalışma',
  'collaboration.guestsConnected': {
    one: '{count} konuk bağlı',
    other: '{count} konuk bağlı',
  },
  'collaboration.title': 'Ortak düzenleme',
  'collaboration.experiment': 'Deneysel',
  'collaboration.description':
    'Katılımcılar WebRTC üzerinden doğrudan bağlanır ve uçtan uca şifrelemeyle mesaj alışverişi yapar.',
  'collaboration.nickname': 'Takma ad',
  'collaboration.link': 'Bağlantı',
  'collaboration.noOneJoined': 'Henüz başka kimse katılmadı.',
  'collaboration.startSession': 'Oturumu başlat',
  'collaboration.stopSession': 'Oturumu durdur',

  'viewer.noSchemaOpen': 'Açık şema yok',
  'viewer.emptyHint':
    'Kenar çubuğundan birini seçin ya da burada yeni bir tane başlatın. İçe aktarmak için dosyaları herhangi bir yere de bırakabilirsiniz.',
  'viewer.openSample': 'Örneği aç',
  'viewer.sampleName': 'kitapçı örneği',

  'drop.title': 'İçe aktarmak için bırakın',
  'drop.formats':
    'Yedekler, .erd, .vuerd ve .json belgeleri, SQL, DBML, AML ve GraphQL',
  'drop.importing': 'Dosyalar içe aktarılıyor…',
  'drop.importingHint': 'Bu içe aktarma bitince daha fazlasını bırakın',

  'import.imported': {
    one: '{count} şema içe aktarıldı',
    other: '{count} şema içe aktarıldı',
  },
  'import.skippedInvalidFiles': {
    one: '{count} geçersiz dosya atlandı',
    other: '{count} geçersiz dosya atlandı',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} geçersiz şema atlandı',
    other: '{count} geçersiz şema atlandı',
  },
  'import.skippedOversized': {
    one: '{size} MB üzerindeki {count} dosya atlandı',
    other: '{size} MB üzerindeki {count} dosya atlandı',
  },
  'import.nothing': 'İçe aktarılacak bir şey yok',
  'import.failed': 'İçe aktarma başarısız oldu',
  'import.exportFailed': 'Dışa aktarma başarısız oldu',

  'update.available': 'ERD Editor’ün yeni bir sürümü var.',
  'update.updatedElsewhere':
    'Uygulama başka bir sekmede güncellendi — tamamlamak için yeniden yükleyin.',

  'live.invalidToken': 'Geçersiz paylaşım belirteci.',
  'live.hostNotFound': 'Sunucu bulunamadı.',
  'live.refresh': 'Yenile',
  'live.hostStopped': 'Sunucu oturumu durdurdu.',
  'live.somethingWentWrong': 'Bir sorun oluştu.',
  'live.lookingForHost': 'Sunucu aranıyor...',
  'live.waitingForHost': 'Sunucu bekleniyor...',
  'live.session': 'Canlı oturum',
  'live.inSession': {
    one: 'Oturumda {count} kişi',
    other: 'Oturumda {count} kişi',
  },
  'live.showParticipants': 'Katılımcıları göster',
  'live.hideParticipants': 'Katılımcıları gizle',

  'gdrive.checkingSignIn': 'Google oturumunuz kontrol ediliyor…',
  'gdrive.anotherAccount': 'başka bir hesap',
  'gdrive.offline.title': 'Çevrimdışısınız',
  'gdrive.offline.description':
    'Tekrar çevrimiçi olduğunuzda ERD Editor Google oturumunuzu kontrol eder.',
  'gdrive.scopeMissing.title': 'Google Drive erişimi verilmedi',
  'gdrive.scopeMissing.description':
    'ERD Editor’ün onunla oluşturduğunuz veya açtığınız dosyalara erişmesi gerekir. Tekrar oturum açın ve Google Drive erişimine izin verin.',
  'gdrive.mismatch.title': 'Google Drive bunu başka bir hesap için gönderdi',
  'gdrive.mismatch.description':
    '{email} olarak oturum açtınız. Google Drive’ın dosyayı açtığı hesaba geçin ya da bu hesabın dosyalarıyla devam edin.',
  'gdrive.mismatch.choose':
    'ERD Editor o hesabı önceden seçemedi; Google sorduğunda onu seçin.',
  'gdrive.mismatch.switchAccount': 'Hesap değiştir',
  'gdrive.mismatch.showMyFiles': 'Dosyalarımı göster',
  'gdrive.accountChanged.title': 'Başka bir hesapla oturum açıldı',
  'gdrive.accountChanged.description':
    'Başka bir sekme farklı bir Google hesabında oturum açtı, bu yüzden bu sekme durdu. O hesapla devam etmek için yeniden yükleyin.',
  'gdrive.unsaved.title': 'Değişiklikleriniz kaydedilmedi',
  'gdrive.unsaved.description':
    '{name} dosyasında {email} hesabının Google Drive’da olmayan değişiklikleri var ve şimdi {account} oturum açmış durumda. Devam etmeden önce bunları indirin.',
  'gdrive.unsaved.descriptionUnnamed':
    'Açık olan dosyada {email} hesabının Google Drive’da olmayan değişiklikleri var ve şimdi {account} oturum açmış durumda. Devam etmeden önce bunları indirin.',
  'gdrive.unsaved.continueWithout': 'Onlar olmadan devam et',
  'gdrive.framed.title':
    'ERD Editor’ün Google Drive düzenleyicisini kendi sekmesinde açın',
  'gdrive.framed.description': 'Başka bir sayfanın içinde çalışmaz.',
  'gdrive.framed.link': 'Yeni sekmede aç',
  'gdrive.notConfigured.title': 'Google Drive entegrasyonu yapılandırılmamış',
  'gdrive.notConfigured.description':
    'ERD Editor’ün bu derlemesinde Google oturum açma istemcisi yok.',
  'gdrive.unsupportedOrigin.title': 'Google Drive burada kullanılamıyor',
  'gdrive.unsupportedOrigin.description':
    'Google ile oturum açma yalnızca erd-editor.io üzerinde çalışır ve bu bir önizlemedir.',

  'gdrive.signIn.title': 'ERD dosyalarınızı Google Drive’da açın',
  'gdrive.signIn.description':
    'ERD Editor yalnızca onunla oluşturduğunuz veya açtığınız dosyaları açar ve kaydeder.',
  'gdrive.signIn.fallbackDescription':
    'ERD Editor’ün oturum açma sunucusu meşgul, bu yüzden Google oturumunuzu her seferinde bir saatliğine açar.',
  'gdrive.signIn.signIn': 'Google ile oturum açın',
  'gdrive.signIn.continue': 'Google ile devam et',
  'gdrive.signIn.waitingTitle': 'Google oturum açma bekleniyor…',
  'gdrive.signIn.waitingDescription':
    'Google’ın açtığı pencerede oturum açmayı tamamlayın.',
  'gdrive.signIn.popupBlocked':
    'Tarayıcınız oturum açma penceresini engelledi. Bu site için açılır pencerelere izin verin ve tekrar deneyin.',
  'gdrive.signIn.failed':
    'Google ile oturum açma tamamlanmadı. Tekrar deneyin.',
  'gdrive.signIn.gisBlocked':
    'Google oturum açma yüklenemedi. accounts.google.com adresini hiçbir şeyin engellemediğinden emin olun, ardından sayfayı yeniden yükleyin.',

  'gdrive.sidebar.label': 'Drive dosyaları',
  'gdrive.sidebar.newFile': 'Yeni dosya',
  'gdrive.sidebar.import': 'İçe aktar',
  'gdrive.sidebar.searchFiles': 'Dosyalarda ara',
  'gdrive.sidebar.newFileName': 'Yeni dosya adı',
  'gdrive.sidebar.fileName': 'Dosya adı',
  'gdrive.sidebar.fileNamePlaceholder': 'dosya adı',
  'gdrive.sidebar.loadingFiles': 'Dosyalar yükleniyor…',
  'gdrive.sidebar.loadFailed': 'Dosyalarınız yüklenemedi.',

  'gdrive.viewer.noFileOpen': 'Açık dosya yok',
  'gdrive.viewer.noFileOpenHint':
    'Kenar çubuğundan bir dosya seçin ya da yeni bir tane başlatın.',
  'gdrive.viewer.noFilesYet': 'Henüz dosya yok',
  'gdrive.viewer.noFilesYetHint':
    'Bir dosya oluşturun veya içe aktarın. Google Drive’dan ERD Editor ile açtığınız dosyalar da burada görünür.',
  'gdrive.viewer.waitingForOpener': 'Bu dosyayı açan sekme bekleniyor…',
  'gdrive.viewer.notDocument': 'Bu dosya bir ERD Editor belgesi değil',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor kendi kaydettiği diyagramları açar. Bu dosyayı olduğu gibi bırakır ve asla üzerine yazmaz.',
  'gdrive.viewer.googleNativeHint':
    'Google Dokümanlar, E-Tablolar ve klasörler Google Drive’da açılır.',
  'gdrive.viewer.trashed': 'Bu dosya çöp kutusunda',
  'gdrive.viewer.trashedHint':
    'Burada açmak için Google Drive’da geri yükleyin.',
  'gdrive.viewer.tooLarge': 'Bu dosya çok büyük',
  'gdrive.viewer.tooLargeHint':
    'ERD Editor en fazla {size} MB boyutundaki dosyaları açar.',
  'gdrive.viewer.notFound': 'Bu dosya kullanılamıyor',
  'gdrive.viewer.notFoundHint':
    'Silinmiş olabilir ya da bu Google hesabı onu açamıyor olabilir.',
  'gdrive.viewer.waitingToken': 'Google bekleniyor',
  'gdrive.viewer.waitingTokenHint':
    'Google oturumunuz geri geldiğinde bu dosya açılır.',
  'gdrive.viewer.failed': 'Bu dosya açılamadı',
  'gdrive.viewer.failedHint':
    'Google Drive yanıt vermedi. Bağlantıyı kontrol edip tekrar deneyin.',
  'gdrive.viewer.savingBeforeLeave': 'Ayrılmadan önce kaydediliyor…',

  'gdrive.status.saved': 'Google Drive’a kaydedildi',
  'gdrive.status.saving': 'Kaydediliyor…',
  'gdrive.status.failed': 'Kaydedilemedi',
  'gdrive.status.conflict': 'Google Drive’da değiştirildi',
  'gdrive.status.unconfirmed': 'Son kayıt doğrulanamadı',
  'gdrive.status.paused': 'Google yeniden bağlanana kadar duraklatıldı',
  'gdrive.status.deleted': 'Google Drive’da silindi',
  'gdrive.status.readonly': 'Yalnızca görüntüleme',
  'gdrive.status.waitingLeader': 'Bu dosyayı kaydeden sekme bekleniyor',
  'gdrive.status.waitingSnapshot': 'Bu dosyayı açan sekme bekleniyor',
  'gdrive.status.scopeMissing': 'Google Drive erişimi yok',

  'gdrive.banner.conflict':
    'Bu dosya Google Drive’da değişti, bu yüzden kaydetme durdu. Değişiklikleriniz hâlâ burada.',
  'gdrive.banner.unconfirmed':
    'Son kayıt doğrulanamadı, bu yüzden kaydetme durdu. Değişiklikleriniz hâlâ burada.',
  'gdrive.banner.deleted':
    'Bu dosya Google Drive’da silindi veya çöp kutusuna taşındı, bu yüzden kaydetme durdu.',
  'gdrive.banner.readonly':
    'Bu dosyayı artık Google Drive’da düzenleyemezsiniz, bu yüzden kaydetme durdu. Değişiklikleriniz hâlâ burada.',
  'gdrive.banner.checkDrive': 'Drive’ı kontrol et',
  'gdrive.banner.reloadFromDrive': 'Drive’dan yeniden yükle',
  'gdrive.banner.leaderNotResponding':
    'Bu dosyayı kaydeden sekme yanıt vermiyor.',
  'gdrive.banner.openerNotResponding': 'Bu dosyayı açan sekme yanıt vermiyor.',
  'gdrive.banner.takeOver': 'Kaydetmeyi devral',
  'gdrive.banner.openAndTakeOver': 'Drive’dan aç ve devral',
  'gdrive.banner.popupBlocked':
    'Tarayıcınız Google penceresini engelledi. Bu site için açılır pencerelere izin verin, ardından yeniden bağlanın.',
  'gdrive.banner.reconnectFailed': 'Google yeniden bağlanmadı. Tekrar deneyin.',
  'gdrive.banner.sessionEnded':
    'Google oturumunuz sona erdi, bu yüzden kaydetme duraklatıldı.',
  'gdrive.banner.sessionEndsSoon': 'Google oturumunuz yakında sona erecek.',
  'gdrive.banner.reconnect': 'Google’a yeniden bağlan',

  'gdrive.leave.title': 'Son değişiklikleriniz kaydedilmedi',
  'gdrive.leave.description':
    'ERD Editor bunları Google Drive’a kaydedemedi. Bir kopyasını tutmak için indirin ya da ayrılın ve onları kaybedin.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor bunları Google Drive’a kaydedemedi. Bir kopyasını tutmak için indirin ya da oturumu kapatın ve onları kaybedin.',
  'gdrive.leave.stay': 'Kal',
  'gdrive.leave.leaveAnyway': 'Yine de ayrıl',
  'gdrive.leave.signOutAnyway': 'Yine de oturumu kapat',

  'gdrive.create.title': 'Google Drive’da yeni dosya',
  'gdrive.create.inAppFolder': 'ERD Editor klasöründe',
  'gdrive.create.inFolderPending': 'Bir klasörde…',
  'gdrive.create.inHiddenFolder': 'ERD Editor’ün göremediği bir klasörde',
  'gdrive.create.inFolder': '“{name}” klasöründe',
  'gdrive.create.untitled': 'Adsız',
  'gdrive.create.savedAs': '{name} olarak kaydedilecek',
  'gdrive.create.folderRefused':
    'ERD Editor bu klasörde dosya oluşturamıyor. Bunun yerine ERD Editor klasöründe oluşturulsun mu?',
  'gdrive.create.failed': 'Dosya oluşturulamadı. Tekrar deneyin.',
  'gdrive.create.createInAppFolder': 'ERD Editor klasöründe oluştur',
  'gdrive.create.create': 'Oluştur',

  'gdrive.import.imported': {
    one: 'Google Drive’a {count} dosya aktarıldı',
    other: 'Google Drive’a {count} dosya aktarıldı',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} yedek atlandı: yedekler yerel uygulamada kalır',
    other: '{count} yedek atlandı: yedekler yerel uygulamada kalır',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} yükleme başarısız oldu',
    other: '{count} yükleme başarısız oldu',
  },

  'gdrive.notice.unreadableState':
    'Google Drive, ERD Editor’ün okuyamadığı bir bağlantı gönderdi',
  'gdrive.notice.renameFailed': 'Dosya yeniden adlandırılamadı',
  'gdrive.notice.createFailed': 'Dosya oluşturulamadı',
  'gdrive.notice.checkFailed': 'Google Drive’a ulaşılamadı. Tekrar deneyin.',
  'gdrive.notice.reloadFailed':
    'Google Drive’dan yeniden yüklenemedi. Tekrar deneyin.',
  'gdrive.notice.reloadTrashed':
    'Yeniden yüklenemedi: dosya Google Drive’da çöp kutusunda',
  'gdrive.notice.reloadTooLarge':
    'Yeniden yüklenemedi: Google Drive’daki dosya {size} MB’tan büyük',
  'gdrive.notice.reloadNotDocument':
    'Yeniden yüklenemedi: Google Drive’daki dosya artık bir ERD Editor belgesi değil',
  'gdrive.notice.signOutUnconfirmed':
    'Burada oturum kapatıldı. ERD Editor’ün sunucusu bunu doğrulamadı, bu yüzden bu tarayıcı bir sonraki bağlantıda oturumu kapatmayı tamamlar',
  'gdrive.notice.signOutNotRevoked':
    'Burada oturum kapatıldı ancak Google, ERD Editor’ün erişimini kaldırdığını doğrulamadı. Bu nedenle diğer cihazlarınız, erişimi myaccount.google.com/permissions adresinden kaldırana kadar oturum açık kalabilir',
} satisfies Messages;
