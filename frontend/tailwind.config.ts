import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs': '400px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Apple HIG System Colors (Light / Dark Adaptive)
        apple: {
          blue: '#0071e3',          // Apple web signature CTA / iOS Accent
          'blue-hover': '#0077ed',
          'blue-active': '#0062c4',
          'blue-subtle': '#e8f2fe',
          teal: '#30b0c7',
          cyan: '#32ade6',
          indigo: '#5856d6',
          purple: '#af52de',
          pink: '#ff2d55',
          red: '#ff3b30',
          orange: '#ff9500',
          yellow: '#ffcc00',
          green: '#34c759',
          mint: '#00c7be',

          // Apple HIG Label & Content Colors
          ink: '#1d1d1f',            // Primary text
          muted: '#6e6e73',          // Secondary text
          tertiary: '#86868b',       // Tertiary text / placeholders
          quaternary: '#d2d2d7',     // Dividers & subtle icons

          // Apple HIG System Grays
          'gray-1': '#8e8e93',
          'gray-2': '#aeaeb2',
          'gray-3': '#c7c7cc',
          'gray-4': '#d1d1d6',
          'gray-5': '#e5e5ea',
          'gray-6': '#f2f2f7',       // iOS Grouped Background

          // Apple Surfaces & Backgrounds
          bg: '#f5f5f7',             // Apple Web Grouped Page Background
          surface: '#ffffff',        // Standard Card Surface
          'surface-subtle': '#fbfbfd',
          border: 'rgba(0, 0, 0, 0.08)',
          'border-subtle': 'rgba(0, 0, 0, 0.05)',
        },

        // Primary brand color alias mapped to Apple Blue
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7dc4fc',
          400: '#38a4f8',
          500: '#0071e3',  // Apple Blue
          600: '#0062c4',
          700: '#004fa1',
          800: '#003e82',
          900: '#00346e',
          950: '#00214a',
        },

        // Semantic colors (Apple HIG aligned)
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#34c759',  // Apple System Green
          600: '#28a745',
          700: '#1e8035',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ff3b30',  // Apple System Red
          600: '#e0281d',
          700: '#b81d13',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#ff9500',  // Apple System Orange
          600: '#e08300',
          700: '#b36800',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#0071e3',  // Apple System Blue
          600: '#005bb5',
          700: '#00448a',
        },
      },
      borderRadius: {
        'apple-sm': '10px',
        'apple-md': '14px',
        'apple-lg': '18px',
        'apple-xl': '22px',
        'apple-2xl': '26px',
        'apple-3xl': '32px',
      },
      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'apple-md': '0 4px 14px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'apple-lg': '0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
        'apple-xl': '0 20px 48px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)',
        'apple-glow': '0 0 20px rgba(0, 113, 227, 0.35)',
      },
      fontSize: {
        // Apple HIG Typography Scale
        'apple-caption2': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }], // 11px
        'apple-caption1': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0' }],             // 12px
        'apple-footnote': ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '-0.005em' }], // 13px
        'apple-subheadline': ['0.9375rem', { lineHeight: '1.25rem', letterSpacing: '-0.01em' }], // 15px
        'apple-callout': ['1rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em' }],      // 16px
        'apple-body': ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.015em' }],     // 17px
        'apple-headline': ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.015em', fontWeight: '600' }], // 17px semibold
        'apple-title3': ['1.25rem', { lineHeight: '1.625rem', letterSpacing: '-0.015em' }],   // 20px
        'apple-title2': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],    // 22px
        'apple-title1': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.025em' }],   // 28px
        'apple-large-title': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.03em' }], // 34px
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"SF Pro"',
          '"Helvetica Neue"',
          'Anuphan',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
