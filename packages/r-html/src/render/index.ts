import { domAdapter } from '@/render/domAdapter';
import { createHostTemplate } from '@/render/hostTemplate';

export type Container = Element | ShadowRoot | DocumentFragment;

const domTemplate = createHostTemplate<Container>(domAdapter);

export const html = domTemplate.html;
export const svg = domTemplate.svg;
export const render = domTemplate.render;
