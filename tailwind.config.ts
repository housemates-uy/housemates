import type { Config } from 'tailwindcss';

// Tokens del Manual de Marca v1. No agregar colores fuera de esta paleta.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0A',
        bone: '#FAFAFA',
        electric: '#2447F5',
        violet: '#8A4FFF',
        amber: '#E8AA4C',
        alert: '#FF3B30',
      },
      fontFamily: {
        sans: ['"Neue Montreal"', '"General Sans"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        chip: '6px',
        control: '10px',
        card: '14px',
      },
      letterSpacing: {
        label: '0.28em',
      },
      maxWidth: {
        page: '1280px',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Ubicación secreta de la portada: el brillo detrás del texto desenfocado se mueve lento.
        drift: {
          '0%, 100%': { transform: 'translateX(-18%) scale(1)', opacity: '0.55' },
          '50%': { transform: 'translateX(18%) scale(1.15)', opacity: '0.9' },
        },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
        'fade-up': 'fade-up 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        drift: 'drift 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
