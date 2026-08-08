/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // This repo's established style capitalizes the subject
    // (e.g. "fix: LWW data processing", "feat: Time Travel"),
    // which config-conventional would otherwise reject as sentence-case.
    'subject-case': [0],
  },
};
