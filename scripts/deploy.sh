#!/bin/bash

# NFT Trait Marketplace Deployment Script
set -e

echo "🚀 Starting deployment process..."

# Check if required environment variables are set
required_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET" 
    "ADMIN_SESSION_SECRET"
    "SOLANA_RPC_URL"
    "SOLANA_DELEGATE_PRIVATE_KEY"
    "PINATA_JWT"
    "PINATA_GATEWAY"
)

echo "✅ Checking environment variables..."
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set"
        exit 1
    fi
done

# Run database migrations
echo "📊 Running database migrations..."
if command -v psql &> /dev/null; then
    psql $DATABASE_URL -f database/migrations/001_initial_schema.sql
    echo "✅ Database migrations completed"
else
    echo "⚠️  psql not found, skipping database migrations"
    echo "   Please run migrations manually on your database"
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
if command -v vercel &> /dev/null; then
    vercel --prod
    echo "✅ Deployment completed successfully!"
else
    echo "❌ Vercel CLI not found. Please install with: npm i -g vercel"
    exit 1
fi

echo "🎉 Deployment process completed!"
echo "📋 Post-deployment checklist:"
echo "   1. Verify health endpoint: /api/health"
echo "   2. Test admin login functionality"
echo "   3. Check database connectivity"
echo "   4. Verify Solana RPC connectivity"
echo "   5. Test Irys upload functionality"