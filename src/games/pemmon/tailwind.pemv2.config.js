// tailwind.config.js 에 추가할 PEMV2 커스텀 애니메이션 설정

module.exports = {
  theme: {
    extend: {
      animation: {
        'fadeIn': 'fadeIn 0.2s ease-out',
        'slideUp': 'slideUp 0.3s ease-out',
        'slideDown': 'slideDown 0.3s ease-out',
        'scaleIn': 'scaleIn 0.2s ease-out',
        'bounce': 'bounce 1s infinite',
        'pulse': 'pulse 2s infinite',
        'spin': 'spin 1s linear infinite',
        'fadeInUp': 'fadeInUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeInUp: {
          '0%': { 
            opacity: '0',
            transform: 'translateY(10px)'
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
      },
      // PEMV2 색상 팔레트
      colors: {
        'pemmon': {
          'blue': {
            50: '#e5f0ff',
            100: '#c6deff',
            200: '#93c5fd',
            300: '#60a5fa',
            400: '#3b82f6',
            500: '#2563eb',
            600: '#1d4ed8',
            700: '#1e40af',
            800: '#1e3a8a',
            900: '#1a365d',
          },
          'green': {
            50: '#e9f9ee',
            100: '#d3f2dd',
            200: '#a7e4bb',
            300: '#7dd699',
            400: '#52c877',
            500: '#28ba55',
            600: '#22a94c',
            700: '#1c9740',
            800: '#178635',
            900: '#11742a',
          },
          'red': {
            50: '#fff5f6',
            100: '#ffebee',
            200: '#ffcdd2',
            300: '#ff9999',
            400: '#f97373',
            500: '#f44336',
            600: '#e53935',
            700: '#d32f2f',
            800: '#c62828',
            900: '#b71c1c',
          },
          'purple': {
            50: '#f6ecff',
            100: '#ead9ff',
            200: '#d5b3ff',
            300: '#bf8cff',
            400: '#aa66ff',
            500: '#9540ff',
            600: '#8833e6',
            700: '#7a26cc',
            800: '#6d1ab3',
            900: '#5f0d99',
          },
        }
      },
      // 그림자 효과
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'medium': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'hard': '0 8px 24px rgba(0, 0, 0, 0.16)',
        'xl': '0 20px 40px rgba(0, 0, 0, 0.15)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.2)',
      },
      // 둥근 모서리
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },
      // 백드롭 블러
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      // 트랜지션
      transitionDuration: {
        '0': '0ms',
        '200': '200ms',
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
