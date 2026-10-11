import type { Messages } from '@/i18n/translate';

/** The app's own text in European Portuguese, key for key as English writes it. */
export const ptPT = {
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.dismiss': 'Fechar',
  'common.tryAgain': 'Tentar novamente',
  'common.reload': 'Recarregar',
  'common.loading': 'A carregar…',
  'common.search': 'Pesquisar',
  'common.rename': 'Mudar o nome',
  'common.importFiles': 'Importar ficheiros',
  'common.signOut': 'Terminar sessão',
  'common.downloadMyChanges': 'Transferir as minhas alterações',
  'common.edited': 'Editado {time}',
  'common.system': 'Sistema',
  'common.displayLanguage': 'Idioma de apresentação',
  'common.theme': 'Tema',
  'common.light': 'Claro',
  'common.dark': 'Escuro',
  'common.host': 'Anfitrião',
  'common.guest': 'Convidado',
  'common.you': '(você)',
  'common.participants': 'Participantes',
  'common.yourNickname': 'A sua alcunha',
  'common.privacy': 'Privacidade',
  'common.terms': 'Termos',
  'common.editingGuide': 'Guia de edição',
  'common.openSidebar': 'Abrir barra lateral',
  'common.closeSidebar': 'Fechar barra lateral',

  'time.justNow': 'agora mesmo',
  'time.today': 'Hoje',
  'time.yesterday': 'Ontem',
  'time.previous7Days': 'Últimos 7 dias',
  'time.previous30Days': 'Últimos 30 dias',

  'sidebar.schemas': 'Esquemas',
  'sidebar.newSchema': 'Novo esquema',
  'sidebar.importAndExport': 'Importar e exportar',
  'sidebar.exportBackup': 'Exportar cópia de segurança',
  'sidebar.searchSchemas': 'Pesquisar esquemas',
  'sidebar.newSchemaName': 'Nome do novo esquema',
  'sidebar.schemaName': 'Nome do esquema',
  'sidebar.schemaNamePlaceholder': 'nome do esquema',
  'sidebar.duplicate': 'Duplicar',
  'sidebar.moveToTrash': 'Mover para o lixo',
  'sidebar.actionsFor': 'Ações de {name}',
  'sidebar.noResults': 'Sem resultados',

  'trash.button': 'Lixo ({count})',
  'trash.title': 'Lixo',
  'trash.description': {
    one: 'Os esquemas no lixo são eliminados definitivamente após {count} dia.',
    many: 'Os esquemas no lixo são eliminados definitivamente após {count} de dias.',
    other:
      'Os esquemas no lixo são eliminados definitivamente após {count} dias.',
  },
  'trash.listLabel': 'Esquemas no lixo',
  'trash.deleted': 'Eliminado {time}',
  'trash.deletesToday': 'será eliminado hoje',
  'trash.deletesTomorrow': 'será eliminado amanhã',
  'trash.deletesIn': {
    one: 'será eliminado dentro de {count} dia',
    many: 'será eliminado dentro de {count} de dias',
    other: 'será eliminado dentro de {count} dias',
  },
  'trash.restore': 'Restaurar',
  'trash.deletePermanently': 'Eliminar definitivamente',
  'trash.cannotBeUndone': 'Esta ação não pode ser anulada.',
  'trash.delete': 'Eliminar',
  'trash.empty': 'O lixo está vazio.',
  'trash.emptyTrash': 'Esvaziar o lixo',
  'trash.emptyConfirm': {
    one: 'Eliminar definitivamente {count} esquema? Esta ação não pode ser anulada.',
    many: 'Eliminar definitivamente {count} de esquemas? Esta ação não pode ser anulada.',
    other:
      'Eliminar definitivamente {count} esquemas? Esta ação não pode ser anulada.',
  },

  'collaboration.for': 'Colaboração em {name}',
  'collaboration.guestsConnected': {
    one: '{count} convidado ligado',
    many: '{count} de convidados ligados',
    other: '{count} convidados ligados',
  },
  'collaboration.title': 'Edição colaborativa',
  'collaboration.experiment': 'Experimental',
  'collaboration.description':
    'Os participantes ligam-se diretamente através de WebRTC e trocam mensagens com encriptação ponto a ponto.',
  'collaboration.nickname': 'Alcunha',
  'collaboration.link': 'Ligação',
  'collaboration.noOneJoined': 'Ainda não entrou mais ninguém.',
  'collaboration.startSession': 'Começar sessão colaborativa',
  'collaboration.stopSession': 'Parar sessão colaborativa',

  'viewer.noSchemaOpen': 'Nenhum esquema aberto',
  'viewer.emptyHint':
    'Escolha um na barra lateral ou comece um aqui. Também pode largar ficheiros em qualquer lugar para os importar.',
  'viewer.openSample': 'Abrir exemplo',
  'viewer.sampleName': 'exemplo de livraria',

  'drop.title': 'Largue para importar',
  'drop.formats':
    'Cópias de segurança, documentos .erd, .vuerd e .json, SQL, DBML, AML e GraphQL',
  'drop.importing': 'A importar ficheiros…',
  'drop.importingHint': 'Largue mais quando esta importação terminar',

  'import.imported': {
    one: '{count} esquema importado',
    many: '{count} de esquemas importados',
    other: '{count} esquemas importados',
  },
  'import.skippedInvalidFiles': {
    one: '{count} ficheiro inválido ignorado',
    many: '{count} de ficheiros inválidos ignorados',
    other: '{count} ficheiros inválidos ignorados',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} esquema inválido ignorado',
    many: '{count} de esquemas inválidos ignorados',
    other: '{count} esquemas inválidos ignorados',
  },
  'import.skippedOversized': {
    one: '{count} ficheiro com mais de {size} MB ignorado',
    many: '{count} de ficheiros com mais de {size} MB ignorados',
    other: '{count} ficheiros com mais de {size} MB ignorados',
  },
  'import.nothing': 'Nada para importar',
  'import.failed': 'Falha na importação',
  'import.exportFailed': 'Falha na exportação',

  'update.available': 'Está disponível uma nova versão do ERD Editor.',
  'update.updatedElsewhere':
    'A aplicação foi atualizada noutro separador — recarregue para concluir.',

  'live.invalidToken': 'Token de partilha inválido.',
  'live.hostNotFound': 'Anfitrião não encontrado.',
  'live.refresh': 'Atualizar',
  'live.hostStopped': 'O anfitrião terminou a sessão.',
  'live.somethingWentWrong': 'Ocorreu um erro.',
  'live.lookingForHost': 'À procura de um anfitrião...',
  'live.waitingForHost': 'À espera de um anfitrião...',
  'live.session': 'Sessão em direto',
  'live.inSession': {
    one: '{count} na sessão',
    many: '{count} na sessão',
    other: '{count} na sessão',
  },
  'live.showParticipants': 'Mostrar participantes',
  'live.hideParticipants': 'Ocultar participantes',

  'gdrive.checkingSignIn': 'A verificar o seu início de sessão Google…',
  'gdrive.anotherAccount': 'outra conta',
  'gdrive.offline.title': 'Está offline',
  'gdrive.offline.description':
    'O ERD Editor verifica o seu início de sessão Google quando voltar a estar online.',
  'gdrive.scopeMissing.title': 'O acesso ao Google Drive não foi concedido',
  'gdrive.scopeMissing.description':
    'O ERD Editor precisa de acesso aos ficheiros que cria ou abre com ele. Inicie sessão novamente e permita o acesso ao Google Drive.',
  'gdrive.mismatch.title': 'O Google Drive enviou isto para outra conta',
  'gdrive.mismatch.description':
    'Tem sessão iniciada como {email}. Mude para a conta que o Google Drive usou para o abrir ou continue com os ficheiros desta conta.',
  'gdrive.mismatch.choose':
    'O ERD Editor não conseguiu pré-selecionar essa conta, por isso escolha-a quando o Google perguntar.',
  'gdrive.mismatch.switchAccount': 'Mudar de conta',
  'gdrive.mismatch.showMyFiles': 'Mostrar os meus ficheiros',
  'gdrive.accountChanged.title': 'Sessão iniciada com outra conta',
  'gdrive.accountChanged.description':
    'Outro separador iniciou sessão noutra Conta Google, por isso este separador parou. Recarregue-o para continuar com essa conta.',
  'gdrive.unsaved.title': 'As suas alterações não foram guardadas',
  'gdrive.unsaved.description':
    '{name} tem alterações de {email} que não estão no Google Drive, e agora tem sessão iniciada com {account}. Transfira-as antes de continuar.',
  'gdrive.unsaved.descriptionUnnamed':
    'O ficheiro que tinha aberto tem alterações de {email} que não estão no Google Drive, e agora tem sessão iniciada com {account}. Transfira-as antes de continuar.',
  'gdrive.unsaved.continueWithout': 'Continuar sem elas',
  'gdrive.framed.title':
    'Abra o editor do Google Drive do ERD Editor num separador próprio',
  'gdrive.framed.description': 'Não funciona dentro de outra página.',
  'gdrive.framed.link': 'Abrir num novo separador',
  'gdrive.notConfigured.title':
    'A integração com o Google Drive não está configurada',
  'gdrive.notConfigured.description':
    'Esta compilação do ERD Editor não tem cliente de início de sessão Google.',
  'gdrive.unsupportedOrigin.title': 'O Google Drive não está disponível aqui',
  'gdrive.unsupportedOrigin.description':
    'O início de sessão Google só funciona em erd-editor.io, e isto é uma pré-visualização.',

  'gdrive.signIn.title': 'Abra os seus ficheiros ERD no Google Drive',
  'gdrive.signIn.description':
    'O ERD Editor só abre e guarda os ficheiros que cria ou abre com ele.',
  'gdrive.signIn.fallbackDescription':
    'O servidor de início de sessão do ERD Editor está ocupado, por isso o Google mantém a sua sessão durante uma hora de cada vez.',
  'gdrive.signIn.signIn': 'Iniciar sessão com o Google',
  'gdrive.signIn.continue': 'Continuar com o Google',
  'gdrive.signIn.waitingTitle': 'À espera do início de sessão Google…',
  'gdrive.signIn.waitingDescription':
    'Conclua o início de sessão na janela que o Google abriu.',
  'gdrive.signIn.popupBlocked':
    'O browser bloqueou a janela de início de sessão. Permita pop-ups para este site e tente novamente.',
  'gdrive.signIn.failed':
    'O início de sessão Google não foi concluído. Tente novamente.',
  'gdrive.signIn.gisBlocked':
    'Não foi possível carregar o início de sessão Google. Verifique se nada bloqueia accounts.google.com e recarregue a página.',

  'gdrive.sidebar.label': 'Ficheiros do Drive',
  'gdrive.sidebar.newFile': 'Novo ficheiro',
  'gdrive.sidebar.import': 'Importar',
  'gdrive.sidebar.searchFiles': 'Pesquisar ficheiros',
  'gdrive.sidebar.newFileName': 'Nome do novo ficheiro',
  'gdrive.sidebar.fileName': 'Nome do ficheiro',
  'gdrive.sidebar.fileNamePlaceholder': 'nome do ficheiro',
  'gdrive.sidebar.loadingFiles': 'A carregar ficheiros…',
  'gdrive.sidebar.loadFailed': 'Não foi possível carregar os seus ficheiros.',

  'gdrive.viewer.noFileOpen': 'Nenhum ficheiro aberto',
  'gdrive.viewer.noFileOpenHint':
    'Escolha um ficheiro na barra lateral ou comece um novo.',
  'gdrive.viewer.noFilesYet': 'Ainda não há ficheiros',
  'gdrive.viewer.noFilesYetHint':
    'Crie um ficheiro ou importe um. Os ficheiros que abre com o ERD Editor a partir do Google Drive também aparecem aqui.',
  'gdrive.viewer.waitingForOpener':
    'À espera do separador que abriu este ficheiro…',
  'gdrive.viewer.notDocument': 'Este ficheiro não é um documento do ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'O ERD Editor abre diagramas que ele próprio guardou. Deixa este ficheiro como está e nunca o substitui.',
  'gdrive.viewer.googleNativeHint':
    'Os Documentos, Folhas de Cálculo e pastas do Google abrem no Google Drive.',
  'gdrive.viewer.trashed': 'Este ficheiro está no lixo',
  'gdrive.viewer.trashedHint': 'Restaure-o no Google Drive para o abrir aqui.',
  'gdrive.viewer.tooLarge': 'Este ficheiro é demasiado grande',
  'gdrive.viewer.tooLargeHint':
    'O ERD Editor abre ficheiros com até {size} MB.',
  'gdrive.viewer.notFound': 'Este ficheiro não está disponível',
  'gdrive.viewer.notFoundHint':
    'Pode ter sido eliminado, ou esta Conta Google não o consegue abrir.',
  'gdrive.viewer.waitingToken': 'À espera do Google',
  'gdrive.viewer.waitingTokenHint':
    'Este ficheiro abre quando a sua sessão Google voltar.',
  'gdrive.viewer.failed': 'Não foi possível abrir este ficheiro',
  'gdrive.viewer.failedHint':
    'O Google Drive não respondeu. Verifique a ligação e tente novamente.',
  'gdrive.viewer.savingBeforeLeave': 'A guardar antes de sair…',

  'gdrive.status.saved': 'Guardado no Google Drive',
  'gdrive.status.saving': 'A guardar…',
  'gdrive.status.failed': 'Não foi possível guardar',
  'gdrive.status.conflict': 'Alterado no Google Drive',
  'gdrive.status.unconfirmed': 'Não foi possível confirmar a última gravação',
  'gdrive.status.paused': 'Em pausa até voltar a ligar ao Google',
  'gdrive.status.deleted': 'Eliminado no Google Drive',
  'gdrive.status.readonly': 'Só de leitura',
  'gdrive.status.waitingLeader':
    'À espera do separador que guarda este ficheiro',
  'gdrive.status.waitingSnapshot':
    'À espera do separador que abriu este ficheiro',
  'gdrive.status.scopeMissing': 'Sem acesso ao Google Drive',

  'gdrive.banner.conflict':
    'Este ficheiro mudou no Google Drive, por isso a gravação parou. As suas alterações continuam aqui.',
  'gdrive.banner.unconfirmed':
    'Não foi possível confirmar a última gravação, por isso a gravação parou. As suas alterações continuam aqui.',
  'gdrive.banner.deleted':
    'Este ficheiro foi eliminado ou movido para o lixo no Google Drive, por isso a gravação parou.',
  'gdrive.banner.readonly':
    'Já não pode editar este ficheiro no Google Drive, por isso a gravação parou. As suas alterações continuam aqui.',
  'gdrive.banner.checkDrive': 'Verificar o Drive',
  'gdrive.banner.reloadFromDrive': 'Recarregar do Drive',
  'gdrive.banner.leaderNotResponding':
    'O separador que guarda este ficheiro não está a responder.',
  'gdrive.banner.openerNotResponding':
    'O separador que abriu este ficheiro não está a responder.',
  'gdrive.banner.takeOver': 'Assumir a gravação',
  'gdrive.banner.openAndTakeOver': 'Abrir do Drive e assumir',
  'gdrive.banner.popupBlocked':
    'O browser bloqueou a janela do Google. Permita pop-ups para este site e volte a ligar ao Google.',
  'gdrive.banner.reconnectFailed':
    'Não foi possível voltar a ligar ao Google. Tente novamente.',
  'gdrive.banner.sessionEnded':
    'A sua sessão Google terminou, por isso a gravação está em pausa.',
  'gdrive.banner.sessionEndsSoon': 'A sua sessão Google termina em breve.',
  'gdrive.banner.reconnect': 'Voltar a ligar ao Google',

  'gdrive.leave.title': 'As suas alterações mais recentes não estão guardadas',
  'gdrive.leave.description':
    'O ERD Editor não conseguiu guardá-las no Google Drive. Transfira-as para manter uma cópia ou saia e perca-as.',
  'gdrive.leave.descriptionSignOut':
    'O ERD Editor não conseguiu guardá-las no Google Drive. Transfira-as para manter uma cópia ou termine sessão e perca-as.',
  'gdrive.leave.stay': 'Ficar',
  'gdrive.leave.leaveAnyway': 'Sair mesmo assim',
  'gdrive.leave.signOutAnyway': 'Terminar sessão mesmo assim',

  'gdrive.create.title': 'Novo ficheiro no Google Drive',
  'gdrive.create.inAppFolder': 'Na pasta ERD Editor',
  'gdrive.create.inFolderPending': 'Numa pasta…',
  'gdrive.create.inHiddenFolder':
    'Numa pasta que o ERD Editor não consegue ver',
  'gdrive.create.inFolder': 'Na pasta “{name}”',
  'gdrive.create.untitled': 'Sem título',
  'gdrive.create.savedAs': 'Será guardado como {name}',
  'gdrive.create.folderRefused':
    'O ERD Editor não pode criar ficheiros nesta pasta. Criar antes na pasta ERD Editor?',
  'gdrive.create.failed': 'Não foi possível criar o ficheiro. Tente novamente.',
  'gdrive.create.createInAppFolder': 'Criar na pasta ERD Editor',
  'gdrive.create.create': 'Criar',

  'gdrive.import.imported': {
    one: '{count} ficheiro importado para o Google Drive',
    many: '{count} de ficheiros importados para o Google Drive',
    other: '{count} ficheiros importados para o Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} cópia de segurança ignorada: as cópias de segurança ficam na aplicação local',
    many: '{count} de cópias de segurança ignoradas: as cópias de segurança ficam na aplicação local',
    other:
      '{count} cópias de segurança ignoradas: as cópias de segurança ficam na aplicação local',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} carregamento falhou',
    many: '{count} de carregamentos falharam',
    other: '{count} carregamentos falharam',
  },

  'gdrive.notice.unreadableState':
    'O Google Drive enviou uma ligação que o ERD Editor não conseguiu ler',
  'gdrive.notice.renameFailed': 'Não foi possível mudar o nome do ficheiro',
  'gdrive.notice.createFailed': 'Não foi possível criar o ficheiro',
  'gdrive.notice.checkFailed':
    'Não foi possível contactar o Google Drive. Tente novamente.',
  'gdrive.notice.reloadFailed':
    'Não foi possível recarregar do Google Drive. Tente novamente.',
  'gdrive.notice.reloadTrashed':
    'Não foi possível recarregar: o ficheiro está no lixo do Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Não foi possível recarregar: o ficheiro no Google Drive tem mais de {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Não foi possível recarregar: o ficheiro no Google Drive já não é um documento do ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Sessão terminada aqui. O servidor do ERD Editor não o confirmou, por isso este browser termina a sessão da próxima vez que se ligar',
  'gdrive.notice.signOutNotRevoked':
    'Sessão terminada aqui, mas o Google não confirmou que removeu o acesso do ERD Editor, por isso os seus outros dispositivos podem manter a sessão iniciada até o remover em myaccount.google.com/permissions',
} satisfies Messages;
