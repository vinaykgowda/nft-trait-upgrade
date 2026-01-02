#!/bin/bash

# Production Deployment Script for NFT Trait Marketplace
set -e

echo "🚀 Starting production deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production file not found."
    echo "Please create .env.production with your production environment variables."
    exit 1
fi

# Check if git is initialized and has commits
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Git repository not initialized."
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: You have uncommitted changes."
    read -p "Do you want to commit them now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Production deployment $(date)"
    else
        echo "❌ Please commit your changes before deploying."
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm test

# Build the application
echo "🔨 Building application..."
npm run build

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
npx vercel --prod

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set up your environment variables in Vercel dashboard"
echo "2. Run database migrations on your production database"
echo "3. Verify deployment with: npm run deploy:verify"
echo ""
echo "🔗 Don't forget to:"
echo "   - Set up your production database"
echo "   - Configure environment variables in Vercel"
echo "   - Fund your Solana wallets"
echo "   - Test the complete flow"