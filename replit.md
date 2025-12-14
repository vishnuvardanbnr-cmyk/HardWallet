# Vault Key

## Overview

Vault Key is a secure hardware wallet application built with a modern full-stack TypeScript architecture. The project features a React frontend with a minimalist, security-focused design aesthetic inspired by products like Ledger and Trezor. The application emphasizes trust, simplicity, and a tech-forward user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and data fetching
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful endpoints prefixed with `/api`
- **Development Server**: Vite middleware integration for HMR during development
- **Production**: Static file serving from built assets

### Data Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` for shared type definitions between client and server
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Storage Pattern**: Interface-based storage abstraction (`IStorage`) allowing in-memory or database implementations

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and query client
│   │   └── pages/          # Route page components
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code between client/server
│   └── schema.ts     # Database schema and types
└── migrations/       # Drizzle database migrations
```

### Design System
- Follows documented design guidelines in `design_guidelines.md`
- Uses Inter/Space Grotesk fonts via Google Fonts CDN
- Extreme minimalism with centered layouts
- Security-focused aesthetic with professional, clean visuals

## Recent Changes
- **Custom Token Support** (Dec 2024): Added ability to track any ERC-20, BEP-20, or TRC-20 token:
  - Add custom tokens via contract address in Manage Crypto page
  - Auto-fetch token info (name, symbol, decimals) for EVM chains
  - Manual entry for TRON tokens
  - Custom token balances displayed on dashboard
  - Tokens persisted in IndexedDB via client-storage
- **Polkadot (DOT) Wallet Support** (Dec 2024): Added Polkadot blockchain support with:
  - SLIP-0010 ed25519 key derivation (path: m/44'/354'/accountIndex'/0'/0')
  - SS58 address encoding with Blake2b-512 checksum
  - Native DOT chain in default chains list
- **Independent Seed Per Wallet** (Dec 2024): Users can now create additional wallets with either:
  1. Derive from existing seed (uses main seed with different account index)
  2. Generate new seed phrase (creates completely independent wallet with its own seed and PIN)

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI Framework
- **Radix UI**: Complete primitive component library (dialogs, menus, forms, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **Lucide React**: Icon library

### Data & Forms
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Form state management
- **Zod**: Runtime schema validation

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server-side bundling for production
- **tsx**: TypeScript execution for development

### Additional Libraries
- **wouter**: Lightweight React router
- **date-fns**: Date manipulation utilities
- **embla-carousel-react**: Carousel component
- **vaul**: Drawer component
- **cmdk**: Command palette component
- **react-day-picker**: Calendar component
- **recharts**: Charting library
- **react-resizable-panels**: Resizable panel layouts