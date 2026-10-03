const baseURL = process.env.NUXT_APP_BASE_URL ?? '/';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-03',
  devtools: { enabled: false },
  css: ['@fontsource-variable/manrope', '~/assets/css/main.css'],
  ssr: true,
  nitro: { preset: 'static', compressPublicAssets: true },
  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'LiveKeys — Votre clavier. Toutes vos scènes.',
      meta: [
        {
          name: 'description',
          content:
            'Votre setup de scène sur iPad. Superposez vos sons, préparez vos setlists et retrouvez vos instruments et effets AUv3 dans LiveKeys.',
        },
        { name: 'theme-color', content: '#f5f3ed' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'LiveKeys — Votre clavier. Toutes vos scènes.' },
        {
          property: 'og:description',
          content:
            'Layers, splits, setlists et plugins AUv3. Une application en développement pour les claviéristes sur iPad.',
        },
        { name: 'twitter:card', content: 'summary' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` }],
    },
  },
});
