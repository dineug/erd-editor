(function () {
  const getTheme = name =>
    getComputedStyle(document.documentElement).getPropertyValue(
      `--vscode-${name.replace('.', '-')}`
    );

  document.body.style = `padding: 0; margin: 0; width: 100%; height:100vh;`;
  const editor = document.createElement('erd-editor');
  const vscode = acquireVsCodeApi();
  const vscodeTheme = {
    canvas: getTheme('editor.background'),
    table: getTheme('sideBar.background'),
    tableActive: getTheme('editorCursor.foreground'),
    focus: getTheme('editorCursor.foreground'),
    // keyPK: getTheme("editor.background"),
    // keyFK: getTheme("editor.background"),
    // keyPFK: getTheme("editor.background"),
    font: getTheme('input.foreground'),
    fontActive: getTheme('inputOption.activeForeground'),
    fontPlaceholder: getTheme('input.placeholderForeground'),
    contextmenu: getTheme('menu.background'),
    contextmenuActive: getTheme('menu.selectionBackground'),
    // edit: getTheme("editorCursor.foreground"),
    columnSelect: getTheme('list.activeSelectionBackground'),
    columnActive: getTheme('list.hoverBackground'),
    minimapShadow: getTheme('widget.shadow'),
    scrollbarThumb: getTheme('scrollbarSlider.background'),
    scrollbarThumbActive: getTheme('scrollbarSlider.hoverBackground'),
    menubar: getTheme('activityBar.background'),
    visualization: getTheme('editor.background'),
  };
  let isInit = false;

  vuerd.setExportFileCallback((blob, options) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      vscode.postMessage({
        command: 'exportFile',
        value: reader.result,
        options,
      });
    };
    reader.readAsDataURL(blob);
  });

  editor.automaticLayout = true;

  window.addEventListener('message', event => {
    const message = event.data;
    if (message.command) {
      // webview API
      switch (message.command) {
        case 'value':
          editor.addEventListener('change', event => {
            vscode.postMessage({
              command: 'value',
              value: event.target.value,
            });
          });
          editor.initLoadJson(message.value);
          document.body.appendChild(editor);
          break;
        case 'state':
          vscode.setState({ uri: message.uri });
          break;
        case 'theme':
          if (message.value.themeSync) {
            editor.setTheme(Object.assign(message.value.theme, vscodeTheme));
          } else {
            editor.setTheme(message.value.theme);
          }
          break;
        case 'keymap':
          editor.setKeymap(message.value.keymap);
          break;
        case 'loadLiquibase':
          editor.loadLiquibase(message.value);
          break;
      }
    } else if (message.type) {
      // custom editor API
      const { type, body, requestId } = message;
      if (type === 'init') {
        editor.addEventListener('change', event => {
          vscode.postMessage({
            type: 'value',
            value: event.target.value,
          });
        });
        editor.initLoadJson(body.value);
        document.body.appendChild(editor);
        isInit = true;
      } else if (type === 'update') {
        editor.value = body.value;
      } else if (type === 'getFileData') {
        if (isInit) {
          vscode.postMessage({
            type: 'response',
            requestId,
            body: {
              value: editor.value,
            },
          });
        }
      } else if (type === 'theme') {
        if (body.value.themeSync) {
          editor.setTheme(Object.assign(body.value.theme, vscodeTheme));
        } else {
          editor.setTheme(body.value.theme);
        }
      } else if (type === 'keymap') {
        editor.setKeymap(body.value.keymap);
      } else if (type === 'loadLiquibase') {
        editor.loadLiquibase(message.value);
      }
    }
  });

  editor.addEventListener('liquibase-progress', event => {
    vscode.postMessage({
      command: 'progress',
      message: event.detail,
    });
  });

  editor.addEventListener('liquibase-progress-end', () => {
    vscode.postMessage({
      command: 'progressEnd',
    });
  });

  editor.addEventListener('console-log', event => {
    console.log(event.detail);
  });

  vscode.postMessage({
    command: 'getValue',
  });
})();
