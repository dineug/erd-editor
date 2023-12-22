import { Context as IContext, createContext } from 'preact';

import { GenerateTemplateContext } from '@/internal-types/GenerateTemplateContext';

export const GenerateTemplate = createContext(
  {} as any
) as IContext<GenerateTemplateContext>;
