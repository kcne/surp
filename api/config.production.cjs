module.exports = {
  build: {
    content: ['emails/templates/**/*.html'],
    output: {
      path: 'emails/build',
      extension: 'html'
    }
  },
  css: {
    inline: true,
    tailwind: {
      content: ['emails/templates/**/*.html'],
      theme: {
        extend: {
          colors: {
            navy: '#0f172a',
            indigo: '#4f46e5',
            muted: '#64748b',
            border: '#e2e8f0',
            surface: '#f8fafc',
            success: '#10b981'
          },
          fontFamily: {
            sans: ['Inter', 'Arial', 'sans-serif']
          }
        }
      }
    }
  },
  minify: true
};
