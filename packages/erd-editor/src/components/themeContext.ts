import { createContext, useContext } from '@dineug/r-html';

import { Ctx } from '@/internal-types';
import { Theme } from '@/themes/tokens';

/**
 * The scene's colours as values. A stylesheet resolved a custom property per
 * node and konva resolves none, so the whole palette reaches every scene node
 * through one context and a theme change is one provider set away from a repaint.
 */
export const themeContext = createContext<Theme>({} as Theme);

export const useThemeContext = (ctx: Ctx) => useContext(ctx, themeContext);
