import { createContext, useContext } from '@dineug/r-html';

import { sourceI18n } from '@/i18n/source';
import type { I18n } from '@/i18n/translate';
import { Ctx } from '@/internal-types';

/**
 * The language the editor's own text is shown in. The element provides one it
 * changes in place, never through the provider, so a component mounted after a
 * switch reads the new language; where nothing provides one, English.
 */
export const localeContext = createContext<I18n>(sourceI18n);

export const useI18n = (ctx: Ctx) => useContext(ctx, localeContext);
