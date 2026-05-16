import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
  			},
			'brand-primary': 'var(--brand-primary)',
			mk: {
				navy: {
					900: 'var(--mk-navy-900)',
					800: 'var(--mk-navy-800)',
					700: 'var(--mk-navy-700)'
				},
				indigo: {
					600: 'var(--mk-indigo-600)',
					500: 'var(--mk-indigo-500)',
					100: 'var(--mk-indigo-100)'
				},
				sky: {
					500: 'var(--mk-sky-500)'
				},
				bg: {
					DEFAULT: 'var(--mk-bg)',
					alt: 'var(--mk-bg-alt)',
					dark: 'var(--mk-bg-dark)'
				},
				border: 'var(--mk-border)',
				text: {
					DEFAULT: 'var(--mk-text)',
					muted: 'var(--mk-text-muted)',
					subtle: 'var(--mk-text-subtle)'
				},
				success: 'var(--mk-success)',
				warning: 'var(--mk-warning)',
				danger: 'var(--mk-danger)'
			},
   			secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
  			},
  			success: {
  				DEFAULT: '#059669',
  				foreground: '#ffffff',
  				light: '#10b981'
  			},
  			warning: {
  				DEFAULT: '#d97706',
  				foreground: '#ffffff',
  				light: '#f59e0b'
  			},
  			danger: {
  				DEFAULT: '#dc2626',
  				foreground: '#ffffff',
  				light: '#ef4444'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
		keyframes: {
			'gradient-border': {
				'0%, 100%': {
					backgroundPosition: '0% 50%'
				},
				'50%': {
					backgroundPosition: '100% 50%'
				}
			},
			'accordion-down': {
				from: {
					height: '0'
				},
				to: {
					height: 'var(--radix-accordion-content-height)'
				}
			},
			'accordion-up': {
				from: {
					height: 'var(--radix-accordion-content-height)'
				},
				to: {
					height: '0'
				}
			}
		},
		animation: {
			'gradient-border': 'gradient-border 8s linear infinite',
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out'
		},
   		fontFamily: {
   			sans: [
  				'var(--font-inter)',
   				'system-ui',
   				'sans-serif'
   			],
   			display: [
   				'var(--font-space-grotesk)',
   				'var(--font-inter)',
   				'system-ui',
   				'sans-serif'
   			]
   		},
			boxShadow: {
				'mk-sm': 'var(--mk-shadow-sm)',
				'mk-md': 'var(--mk-shadow-md)',
				'mk-lg': 'var(--mk-shadow-lg)',
				'mk-glow': 'var(--mk-shadow-glow)'
			}
   	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
