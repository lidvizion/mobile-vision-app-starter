/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // WELLS-Inspired Luxury Color Palette
        'wells-beige': '#DDD0C8',
        'wells-dark-grey': '#323232',
        'wells-white': '#FFFFFF',
        'wells-light-beige': '#F5F1ED',
        'wells-warm-grey': '#8B8680',

        // Semantic color mappings
        background: '#DDD0C8',
        surface: '#FFFFFF',
        primary: {
          DEFAULT: '#323232',
          50: '#F5F1ED',
          100: '#DDD0C8',
          200: '#C4B5A8',
          300: '#AB9A88',
          400: '#927F68',
          500: '#323232',
          600: '#2A2A2A',
          700: '#222222',
          800: '#1A1A1A',
          900: '#121212',
        },
        secondary: {
          DEFAULT: '#F5F1ED',
          50: '#F9F8F7',
          100: '#F0EDEA',
          200: '#E1DCD6',
          300: '#D2CAC2',
          400: '#C3B8AE',
          500: '#8B8680',
          600: '#7A7570',
          700: '#696460',
          800: '#585350',
          900: '#474240',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'wells-sm': '0 1px 2px 0 rgba(50, 50, 50, 0.05)',
        'wells-md': '0 4px 6px -1px rgba(50, 50, 50, 0.1)',
        'wells-lg': '0 10px 15px -3px rgba(50, 50, 50, 0.1)',
        'wells-xl': '0 20px 25px -5px rgba(50, 50, 50, 0.1)',
        'wells-2xl': '0 25px 50px -12px rgba(50, 50, 50, 0.25)',
        'wells-inner': 'inset 0 2px 4px 0 rgba(50, 50, 50, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.8s ease-out',
        'scale-in': 'scaleIn 0.4s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'luxury-gradient': 'linear-gradient(135deg, #DDD0C8 0%, #F5F1ED 100%)',
      },
    },
  },
  plugins: [],
}