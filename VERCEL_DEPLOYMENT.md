# Vercel Deployment Guide

## 🚀 Deploy to Vercel in 5 Steps

### Step 1: Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository: `vinaykgowda/nft-trait-upgrade`
4. Click "Deploy" (it will fail initially - that's expected)

### Step 2: Set Up Database

**Option A: Neon (Recommended)**
1. Go to [Neon](https://neon.tech) and create account
2. Create new project
3. Copy the connection string
4. It should look like: `postgresql://username:password@host/database?sslmode=require`

**Option B: Supabase**
1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Go to Settings → Database
4. Copy connection string

### Step 3: Configure Environment Variables in Vercel

1. In Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these variables (mark each as "Sensitive"):

```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# Generate secrets with: openssl rand -base64 32
NEXTAUTH_SECRET=your-32-character-secret-here
ADMIN_SESSION_SECRET=your-32-character-admin-secret-here

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Wallet Keys (you'll need to convert your keypairs to base58)
SOLANA_DELEGATE_PRIVATE_KEY=your-base58-delegate-key
IRYS_PRIVATE_KEY=your-base58-irys-key
UPDATE_AUTHORITY_PRIVATE_KEY=your-base58-update-authority-key

# Storage
IRYS_NODE_URL=https://node1.irys.xyz

# App Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app-name.vercel.app

# NFT Collection (update with your values)
NFT_CREATOR_ADDRESS=EE72RERKxoJFt61MFZSnWvztjD43zPDr2aVizkS41nLC
NFT_COLLECTION_SYMBOL=PGV2
NFT_SELLER_FEE_BASIS_POINTS=690
TREASURY_WALLET=EE72RERKxoJFt61MFZSnWvztjD43zPDr2aVizkS41nLC
LDZ_TOKEN_MINT=E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK
```

### Step 4: Convert Keypairs to Base58

If you have keypair.json files, convert them:

```bash
# Install base58 if you don't have it
npm install -g bs58

# Convert keypair to base58
node -e "
const fs = require('fs');
const bs58 = require('bs58');
const keypair = JSON.parse(fs.readFileSync('your-keypair.json'));
console.log(bs58.encode(Buffer.from(keypair)));
"
```

### Step 5: Run Database Migrations

After deployment, run migrations on your production database:

```bash
# Connect to your production database
psql "your-production-database-url" -f database/migrations/001_initial_schema.sql
```

## ✅ Verification

After deployment, test these endpoints:

1. **Health Check**: `https://your-app.vercel.app/api/health`
2. **API Docs**: `https://your-app.vercel.app/api/docs`
3. **Admin Login**: `https://your-app.vercel.app/admin/login`

## 🔧 Troubleshooting

### Build Failures
- Check Vercel build logs
- Ensure all environment variables are set
- Verify TypeScript compilation locally

### Database Connection Issues
- Verify DATABASE_URL format
- Check database server accessibility
- Ensure SSL is enabled

### Wallet/Blockchain Issues
- Verify private key format (base58)
- Check Solana RPC endpoint
- Ensure wallets are funded

### Environment Variable Issues
- Ensure all required variables are set
- Mark sensitive variables as "Sensitive"
- Check for typos in variable names

## 🚀 Post-Deployment

1. **Create Admin User**: Use the admin API to create your first admin
2. **Upload Traits**: Use the admin panel to upload trait images
3. **Configure Projects**: Set up your NFT projects and tokens
4. **Test Purchase Flow**: Complete end-to-end testing

## 📊 Monitoring

Set up monitoring for:
- Health endpoint uptime
- API response times
- Database performance
- Transaction success rates

## 🔄 Updates

To deploy updates:
1. Push changes to your GitHub repository
2. Vercel will automatically deploy
3. Monitor deployment in Vercel dashboard

---

**Need Help?** Check the [full production setup guide](./PRODUCTION_SETUP.md) or open an issue.