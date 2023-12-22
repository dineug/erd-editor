import { SIZE_FONT } from '@/core/layout';

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
ctx.font = `${SIZE_FONT}px 'Noto Sans', sans-serif`;

export const getTextWidth = (value: string) => ctx.measureText(value).width;
