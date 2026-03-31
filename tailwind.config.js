/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './client/**/*.{html,js}',
    './admin/**/*.{html,js}'
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#1a1a2e',
          surface: '#16213e',
          card: '#0f3460',
          accent: '#e94560',
          gold: '#f5c518',
          green: '#00d277',
          cyan: '#00fff5',
          purple: '#a855f7',
          text: '#e0e0e0',
          muted: '#8892b0'
        }
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        retro: ['"IBM Plex Mono"', 'monospace'],
        vt323: ['"IBM Plex Mono"', 'monospace'],
        body: ['"IBM Plex Mono"', 'monospace']
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'pulse-fast': 'pulse 0.5s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'score-pop': 'scorePop 0.6s ease-out'
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' }
        },
        scorePop: {
          '0%': { transform: 'scale(0.5) translateY(10px)', opacity: '0' },
          '60%': { transform: 'scale(1.2) translateY(-5px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
};
