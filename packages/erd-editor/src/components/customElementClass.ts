/**
 * The type an exported element class carries, written here rather than taken
 * from @dineug/r-html, which the build inlines, so a declaration file names it
 * without an import no consumer can resolve.
 */
export interface CustomElementClass<C extends HTMLElement = HTMLElement> {
  new (): C;
  readonly observedAttributes: string[];
}
