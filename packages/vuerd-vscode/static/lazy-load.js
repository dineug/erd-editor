(function () {
  const { generateTemplatePanel } = window['@vuerd/plugin-generate-template'];

  vuerd.extension({
    panels: [generateTemplatePanel()],
  });
})();
