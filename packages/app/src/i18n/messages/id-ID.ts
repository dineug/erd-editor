import type { Messages } from '@/i18n/translate';

/** The app's own text in Indonesian, key for key as English writes it. */
export const idID = {
  'common.cancel': 'Batal',
  'common.close': 'Tutup',
  'common.dismiss': 'Tutup',
  'common.tryAgain': 'Coba lagi',
  'common.reload': 'Muat ulang',
  'common.loading': 'Memuat…',
  'common.search': 'Cari',
  'common.rename': 'Ganti nama',
  'common.importFiles': 'Impor file',
  'common.signOut': 'Logout',
  'common.downloadMyChanges': 'Unduh perubahan saya',
  'common.edited': 'Diedit {time}',
  'common.system': 'Sistem',
  'common.displayLanguage': 'Bahasa tampilan',
  'common.theme': 'Tema',
  'common.light': 'Terang',
  'common.dark': 'Gelap',
  'common.host': 'Host',
  'common.guest': 'Tamu',
  'common.you': '(Anda)',
  'common.participants': 'Peserta',
  'common.yourNickname': 'Nama panggilan Anda',
  'common.privacy': 'Privasi',
  'common.terms': 'Ketentuan',
  'common.editingGuide': 'Panduan Pengeditan',
  'common.openSidebar': 'Buka bilah samping',
  'common.closeSidebar': 'Tutup bilah samping',

  'time.justNow': 'baru saja',
  'time.today': 'Hari ini',
  'time.yesterday': 'Kemarin',
  'time.previous7Days': '7 Hari Terakhir',
  'time.previous30Days': '30 Hari Terakhir',

  'sidebar.schemas': 'Skema',
  'sidebar.newSchema': 'Skema baru',
  'sidebar.importAndExport': 'Impor dan ekspor',
  'sidebar.exportBackup': 'Ekspor cadangan',
  'sidebar.searchSchemas': 'Cari skema',
  'sidebar.newSchemaName': 'Nama skema baru',
  'sidebar.schemaName': 'Nama skema',
  'sidebar.schemaNamePlaceholder': 'nama skema',
  'sidebar.duplicate': 'Duplikat',
  'sidebar.moveToTrash': 'Pindahkan ke sampah',
  'sidebar.actionsFor': 'Tindakan untuk {name}',
  'sidebar.noResults': 'Tidak ada hasil',

  'trash.button': 'Sampah ({count})',
  'trash.title': 'Sampah',
  'trash.description': {
    other: 'Skema di sampah dihapus permanen setelah {count} hari.',
  },
  'trash.listLabel': 'Skema di sampah',
  'trash.deleted': 'Dihapus {time}',
  'trash.deletesToday': 'dihapus hari ini',
  'trash.deletesTomorrow': 'dihapus besok',
  'trash.deletesIn': { other: 'dihapus dalam {count} hari' },
  'trash.restore': 'Pulihkan',
  'trash.deletePermanently': 'Hapus permanen',
  'trash.cannotBeUndone': 'Tindakan ini tidak dapat dibatalkan.',
  'trash.delete': 'Hapus',
  'trash.empty': 'Sampah kosong.',
  'trash.emptyTrash': 'Kosongkan sampah',
  'trash.emptyConfirm': {
    other:
      'Hapus {count} skema secara permanen? Tindakan ini tidak dapat dibatalkan.',
  },

  'collaboration.for': 'Kolaborasi untuk {name}',
  'collaboration.guestsConnected': { other: '{count} tamu terhubung' },
  'collaboration.title': 'Pengeditan kolaboratif',
  'collaboration.experiment': 'Eksperimen',
  'collaboration.description':
    'Peserta terhubung langsung melalui WebRTC dan bertukar pesan dengan enkripsi end-to-end.',
  'collaboration.nickname': 'Nama panggilan',
  'collaboration.link': 'Tautan',
  'collaboration.noOneJoined': 'Belum ada orang lain yang bergabung.',
  'collaboration.startSession': 'Mulai sesi',
  'collaboration.stopSession': 'Hentikan sesi',

  'viewer.noSchemaOpen': 'Tidak ada skema yang terbuka',
  'viewer.emptyHint':
    'Pilih satu dari bilah samping, atau mulai yang baru di sini. Anda juga dapat meletakkan file di mana saja untuk mengimpornya.',
  'viewer.openSample': 'Buka contoh',
  'viewer.sampleName': 'contoh toko buku',

  'drop.title': 'Letakkan untuk mengimpor',
  'drop.formats':
    'Cadangan, dokumen .erd, .vuerd, dan .json, SQL, DBML, AML, dan GraphQL',
  'drop.importing': 'Mengimpor file…',
  'drop.importingHint': 'Letakkan lagi setelah impor ini selesai',

  'import.imported': { other: '{count} skema diimpor' },
  'import.skippedInvalidFiles': { other: '{count} file tidak valid dilewati' },
  'import.skippedInvalidSchemas': {
    other: '{count} skema tidak valid dilewati',
  },
  'import.skippedOversized': {
    other: '{count} file di atas {size} MB dilewati',
  },
  'import.nothing': 'Tidak ada yang diimpor',
  'import.failed': 'Impor gagal',
  'import.exportFailed': 'Ekspor gagal',

  'update.available': 'Versi baru ERD Editor tersedia.',
  'update.updatedElsewhere':
    'Aplikasi diperbarui di tab lain — muat ulang untuk menyelesaikan.',

  'live.invalidToken': 'Token berbagi tidak valid.',
  'live.hostNotFound': 'Host tidak ditemukan.',
  'live.refresh': 'Segarkan',
  'live.hostStopped': 'Host menghentikan sesi.',
  'live.somethingWentWrong': 'Terjadi kesalahan.',
  'live.lookingForHost': 'Mencari host...',
  'live.waitingForHost': 'Menunggu host...',
  'live.session': 'Sesi langsung',
  'live.inSession': { other: '{count} dalam sesi' },
  'live.showParticipants': 'Tampilkan peserta',
  'live.hideParticipants': 'Sembunyikan peserta',

  'gdrive.checkingSignIn': 'Memeriksa login Google Anda…',
  'gdrive.anotherAccount': 'akun lain',
  'gdrive.offline.title': 'Anda sedang offline',
  'gdrive.offline.description':
    'ERD Editor memeriksa login Google Anda setelah Anda kembali online.',
  'gdrive.scopeMissing.title': 'Akses Google Drive tidak diberikan',
  'gdrive.scopeMissing.description':
    'ERD Editor memerlukan akses ke file yang Anda buat atau buka dengannya. Login lagi dan izinkan akses Google Drive.',
  'gdrive.mismatch.title': 'Google Drive mengirim ini untuk akun lain',
  'gdrive.mismatch.description':
    'Anda login sebagai {email}. Beralihlah ke akun yang digunakan Google Drive untuk membukanya, atau lanjutkan dengan file akun ini.',
  'gdrive.mismatch.choose':
    'ERD Editor tidak dapat memilih akun itu terlebih dahulu, jadi pilihlah saat Google bertanya.',
  'gdrive.mismatch.switchAccount': 'Ganti akun',
  'gdrive.mismatch.showMyFiles': 'Tampilkan file saya',
  'gdrive.accountChanged.title': 'Login dengan akun lain',
  'gdrive.accountChanged.description':
    'Tab lain login ke akun Google yang berbeda, jadi tab ini berhenti. Muat ulang untuk melanjutkan dengan akun itu.',
  'gdrive.unsaved.title': 'Perubahan Anda belum disimpan',
  'gdrive.unsaved.description':
    '{name} memiliki perubahan dari {email} yang tidak ada di Google Drive, dan {account} kini sedang login. Unduh perubahan itu sebelum melanjutkan.',
  'gdrive.unsaved.descriptionUnnamed':
    'File yang Anda buka memiliki perubahan dari {email} yang tidak ada di Google Drive, dan {account} kini sedang login. Unduh perubahan itu sebelum melanjutkan.',
  'gdrive.unsaved.continueWithout': 'Lanjutkan tanpa perubahan itu',
  'gdrive.framed.title':
    'Buka editor Google Drive ERD Editor di tabnya sendiri',
  'gdrive.framed.description':
    'Editor ini tidak berjalan di dalam halaman lain.',
  'gdrive.framed.link': 'Buka di tab baru',
  'gdrive.notConfigured.title': 'Integrasi Google Drive belum dikonfigurasi',
  'gdrive.notConfigured.description':
    'Build ERD Editor ini tidak memiliki klien login Google.',
  'gdrive.unsupportedOrigin.title': 'Google Drive tidak tersedia di sini',
  'gdrive.unsupportedOrigin.description':
    'Login Google hanya berfungsi di erd-editor.io, dan ini adalah pratinjau.',

  'gdrive.signIn.title': 'Buka file ERD Anda di Google Drive',
  'gdrive.signIn.description':
    'ERD Editor hanya membuka dan menyimpan file yang Anda buat atau buka dengannya.',
  'gdrive.signIn.fallbackDescription':
    'Server login ERD Editor sedang sibuk, jadi Google membuat Anda login selama satu jam setiap kali.',
  'gdrive.signIn.signIn': 'Login dengan Google',
  'gdrive.signIn.continue': 'Lanjutkan dengan Google',
  'gdrive.signIn.waitingTitle': 'Menunggu login Google…',
  'gdrive.signIn.waitingDescription':
    'Selesaikan login di jendela yang dibuka Google.',
  'gdrive.signIn.popupBlocked':
    'Browser Anda memblokir jendela login. Izinkan pop-up untuk situs ini, lalu coba lagi.',
  'gdrive.signIn.failed': 'Login Google tidak selesai. Coba lagi.',
  'gdrive.signIn.gisBlocked':
    'Login Google tidak dapat dimuat. Pastikan tidak ada yang memblokir accounts.google.com, lalu muat ulang halaman.',

  'gdrive.sidebar.label': 'File Drive',
  'gdrive.sidebar.newFile': 'File baru',
  'gdrive.sidebar.import': 'Impor',
  'gdrive.sidebar.searchFiles': 'Cari file',
  'gdrive.sidebar.newFileName': 'Nama file baru',
  'gdrive.sidebar.fileName': 'Nama file',
  'gdrive.sidebar.fileNamePlaceholder': 'nama file',
  'gdrive.sidebar.loadingFiles': 'Memuat file…',
  'gdrive.sidebar.loadFailed': 'Tidak dapat memuat file Anda.',

  'gdrive.viewer.noFileOpen': 'Tidak ada file yang terbuka',
  'gdrive.viewer.noFileOpenHint':
    'Pilih file dari bilah samping, atau mulai yang baru.',
  'gdrive.viewer.noFilesYet': 'Belum ada file',
  'gdrive.viewer.noFilesYetHint':
    'Buat file atau impor satu. File yang Anda buka dengan ERD Editor dari Google Drive juga muncul di sini.',
  'gdrive.viewer.waitingForOpener': 'Menunggu tab yang membuka file ini…',
  'gdrive.viewer.notDocument': 'File ini bukan dokumen ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor membuka diagram yang disimpannya sendiri. File ini dibiarkan apa adanya dan tidak pernah ditimpa.',
  'gdrive.viewer.googleNativeHint':
    'Google Dokumen, Spreadsheet, dan folder dibuka di Google Drive.',
  'gdrive.viewer.trashed': 'File ini ada di sampah',
  'gdrive.viewer.trashedHint':
    'Pulihkan di Google Drive untuk membukanya di sini.',
  'gdrive.viewer.tooLarge': 'File ini terlalu besar',
  'gdrive.viewer.tooLargeHint': 'ERD Editor membuka file hingga {size} MB.',
  'gdrive.viewer.notFound': 'File ini tidak tersedia',
  'gdrive.viewer.notFoundHint':
    'File mungkin telah dihapus, atau akun Google ini tidak dapat membukanya.',
  'gdrive.viewer.waitingToken': 'Menunggu Google',
  'gdrive.viewer.waitingTokenHint':
    'File ini terbuka setelah sesi Google Anda kembali.',
  'gdrive.viewer.failed': 'Tidak dapat membuka file ini',
  'gdrive.viewer.failedHint':
    'Google Drive tidak menjawab. Periksa koneksi dan coba lagi.',
  'gdrive.viewer.savingBeforeLeave': 'Menyimpan sebelum Anda pergi…',

  'gdrive.status.saved': 'Disimpan ke Google Drive',
  'gdrive.status.saving': 'Menyimpan…',
  'gdrive.status.failed': 'Tidak dapat menyimpan',
  'gdrive.status.conflict': 'Diubah di Google Drive',
  'gdrive.status.unconfirmed': 'Tidak dapat mengonfirmasi penyimpanan terakhir',
  'gdrive.status.paused': 'Dijeda hingga Google terhubung kembali',
  'gdrive.status.deleted': 'Dihapus di Google Drive',
  'gdrive.status.readonly': 'Hanya lihat',
  'gdrive.status.waitingLeader': 'Menunggu tab yang menyimpan file ini',
  'gdrive.status.waitingSnapshot': 'Menunggu tab yang membuka file ini',
  'gdrive.status.scopeMissing': 'Tidak ada akses Google Drive',

  'gdrive.banner.conflict':
    'File ini berubah di Google Drive, jadi penyimpanan berhenti. Perubahan Anda masih ada di sini.',
  'gdrive.banner.unconfirmed':
    'Penyimpanan terakhir tidak dapat dikonfirmasi, jadi penyimpanan berhenti. Perubahan Anda masih ada di sini.',
  'gdrive.banner.deleted':
    'File ini dihapus atau dipindahkan ke sampah di Google Drive, jadi penyimpanan berhenti.',
  'gdrive.banner.readonly':
    'Anda tidak dapat lagi mengedit file ini di Google Drive, jadi penyimpanan berhenti. Perubahan Anda masih ada di sini.',
  'gdrive.banner.checkDrive': 'Periksa Drive',
  'gdrive.banner.reloadFromDrive': 'Muat ulang dari Drive',
  'gdrive.banner.leaderNotResponding':
    'Tab yang menyimpan file ini tidak merespons.',
  'gdrive.banner.openerNotResponding':
    'Tab yang membuka file ini tidak merespons.',
  'gdrive.banner.takeOver': 'Ambil alih penyimpanan',
  'gdrive.banner.openAndTakeOver': 'Buka dari Drive dan ambil alih',
  'gdrive.banner.popupBlocked':
    'Browser Anda memblokir jendela Google. Izinkan pop-up untuk situs ini, lalu hubungkan kembali.',
  'gdrive.banner.reconnectFailed': 'Google tidak terhubung kembali. Coba lagi.',
  'gdrive.banner.sessionEnded':
    'Sesi Google Anda berakhir, jadi penyimpanan dijeda.',
  'gdrive.banner.sessionEndsSoon': 'Sesi Google Anda segera berakhir.',
  'gdrive.banner.reconnect': 'Hubungkan kembali Google',

  'gdrive.leave.title': 'Perubahan terbaru Anda belum disimpan',
  'gdrive.leave.description':
    'ERD Editor tidak dapat menyimpannya ke Google Drive. Unduh untuk menyimpan salinan, atau pergi dan kehilangannya.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor tidak dapat menyimpannya ke Google Drive. Unduh untuk menyimpan salinan, atau logout dan kehilangannya.',
  'gdrive.leave.stay': 'Tetap di sini',
  'gdrive.leave.leaveAnyway': 'Tetap pergi',
  'gdrive.leave.signOutAnyway': 'Tetap logout',

  'gdrive.create.title': 'File baru di Google Drive',
  'gdrive.create.inAppFolder': 'Di folder ERD Editor',
  'gdrive.create.inFolderPending': 'Di sebuah folder…',
  'gdrive.create.inHiddenFolder':
    'Di folder yang tidak dapat dilihat ERD Editor',
  'gdrive.create.inFolder': 'Di folder “{name}”',
  'gdrive.create.untitled': 'Tanpa judul',
  'gdrive.create.savedAs': 'Disimpan sebagai {name}',
  'gdrive.create.folderRefused':
    'ERD Editor tidak dapat membuat file di folder ini. Buat di folder ERD Editor saja?',
  'gdrive.create.failed': 'Tidak dapat membuat file. Coba lagi.',
  'gdrive.create.createInAppFolder': 'Buat di folder ERD Editor',
  'gdrive.create.create': 'Buat',

  'gdrive.import.imported': {
    other: '{count} file diimpor ke Google Drive',
  },
  'gdrive.import.skippedBackups': {
    other: '{count} cadangan dilewati: cadangan tetap di aplikasi lokal',
  },
  'gdrive.import.uploadsFailed': { other: '{count} unggahan gagal' },

  'gdrive.notice.unreadableState':
    'Google Drive mengirim tautan yang tidak dapat dibaca ERD Editor',
  'gdrive.notice.renameFailed': 'Tidak dapat mengganti nama file',
  'gdrive.notice.createFailed': 'Tidak dapat membuat file',
  'gdrive.notice.checkFailed':
    'Tidak dapat menjangkau Google Drive. Coba lagi.',
  'gdrive.notice.reloadFailed':
    'Tidak dapat memuat ulang dari Google Drive. Coba lagi.',
  'gdrive.notice.reloadTrashed':
    'Tidak dapat memuat ulang: file ada di sampah Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Tidak dapat memuat ulang: file di Google Drive lebih dari {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Tidak dapat memuat ulang: file di Google Drive bukan lagi dokumen ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Logout di sini. Server ERD Editor tidak mengonfirmasinya, jadi browser ini menyelesaikan logout saat terhubung lagi',
  'gdrive.notice.signOutNotRevoked':
    'Logout di sini, tetapi Google tidak mengonfirmasi bahwa akses ERD Editor telah dihapus, jadi perangkat Anda yang lain mungkin tetap login hingga Anda menghapusnya di myaccount.google.com/permissions',
} satisfies Messages;
