# vite-plugin-r-html - hmr

### vite.config.ts

```ts
import rHtml from '@dineug/vite-plugin-r-html';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [rHtml()],
});
```

### main.ts

```ts
import { hmr } from '@dineug/r-html';

if (import.meta.env.DEV) {
  hmr();
}
```
