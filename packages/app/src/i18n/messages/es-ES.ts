import type { Messages } from '@/i18n/translate';

/** The app's own text in Spanish, key for key as English writes it. */
export const esES = {
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.dismiss': 'Cerrar',
  'common.tryAgain': 'Reintentar',
  'common.reload': 'Recargar',
  'common.loading': 'Cargando…',
  'common.search': 'Buscar',
  'common.rename': 'Cambiar nombre',
  'common.importFiles': 'Importar archivos',
  'common.signOut': 'Cerrar sesión',
  'common.downloadMyChanges': 'Descargar mis cambios',
  'common.edited': 'Editado {time}',
  'common.system': 'Sistema',
  'common.displayLanguage': 'Idioma de la interfaz',
  'common.theme': 'Tema',
  'common.light': 'Claro',
  'common.dark': 'Oscuro',
  'common.host': 'Anfitrión',
  'common.guest': 'Invitado',
  'common.you': '(tú)',
  'common.participants': 'Participantes',
  'common.yourNickname': 'Tu apodo',
  'common.privacy': 'Privacidad',
  'common.terms': 'Términos',
  'common.editingGuide': 'Guía de edición',
  'common.openSidebar': 'Abrir barra lateral',
  'common.closeSidebar': 'Cerrar barra lateral',

  'time.justNow': 'ahora mismo',
  'time.today': 'Hoy',
  'time.yesterday': 'Ayer',
  'time.previous7Days': 'Últimos 7 días',
  'time.previous30Days': 'Últimos 30 días',

  'sidebar.schemas': 'Esquemas',
  'sidebar.newSchema': 'Nuevo esquema',
  'sidebar.importAndExport': 'Importar y exportar',
  'sidebar.exportBackup': 'Exportar copia de seguridad',
  'sidebar.searchSchemas': 'Buscar esquemas',
  'sidebar.newSchemaName': 'Nombre del nuevo esquema',
  'sidebar.schemaName': 'Nombre del esquema',
  'sidebar.schemaNamePlaceholder': 'nombre del esquema',
  'sidebar.duplicate': 'Duplicar',
  'sidebar.moveToTrash': 'Mover a la papelera',
  'sidebar.actionsFor': 'Acciones de {name}',
  'sidebar.noResults': 'Sin resultados',

  'trash.button': 'Papelera ({count})',
  'trash.title': 'Papelera',
  'trash.description': {
    one: 'Los esquemas de la papelera se eliminan definitivamente tras {count} día.',
    many: 'Los esquemas de la papelera se eliminan definitivamente tras {count} de días.',
    other:
      'Los esquemas de la papelera se eliminan definitivamente tras {count} días.',
  },
  'trash.listLabel': 'Esquemas en la papelera',
  'trash.deleted': 'Eliminado {time}',
  'trash.deletesToday': 'se elimina hoy',
  'trash.deletesTomorrow': 'se elimina mañana',
  'trash.deletesIn': {
    one: 'se elimina en {count} día',
    many: 'se elimina en {count} de días',
    other: 'se elimina en {count} días',
  },
  'trash.restore': 'Restaurar',
  'trash.deletePermanently': 'Eliminar definitivamente',
  'trash.cannotBeUndone': 'Esta acción no se puede deshacer.',
  'trash.delete': 'Eliminar',
  'trash.empty': 'La papelera está vacía.',
  'trash.emptyTrash': 'Vaciar papelera',
  'trash.emptyConfirm': {
    one: '¿Eliminar definitivamente {count} esquema? Esta acción no se puede deshacer.',
    many: '¿Eliminar definitivamente {count} de esquemas? Esta acción no se puede deshacer.',
    other:
      '¿Eliminar definitivamente {count} esquemas? Esta acción no se puede deshacer.',
  },

  'collaboration.for': 'Colaboración en {name}',
  'collaboration.guestsConnected': {
    one: '{count} invitado conectado',
    many: '{count} de invitados conectados',
    other: '{count} invitados conectados',
  },
  'collaboration.title': 'Edición colaborativa',
  'collaboration.experiment': 'Experimental',
  'collaboration.description':
    'Los participantes se conectan directamente mediante WebRTC e intercambian mensajes con cifrado de extremo a extremo.',
  'collaboration.nickname': 'Apodo',
  'collaboration.link': 'Enlace',
  'collaboration.noOneJoined': 'Todavía no se ha unido nadie más.',
  'collaboration.startSession': 'Empezar sesión',
  'collaboration.stopSession': 'Detener sesión',

  'viewer.noSchemaOpen': 'Ningún esquema abierto',
  'viewer.emptyHint':
    'Elige uno en la barra lateral o empieza uno aquí. También puedes soltar archivos en cualquier lugar para importarlos.',
  'viewer.openSample': 'Abrir ejemplo',
  'viewer.sampleName': 'ejemplo de librería',

  'drop.title': 'Suelta para importar',
  'drop.formats':
    'Copias de seguridad, documentos .erd, .vuerd y .json, SQL, DBML, AML y GraphQL',
  'drop.importing': 'Importando archivos…',
  'drop.importingHint': 'Suelta más cuando termine esta importación',

  'import.imported': {
    one: '{count} esquema importado',
    many: '{count} de esquemas importados',
    other: '{count} esquemas importados',
  },
  'import.skippedInvalidFiles': {
    one: '{count} archivo no válido omitido',
    many: '{count} de archivos no válidos omitidos',
    other: '{count} archivos no válidos omitidos',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} esquema no válido omitido',
    many: '{count} de esquemas no válidos omitidos',
    other: '{count} esquemas no válidos omitidos',
  },
  'import.skippedOversized': {
    one: '{count} archivo de más de {size} MB omitido',
    many: '{count} de archivos de más de {size} MB omitidos',
    other: '{count} archivos de más de {size} MB omitidos',
  },
  'import.nothing': 'Nada que importar',
  'import.failed': 'Error al importar',
  'import.exportFailed': 'Error al exportar',

  'update.available': 'Hay una nueva versión de ERD Editor disponible.',
  'update.updatedElsewhere':
    'La aplicación se actualizó en otra pestaña: recarga para terminar.',

  'embed.title': 'Insertar un diagrama',
  'embed.documentUrl': 'URL del documento',
  'embed.fetchUrl': 'Se carga desde',
  'embed.nameView': 'Vista de nombres',
  'embed.nameAsSaved': 'Como se guardó',
  'embed.physicalNames': 'Nombres físicos',
  'embed.logicalNames': 'Nombres lógicos',
  'embed.bothNames': 'Ambos nombres',
  'embed.accentColor': 'Color de énfasis',
  'embed.grayColor': 'Tono de gris',
  'embed.minimap': 'Minimapa',
  'embed.controls': 'Controles',
  'embed.height': 'Altura',
  'embed.preview': 'Vista previa',
  'embed.embedUrl': 'URL para insertar',
  'embed.embedCode': 'Código para insertar',
  'embed.copy': 'Copiar',
  'embed.copied': 'Copiado',

  'live.invalidToken': 'Enlace compartido no válido.',
  'live.hostNotFound': 'No se encontró el anfitrión.',
  'live.refresh': 'Actualizar',
  'live.hostStopped': 'El anfitrión detuvo la sesión.',
  'live.somethingWentWrong': 'Algo salió mal.',
  'live.lookingForHost': 'Buscando al anfitrión...',
  'live.waitingForHost': 'Esperando al anfitrión...',
  'live.session': 'Sesión en directo',
  'live.inSession': {
    one: '{count} en la sesión',
    many: '{count} en la sesión',
    other: '{count} en la sesión',
  },
  'live.showParticipants': 'Mostrar participantes',
  'live.hideParticipants': 'Ocultar participantes',

  'gdrive.checkingSignIn': 'Comprobando tu inicio de sesión de Google…',
  'gdrive.anotherAccount': 'otra cuenta',
  'gdrive.offline.title': 'No tienes conexión',
  'gdrive.offline.description':
    'ERD Editor comprobará tu inicio de sesión de Google cuando vuelvas a estar en línea.',
  'gdrive.scopeMissing.title': 'No se concedió acceso a Google Drive',
  'gdrive.scopeMissing.description':
    'ERD Editor necesita acceso a los archivos que creas o abres con él. Vuelve a iniciar sesión y permite el acceso a Google Drive.',
  'gdrive.mismatch.title': 'Google Drive envió esto para otra cuenta',
  'gdrive.mismatch.description':
    'Has iniciado sesión como {email}. Cambia a la cuenta con la que Google Drive lo abrió o sigue con los archivos de esta cuenta.',
  'gdrive.mismatch.choose':
    'ERD Editor no pudo preseleccionar esa cuenta, así que elígela cuando Google te lo pida.',
  'gdrive.mismatch.switchAccount': 'Cambiar de cuenta',
  'gdrive.mismatch.showMyFiles': 'Mostrar mis archivos',
  'gdrive.accountChanged.title': 'Sesión iniciada con otra cuenta',
  'gdrive.accountChanged.description':
    'Otra pestaña inició sesión en otra cuenta de Google, así que esta pestaña se detuvo. Recárgala para continuar con esa cuenta.',
  'gdrive.unsaved.title': 'Tus cambios no se guardaron',
  'gdrive.unsaved.description':
    '{name} tiene cambios de {email} que no están en Google Drive, y ahora la sesión es de {account}. Descárgalos antes de continuar.',
  'gdrive.unsaved.descriptionUnnamed':
    'El archivo que tenías abierto tiene cambios de {email} que no están en Google Drive, y ahora la sesión es de {account}. Descárgalos antes de continuar.',
  'gdrive.unsaved.continueWithout': 'Continuar sin ellos',
  'gdrive.framed.title':
    'Abre el editor de Google Drive de ERD Editor en su propia pestaña',
  'gdrive.framed.description': 'No funciona dentro de otra página.',
  'gdrive.framed.link': 'Abrir en una pestaña nueva',
  'gdrive.notConfigured.title':
    'La integración con Google Drive no está configurada',
  'gdrive.notConfigured.description':
    'Esta compilación de ERD Editor no tiene cliente de inicio de sesión de Google.',
  'gdrive.unsupportedOrigin.title': 'Google Drive no está disponible aquí',
  'gdrive.unsupportedOrigin.description':
    'El inicio de sesión de Google solo funciona en erd-editor.io, y esto es una vista previa.',

  'gdrive.signIn.title': 'Abre tus archivos ERD de Google Drive',
  'gdrive.signIn.description':
    'ERD Editor solo abre y guarda los archivos que creas o abres con él.',
  'gdrive.signIn.fallbackDescription':
    'El servidor de inicio de sesión de ERD Editor está ocupado, así que cada inicio de sesión con Google dura una hora.',
  'gdrive.signIn.signIn': 'Iniciar sesión con Google',
  'gdrive.signIn.continue': 'Continuar con Google',
  'gdrive.signIn.waitingTitle': 'Esperando el inicio de sesión de Google…',
  'gdrive.signIn.waitingDescription':
    'Termina de iniciar sesión en la ventana que abrió Google.',
  'gdrive.signIn.popupBlocked':
    'Tu navegador bloqueó la ventana de inicio de sesión. Permite las ventanas emergentes de este sitio e inténtalo de nuevo.',
  'gdrive.signIn.failed':
    'El inicio de sesión de Google no terminó. Inténtalo de nuevo.',
  'gdrive.signIn.gisBlocked':
    'No se pudo cargar el inicio de sesión de Google. Comprueba que nada bloquee accounts.google.com y vuelve a cargar la página.',

  'gdrive.sidebar.label': 'Archivos de Drive',
  'gdrive.sidebar.newFile': 'Nuevo archivo',
  'gdrive.sidebar.import': 'Importar',
  'gdrive.sidebar.searchFiles': 'Buscar archivos',
  'gdrive.sidebar.newFileName': 'Nombre del nuevo archivo',
  'gdrive.sidebar.fileName': 'Nombre del archivo',
  'gdrive.sidebar.fileNamePlaceholder': 'nombre del archivo',
  'gdrive.sidebar.loadingFiles': 'Cargando archivos…',
  'gdrive.sidebar.loadFailed': 'No se pudieron cargar tus archivos.',

  'gdrive.viewer.noFileOpen': 'Ningún archivo abierto',
  'gdrive.viewer.noFileOpenHint':
    'Elige un archivo en la barra lateral o empieza uno nuevo.',
  'gdrive.viewer.noFilesYet': 'Aún no hay archivos',
  'gdrive.viewer.noFilesYetHint':
    'Crea un archivo o importa uno. Los archivos que abras con ERD Editor desde Google Drive también aparecen aquí.',
  'gdrive.viewer.waitingForOpener':
    'Esperando a la pestaña que abrió este archivo…',
  'gdrive.viewer.notDocument': 'Este archivo no es un documento de ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor abre los diagramas que ha guardado él mismo. Deja este archivo tal como está y nunca lo sobrescribe.',
  'gdrive.viewer.googleNativeHint':
    'Los documentos, hojas de cálculo y carpetas de Google se abren en Google Drive.',
  'gdrive.viewer.trashed': 'Este archivo está en la papelera',
  'gdrive.viewer.trashedHint': 'Restáuralo en Google Drive para abrirlo aquí.',
  'gdrive.viewer.tooLarge': 'Este archivo es demasiado grande',
  'gdrive.viewer.tooLargeHint': 'ERD Editor abre archivos de hasta {size} MB.',
  'gdrive.viewer.notFound': 'Este archivo no está disponible',
  'gdrive.viewer.notFoundHint':
    'Puede que se haya eliminado o que esta cuenta de Google no pueda abrirlo.',
  'gdrive.viewer.waitingToken': 'Esperando a Google',
  'gdrive.viewer.waitingTokenHint':
    'Este archivo se abrirá cuando se restablezca tu sesión de Google.',
  'gdrive.viewer.failed': 'No se pudo abrir este archivo',
  'gdrive.viewer.failedHint':
    'Google Drive no respondió. Comprueba la conexión e inténtalo de nuevo.',
  'gdrive.viewer.savingBeforeLeave': 'Guardando antes de salir…',

  'gdrive.status.saved': 'Guardado en Google Drive',
  'gdrive.status.saving': 'Guardando…',
  'gdrive.status.failed': 'No se pudo guardar',
  'gdrive.status.conflict': 'Modificado en Google Drive',
  'gdrive.status.unconfirmed': 'No se pudo confirmar el último guardado',
  'gdrive.status.paused': 'En pausa hasta que Google se vuelva a conectar',
  'gdrive.status.deleted': 'Eliminado en Google Drive',
  'gdrive.status.readonly': 'Solo lectura',
  'gdrive.status.waitingLeader':
    'Esperando a la pestaña que guarda este archivo',
  'gdrive.status.waitingSnapshot':
    'Esperando a la pestaña que abrió este archivo',
  'gdrive.status.scopeMissing': 'Sin acceso a Google Drive',

  'gdrive.banner.conflict':
    'Este archivo cambió en Google Drive, así que se detuvo el guardado. Tus cambios siguen aquí.',
  'gdrive.banner.unconfirmed':
    'No se pudo confirmar el último guardado, así que se detuvo el guardado. Tus cambios siguen aquí.',
  'gdrive.banner.deleted':
    'Este archivo se eliminó o se movió a la papelera en Google Drive, así que se detuvo el guardado.',
  'gdrive.banner.readonly':
    'Ya no puedes editar este archivo en Google Drive, así que se detuvo el guardado. Tus cambios siguen aquí.',
  'gdrive.banner.checkDrive': 'Comprobar Drive',
  'gdrive.banner.reloadFromDrive': 'Recargar desde Drive',
  'gdrive.banner.leaderNotResponding':
    'La pestaña que guarda este archivo no responde.',
  'gdrive.banner.openerNotResponding':
    'La pestaña que abrió este archivo no responde.',
  'gdrive.banner.takeOver': 'Encargarse del guardado',
  'gdrive.banner.openAndTakeOver': 'Abrir desde Drive y encargarse',
  'gdrive.banner.popupBlocked':
    'Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes de este sitio y vuelve a conectar.',
  'gdrive.banner.reconnectFailed':
    'No se pudo volver a conectar con Google. Inténtalo de nuevo.',
  'gdrive.banner.sessionEnded':
    'Tu sesión de Google terminó, así que el guardado está en pausa.',
  'gdrive.banner.sessionEndsSoon': 'Tu sesión de Google termina pronto.',
  'gdrive.banner.reconnect': 'Volver a conectar Google',

  'gdrive.leave.title': 'Tus últimos cambios no están guardados',
  'gdrive.leave.description':
    'ERD Editor no pudo guardarlos en Google Drive. Descárgalos para conservar una copia, o sal y piérdelos.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor no pudo guardarlos en Google Drive. Descárgalos para conservar una copia, o cierra sesión y piérdelos.',
  'gdrive.leave.stay': 'Quedarse',
  'gdrive.leave.leaveAnyway': 'Salir de todos modos',
  'gdrive.leave.signOutAnyway': 'Cerrar sesión de todos modos',

  'gdrive.create.title': 'Nuevo archivo en Google Drive',
  'gdrive.create.inAppFolder': 'En la carpeta ERD Editor',
  'gdrive.create.inFolderPending': 'En una carpeta…',
  'gdrive.create.inHiddenFolder': 'En una carpeta que ERD Editor no puede ver',
  'gdrive.create.inFolder': 'En la carpeta «{name}»',
  'gdrive.create.untitled': 'Sin título',
  'gdrive.create.savedAs': 'Se guardará como {name}',
  'gdrive.create.folderRefused':
    'ERD Editor no puede crear archivos en esta carpeta. ¿Crearlo en la carpeta ERD Editor?',
  'gdrive.create.failed': 'No se pudo crear el archivo. Inténtalo de nuevo.',
  'gdrive.create.createInAppFolder': 'Crear en la carpeta ERD Editor',
  'gdrive.create.create': 'Crear',

  'gdrive.import.imported': {
    one: '{count} archivo importado a Google Drive',
    many: '{count} de archivos importados a Google Drive',
    other: '{count} archivos importados a Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} copia de seguridad omitida: las copias de seguridad se quedan en la aplicación local',
    many: '{count} de copias de seguridad omitidas: las copias de seguridad se quedan en la aplicación local',
    other:
      '{count} copias de seguridad omitidas: las copias de seguridad se quedan en la aplicación local',
  },
  'gdrive.import.uploadsFailed': {
    one: 'Falló {count} subida',
    many: 'Fallaron {count} de subidas',
    other: 'Fallaron {count} subidas',
  },

  'gdrive.notice.unreadableState':
    'Google Drive envió un enlace que ERD Editor no pudo leer',
  'gdrive.notice.renameFailed': 'No se pudo cambiar el nombre del archivo',
  'gdrive.notice.createFailed': 'No se pudo crear el archivo',
  'gdrive.notice.checkFailed':
    'No se pudo conectar con Google Drive. Inténtalo de nuevo.',
  'gdrive.notice.reloadFailed':
    'No se pudo recargar desde Google Drive. Inténtalo de nuevo.',
  'gdrive.notice.reloadTrashed':
    'No se pudo recargar: el archivo está en la papelera de Google Drive',
  'gdrive.notice.reloadTooLarge':
    'No se pudo recargar: el archivo de Google Drive supera los {size} MB',
  'gdrive.notice.reloadNotDocument':
    'No se pudo recargar: el archivo de Google Drive ya no es un documento de ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Sesión cerrada aquí. El servidor de ERD Editor no lo confirmó, así que este navegador terminará de cerrar la sesión la próxima vez que se conecte',
  'gdrive.notice.signOutNotRevoked':
    'Sesión cerrada aquí, pero Google no confirmó haber retirado el acceso de ERD Editor, así que tus otros dispositivos podrían seguir con la sesión iniciada hasta que lo retires en myaccount.google.com/permissions',
} satisfies Messages;
