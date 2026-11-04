declare module '*?raw' {
  const source: string;
  export default source;
}
declare module '*?url' {
  const source: string;
  export default source;
}
interface ImportMeta {
  glob(
    pattern: string,
    options: { eager: boolean; query: string; import: string },
  ): Record<string, unknown>;
  readonly env: { readonly DEV: boolean };
}
