import { configureActions } from "@storybook/addon-actions";
import { setConsoleOptions } from "@storybook/addon-console";
import "../dist/vuerd.min.js";

configureActions({
  depth: 100,
  limit: 50,
});

const panelExclude = setConsoleOptions({}).panelExclude;
setConsoleOptions({
  panelExclude: [...panelExclude, /deprecated/],
});
