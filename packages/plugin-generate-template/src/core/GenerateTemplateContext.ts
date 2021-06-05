import { GenerateTemplateContext } from '@/internal-types/GenerateTemplateContext';
import { createContext, Context as IContext } from 'preact';

export const GenerateTemplate = createContext(
  {} as any
) as IContext<GenerateTemplateContext>;
