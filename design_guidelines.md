# Design Guidelines: Vault Key Welcome Screen

## Design Approach
**Reference-Based Approach**: Drawing inspiration from security-focused tech products like Ledger, Trezor, and Apple's minimalist product launches. The design emphasizes trust, simplicity, and modern technology.

## Core Design Principles
- **Extreme Minimalism**: Single-purpose screen with zero distractions
- **Trust & Security**: Professional, clean aesthetic that conveys reliability
- **Centered Focus**: All content centered vertically and horizontally
- **Tech-Forward**: Modern, sleek design befitting a hardware wallet

## Typography
**Primary Font**: Inter or Space Grotesk (via Google Fonts CDN)
- Logo/Brand: 2xl to 3xl, semibold (text-2xl sm:text-3xl font-semibold)
- Welcome Heading: 4xl to 6xl, bold (text-4xl sm:text-6xl font-bold)
- Tagline (if used): lg to xl, normal weight (text-lg sm:text-xl)
- Button Text: base, medium weight (text-base font-medium)

**Hierarchy**: Large welcome text as focal point, brand name above it, optional minimal tagline below

## Layout System
**Spacing Primitives**: Use Tailwind units of 4, 6, 8, 12, and 16
- Between logo and welcome text: mt-8 to mt-12
- Between welcome text and tagline: mt-6
- Between content and button: mt-12 to mt-16
- Screen padding: p-8

**Container**: Full viewport height (min-h-screen) with flex centering (flex items-center justify-center)

**Content Width**: No max-width constraints - let content breathe naturally with internal padding

## Component Structure

### Welcome Screen Layout
```
Centered Container (full viewport)
├── Brand/Logo
│   └── "VAULT KEY" or icon + text
├── Welcome Heading
│   └── "Welcome" (hero size)
├── Optional Tagline
│   └── "Secure Hardware Wallet" (subtle)
└── Single CTA Button
    └── "Get Started" or "Continue"
```

### Button Component
- Size: Generous padding (px-8 py-4 to px-12 py-5)
- Shape: Rounded corners (rounded-lg to rounded-xl)
- Typography: Medium weight, letter-spaced
- Single button only - no secondary actions

## Visual Treatment
**Background**: Solid or subtle gradient - no busy patterns
**Depth**: Minimal shadows - rely on spacing and typography
**Icons**: Use Heroicons for any minimal iconography (logo shield, lock symbol if used)

## Animations
**Entry Animation Only**: Subtle fade-in for content on load
- Welcome text: Fade + slight upward movement
- Duration: 600-800ms
- Easing: ease-out
**No hover animations**: Keep interactions instant and crisp

## Images
**No Hero Image Required**: This is a minimal welcome screen - rely on typography and space, not imagery. If branding includes a logo icon, use SVG or icon font. 

**Optional**: Small lock/shield icon above welcome text for security emphasis (32-48px size)

## Accessibility
- High contrast text against background
- Large touch targets for button (minimum 44x44px)
- Semantic HTML (h1 for welcome, button element)
- Focus states with visible outline

## Key Constraints
- **Single Screen**: No scrolling, everything visible in viewport
- **Minimal Elements**: 3-5 elements maximum (logo, heading, optional tagline, button)
- **Centered Everything**: Vertical and horizontal centering
- **No Navigation**: This is entry point - no header/footer
- **Mobile-First**: Must work perfectly on all screen sizes

## Design Success Criteria
The welcome screen should feel like opening a premium hardware device - clean, confident, and trustworthy. Every pixel serves a purpose. Nothing is excessive.