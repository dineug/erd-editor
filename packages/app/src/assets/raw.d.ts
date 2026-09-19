// Vite's ?raw suffix, which the app's types do not otherwise pull in.
declare module '*?raw' {
  const content: string;
  export default content;
}
