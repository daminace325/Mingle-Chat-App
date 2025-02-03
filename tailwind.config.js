module.exports = {
  // ... other config
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '1' },
          '75%': { opacity: '1' },
          '100%': { opacity: '0' },
        }
      },
      animation: {
        'fade-in': 'fade-in 5s ease-in-out forwards',
      }
    }
  }
} 