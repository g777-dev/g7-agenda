/** @type {import('tailwindcss').Config} */
const cor = (v) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        fundo: cor('fundo'),
        superficie: cor('superficie'),
        superficie2: cor('superficie2'),
        tinta: cor('tinta'),
        apagado: cor('apagado'),
        linha: cor('linha'),
        ambar: cor('ambar'),
        'ambar-suave': cor('ambar-suave'),
        'ambar-tinta': cor('ambar-tinta'),
        azul: cor('azul'),
        sobre: cor('sobre-azul'),
        'azul-suave': cor('azul-suave'),
        'azul-tinta': cor('azul-tinta'),
        vermelho: cor('vermelho'),
        'vermelho-suave': cor('vermelho-suave'),
        'vermelho-tinta': cor('vermelho-tinta'),
        verde: cor('verde'),
        'verde-suave': cor('verde-suave'),
        'verde-tinta': cor('verde-tinta'),
      },
    },
  },
  plugins: [],
};
