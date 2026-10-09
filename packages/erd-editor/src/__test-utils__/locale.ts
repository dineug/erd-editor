import { expect, vi } from 'vite-plus/test';

/**
 * Runs while toLocaleLowerCase, given no locale, lowers by Turkish rules, as
 * on a Turkish or Azerbaijani system, where I becomes a dotless i.
 */
export function underTurkishLocale(run: () => void) {
  const toLocaleLowerCase = String.prototype.toLocaleLowerCase;
  const spy = vi
    .spyOn(String.prototype, 'toLocaleLowerCase')
    .mockImplementation(function (
      this: string,
      locales?: Intl.LocalesArgument
    ) {
      return toLocaleLowerCase.call(this, locales ?? 'tr');
    });

  try {
    expect('I'.toLocaleLowerCase()).toBe('\u0131');
    run();
  } finally {
    spy.mockRestore();
  }
}
