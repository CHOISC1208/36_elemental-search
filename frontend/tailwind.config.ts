import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#E07B3F',
          light: '#FFF8F0',
          border: '#F5C4A0',
          text: '#B35A1F',
        },
      },
    },
  },
  plugins: [],
}
export default config
