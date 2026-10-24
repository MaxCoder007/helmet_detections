/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#09090B',
          secondary: '#111114',
          card: '#18181B',
          hover: '#222226',
          muted: '#141417',
        },
        border: {
          DEFAULT: '#27272A',
          subtle: '#1E1E22',
          active: '#3F3F46',
        },
        text: {
          primary: '#FAFAFA',
          secondary: '#A1A1AA',
          muted: '#71717A',
        },
        accent: {
          cyan: '#8BE8FF',
          pink: '#F0ABFC',
        },
        status: {
          success: '#34D399',
          warning: '#FBBF24',
          error: '#F87171',
          info: '#60A5FA',
        },
        // Detection class distinct color palette
        detection: {
          helmet: '#34D399',      // Emerald Green - safety/compliance
          no_helmet: '#F87171',   // Bright Red/Coral - safety violation
          number_plate: '#8BE8FF',// Electric Cyan - vehicle identification
          pillion: '#FBBF24',     // Warm Amber - passenger
          rider: '#A78BFA',       // Soft Purple - vehicle operator
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Consolas',
          'Monaco',
          'monospace',
        ],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -5px rgba(139, 232, 255, 0.35)',
        'glow-pink': '0 0 20px -5px rgba(240, 171, 252, 0.35)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 2s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}
