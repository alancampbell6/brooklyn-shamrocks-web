// Shared by Hero.astro (the <picture>) and BaseLayout.astro (the preload), so the
// preloaded candidate always matches the one the browser picks from the srcset.
import manifest from '../data/responsive-images.json';

export const HERO_SRC = '/images/hero-team-huddle.jpg';
export const HERO_SIZES = '100vw';

const hero = (manifest as Record<string, { base: string; widths: number[] }>)[HERO_SRC];

export const heroPreload = {
  type: 'image/avif',
  sizes: HERO_SIZES,
  srcset: hero.widths.map((w) => `${hero.base}-${w}.avif ${w}w`).join(', '),
};
