export const soundAssets = import.meta.glob('./sounds/**/*.ogg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
