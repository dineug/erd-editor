export interface Helper {
  getTextWidth(value: string): number;
  getTextWidthLegacy(value: string): number;
  getFastTextWidth(value: string): number;
}
