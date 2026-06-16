import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  // Static by default; only the pages that opt out with `prerender = false`
  // (/matches and /) are server-rendered on demand to fetch live Foireann data.
  output: 'hybrid',
  adapter: vercel(),
  integrations: [tailwind(), sitemap()],
  site: 'https://brooklynshamrocks.com',
});
