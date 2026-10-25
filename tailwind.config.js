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
          DEFAULT: '#0F1115',
          secondary: '#14171D',
          card: '#181B21',
          hover: '#22262E',
          muted: '#1E222A',
        },
        border: {
          DEFAULT: '#2A303A',
          subtle: '#222730',
          active: '#3D4554',
        },
        text: {
          primary: '#F5F7FA',
          secondary: '#A6AFBD',
          muted: '#6E7684',
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
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Consolas',
          'Monaco',
          'monospace',
        ],
      },
      boxShadow: {
        'glow-cyan': '0 0 16px -4px rgba(139, 232, 255, 0.3)',
        'glow-pink': '0 0 16px -4px rgba(240, 171, 252, 0.3)',
        'card': '0 2px 12px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
}
