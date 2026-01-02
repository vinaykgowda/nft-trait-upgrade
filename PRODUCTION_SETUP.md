# Production Setup Guide

## 🚀 Quick Production Deployment

### Prerequisites Checklist

- [ ] Vercel account created
- [ ] Production PostgreSQL database ready (Neon/Supabase/Railway)
- [ ] Production Solana wallets created and funded
- [ ] Domain name ready (optional)

### 1. Environment Variables Setup

**CRITICAL**: You need to set these in Vercel Dashboard (not in code):

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project → Settings → Environment Variables
3. Add these variables (mark as "Sensitive"):

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# Secrets (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-32-char-secret-here
ADMIN_SESSION_SECRET=your-32-char-admin-secret-here

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Wallet Keys (base58 format)
SOLANA_DELEGATE_PRIVATE_KEY=your-delegate-key-base58
IRYS_PRIVATE_KEY=your-irys-key-base58
UPDATE_AUTHORITY_PRIVATE_KEY=your-update-authority-key-base58

# Irys Storage
IRYS_NODE_URL=https://node1.irys.xyz

# App Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# NFT Collection (update with your values)
NFT_CREATOR_ADDRESS=your-creator-address
NFT_COLLECTION_SYMBOL=your-symbol
NFT_SELLER_FEE_BASIS_POINTS=690
TREASURY_WALLET=your-treasury-wallet
LDZ_TOKEN_MINT=your-token-mint
```

### 2. Database Setup

**Option A: Neon (Recommended)**
1. Go to [Neon](https://neon.tech)
2. Create new project
3. Copy connection string
4. Run migrations:
```bash
psql "your-connection-string" -f database/migrations/001_initial_schema.sql
```

**Option B: Supabase**
1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Go to Settings → Database
4. Copy connection string
5. Run migrations

### 3. Wallet Setup

**Create Production Wallets:**
```bash
# Generate new keypair for production
solana-keygen new --outfile production-keypair.json

# Get the address
solana-keygen pubkey production-keypair.json

# Convert to base58 for environment variables
node -e "
const fs = require('fs');
const keypair = JSON.parse(fs.readFileSync('production-keypair.json'));
const base58 = require('bs58');
console.log(base58.encode(Buffer.from(keypair)));
"
```

**Fund Your Wallets:**
- Send SOL to delegate wallet (for transaction fees)
- Fund Irys wallet for storage costs
- Keep update authority wallet secure and offline

### 4. Deploy to Vercel

**Method 1: Automated Script**
```bash
./scripts/deploy-production.sh
```

**Method 2: Manual**
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 5. Post-Deployment Setup

**Run Database Migrations:**
```bash
# Connect to your production database and run:
psql "your-production-database-url" -f database/migrations/001_initial_schema.sql
```

**Verify Deployment:**
```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health

# Test admin login
curl -X POST https://your-app.vercel.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

### 6. Security Checklist

- [ ] All environment variables set as "Sensitive" in Vercel
- [ ] Database uses SSL connections
- [ ] Update authority wallet kept offline
- [ ] Strong passwords for admin accounts
- [ ] MFA enabled for admin accounts
- [ ] Regular key rotation scheduled

### 7. Monitoring Setup

**Health Monitoring:**
- Set up uptime monitoring for `/api/health`
- Monitor database performance
- Track Solana RPC response times
- Monitor Irys upload success rates

**Error Tracking:**
- Check Vercel function logs regularly
- Set up alerts for critical errors
- Monitor transaction failure rates

## 🔧 Troubleshooting

### Common Issues

**Database Connection Errors:**
- Verify DATABASE_URL format
- Check SSL requirements
- Ensure database is accessible from Vercel

**Solana RPC Issues:**
- Test RPC endpoint manually
- Consider using Helius or QuickNode for better performance
- Check rate limits

**Wallet Issues:**
- Verify private key format (base58)
- Ensure wallets are funded
- Check network configuration (mainnet vs devnet)

**Build Failures:**
- Check for TypeScript errors
- Verify all dependencies are installed
- Review Vercel build logs

### Getting Help

1. Check Vercel function logs
2. Review database connection logs
3. Test API endpoints manually
4. Check browser console for frontend issues

## 📊 Performance Optimization

### Database
- Enable connection pooling
- Add database indexes for frequently queried fields
- Monitor query performance
- Consider read replicas for analytics

### API
- Enable response caching where appropriate
- Optimize image sizes and formats
- Use CDN for static assets
- Monitor API response times

### Frontend
- Optimize bundle size
- Enable Next.js image optimization
- Use lazy loading for components
- Cache wallet connections

## 🔄 Maintenance

### Regular Tasks
- Monitor error rates and performance
- Review and rotate security keys
- Update dependencies
- Clean up expired reservations
- Review audit logs

### Scaling Considerations
- Monitor database performance as usage grows
- Consider upgrading Solana RPC for higher throughput
- Plan for increased Irys storage costs
- Monitor Vercel function execution limits

---

**Need Help?** Check the troubleshooting section or review the deployment logs in Vercel dashboard.