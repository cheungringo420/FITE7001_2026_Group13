/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Professional terminal palette
        brand: {
          50: '#e6fffb',
          100: '#b7fff3',
          200: '#83ffe9',
          300: '#4ff5db',
          400: '#24e6ca',
          500: '#17e3c1',
          600: '#0fb79c',
          700: '#0c8a76',
          800: '#0b6c5c',
          900: '#0a574a',
          950: '#073b34',
        },
        accent: {
          cyan: '#4cc9f0',
          mint: '#17e3c1',
          amber: '#f2c94c',
          lime: '#35d07f',
        },
        surface: {
          DEFAULT: '#111823',
          light: '#151f2c',
          lighter: '#1f2b3d',
          dark: '#0b0f14',
        },
        // Semantic colors
        success: { DEFAULT: '#35d07f', dark: '#1c7a4d', light: '#5fe4a3' },
        danger: { DEFAULT: '#ef476f', dark: '#9f1e3d', light: '#ff6f8f' },
        warning: { DEFAULT: '#f2c94c', dark: '#b2870f', light: '#ffd36a' },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'web3-mesh': 'linear-gradient(135deg, rgba(23, 227, 193, 0.12) 0%, transparent 50%, rgba(76, 201, 240, 0.12) 100%)',
        'glow-accent': 'radial-gradient(ellipse at center, rgba(23, 227, 193, 0.18) 0%, transparent 70%)',
        'glow-cyan': 'radial-gradient(ellipse at center, rgba(76, 201, 240, 0.15) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(180deg, rgba(17, 24, 35, 0.9) 0%, rgba(11, 15, 20, 0.9) 100%)',
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(23, 227, 193, 0.25)',
        'glow-md': '0 0 25px -5px rgba(23, 227, 193, 0.35)',
        'glow-lg': '0 0 35px -5px rgba(23, 227, 193, 0.45)',
        'glow-cyan': '0 0 25px -5px rgba(76, 201, 240, 0.35)',
        'glow-green': '0 0 25px -5px rgba(53, 208, 127, 0.35)',
        'inner-glow': 'inset 0 0 20px rgba(23, 227, 193, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'gradient': 'gradient 8s linear infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(168, 85, 247, 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-ibm-plex-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
