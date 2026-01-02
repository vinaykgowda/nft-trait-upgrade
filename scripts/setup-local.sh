#!/bin/bash

echo "🚀 Setting up NFT Trait Marketplace for local development..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from example..."
    cp .env.local.example .env.local
    echo "⚠️  Please edit .env.local with your actual values before continuing"
    echo "   You'll need to set up:"
    echo "   - DATABASE_URL (PostgreSQL connection)"
    echo "   - SOLANA_DELEGATE_PRIVATE_KEY (devnet wallet)"
    echo "   - IRYS_PRIVATE_KEY (devnet wallet)"
    echo ""
    echo "Press Enter when you've configured .env.local..."
    read
fi

# Load environment variables
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set in .env.local"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set up database
echo "🗄️  Setting up database..."
npm run db:migrate:local

# Seed test data
echo "🌱 Seeding test data..."
npm run db:seed

echo ""
echo "✅ Local development setup complete!"
echo ""
echo "🎉 You can now start the development server:"
echo "   npm run dev"
echo ""
echo "📋 What's available:"
echo "   - Frontend: http://localhost:3000"
echo "   - Admin login: http://localhost:3000/admin/login"
echo "   - API docs: http://localhost:3000/api/docs"
echo "   - Health check: http://localhost:3000/api/health"
echo ""
echo "🔑 Default admin credentials:"
echo "   Username: admin"
echo "   Password: admin123"