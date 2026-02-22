# NFT Trait Marketplace

A comprehensive NFT trait marketplace built on Solana with Metaplex Core, enabling users to purchase and apply traits to their NFTs with mixed payment support (SOL + custom tokens).

## 🚀 Quick Start

### Local Development
```bash
git clone https://github.com/vinaykgowda/nft-trait-upgrade.git
cd nft-trait-upgrade
npm install
cp .env.local.example .env.local
# Edit .env.local with your configuration
npm run dev:setup
npm run dev
```

### Production Deployment on Vercel

1. **Fork/Clone this repository**
2. **Connect to Vercel**: Import your GitHub repository to Vercel
3. **Set Environment Variables**: Configure production variables in Vercel dashboard
4. **Deploy**: Vercel will automatically deploy on push to main

## 📋 Production Setup Checklist

### 1. Database Setup
- [ ] Create PostgreSQL database (Neon/Supabase/Railway recommended)
- [ ] Run database migrations
- [ ] Verify connection

### 2. Solana Configuration
- [ ] Create production wallets (delegate, update authority)
- [ ] Fund wallets with SOL for transaction fees
- [ ] Convert keypairs to base58 format for environment variables

### 3. Vercel Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# Authentication (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-32-char-secret
ADMIN_SESSION_SECRET=your-32-char-admin-secret

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Wallet Keys (base58 format)
SOLANA_DELEGATE_PRIVATE_KEY=your-delegate-key-base58
UPDATE_AUTHORITY_PRIVATE_KEY=your-update-authority-key-base58

# Storage - Pinata IPFS
PINATA_JWT=your-pinata-jwt-token
PINATA_GATEWAY=your-gateway-subdomain.mypinata.cloud

# App Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# NFT Collection Configuration
NFT_CREATOR_ADDRESS=your-creator-address
NFT_COLLECTION_SYMBOL=your-symbol
NFT_SELLER_FEE_BASIS_POINTS=690
TREASURY_WALLET=your-treasury-wallet
LDZ_TOKEN_MINT=your-token-mint
```

### 4. Post-Deployment
- [ ] Run database migrations on production database
- [ ] Create admin user
- [ ] Test all functionality
- [ ] Monitor health endpoint: `/api/health`

## 🏗️ Architecture

### Core Features
- **NFT Trait System**: Browse, preview, and purchase traits for NFTs
- **Mixed Payments**: Support for SOL + custom SPL tokens
- **Image Composition**: Real-time trait preview and composition
- **Admin Panel**: Comprehensive trait and project management
- **Blockchain Integration**: Metaplex Core for NFT updates

### Tech Stack
- **Frontend**: Next.js 14, React, TailwindCSS
- **Backend**: Next.js API routes, PostgreSQL
- **Blockchain**: Solana, Metaplex Core, @solana/web3.js
- **Storage**: Pinata IPFS (decentralized storage)
- **Authentication**: Custom JWT with MFA support
- **Testing**: Jest, Property-based testing

### Environment Variables

**PINATA_JWT**: JWT token for authenticating with Pinata's IPFS API. Get this from your [Pinata dashboard](https://app.pinata.cloud) under API Keys.

**PINATA_GATEWAY**: Your dedicated Pinata gateway subdomain (e.g., `fun-llama-300.mypinata.cloud`). This is used to construct IPFS gateway URLs for accessing uploaded content.

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── admin/             # Admin panel pages
│   └── marketplace/       # Public marketplace
├── components/            # React components
├── lib/                   # Core business logic
│   ├── services/          # Business services
│   ├── repositories/      # Data access layer
│   └── auth/              # Authentication
└── types/                 # TypeScript definitions

database/
├── migrations/            # Database migrations
└── schema.sql            # Complete schema

scripts/                   # Utility scripts
tests/                     # Test suites
```

## 🔧 Development

### Available Scripts
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run test             # Run test suite
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed development data
```

### Key APIs
- `GET /api/health` - Health check
- `GET /api/traits` - Browse available traits
- `POST /api/tx/build` - Build purchase transaction
- `POST /api/tx/confirm` - Confirm transaction
- `GET /api/user/nfts` - User's NFT collection

## 🔒 Security Features

- **Multi-Factor Authentication** for admin access
- **Rate Limiting** on all API endpoints
- **CSRF Protection** for state-changing operations
- **Input Validation** with Zod schemas
- **Secure Session Management** with JWT
- **SQL Injection Protection** with parameterized queries

## 📊 Monitoring

### Health Monitoring
- Health endpoint: `/api/health`
- System health dashboard: `/admin/system-health`
- Performance metrics: `/admin/analytics`

### Error Handling
- Comprehensive error logging
- Categorized error responses
- Audit trail for admin actions

## 🚀 Deployment Options

### Vercel (Recommended)
1. Connect GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push

### Manual Deployment
```bash
./scripts/deploy-production.sh
```

### Docker (Alternative)
```bash
docker-compose up -d
```

## 📚 Documentation

- [Production Setup Guide](./PRODUCTION_SETUP.md)
- [Local Development](./LOCAL_DEVELOPMENT.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./src/lib/api/documentation.ts)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- Check the [troubleshooting guide](./PRODUCTION_SETUP.md#troubleshooting)
- Review [deployment documentation](./DEPLOYMENT.md)
- Open an issue for bugs or feature requests

---

**Ready to deploy?** Follow the [Production Setup Guide](./PRODUCTION_SETUP.md) for detailed instructions.