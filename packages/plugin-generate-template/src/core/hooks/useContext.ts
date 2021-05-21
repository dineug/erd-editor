import { useContext as use } from 'preact/hooks';
import { GenerateTemplate } from '@/core/GenerateTemplateContext';

export const useContext = () => use(GenerateTemplate);
