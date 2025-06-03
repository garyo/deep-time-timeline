// @ts-check
import { defineConfig } from 'astro/config';

import solidJs from '@astrojs/solid-js';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://deep-timeline.oberbrunner.com',
  integrations: [solidJs(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    optimizeDeps: {
      include: ['d3', 'temporal-polyfill']
    }
  }
});