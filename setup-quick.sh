#!/bin/bash

echo "🚀 Quick setup for NFT Trait Marketplace..."

# Start PostgreSQL with Docker
echo "📊 Starting PostgreSQL database..."
docker-compose up -d postgres

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Update DATABASE_URL in .env.local
echo "📝 Updating database URL..."
if [ -f ".env.local" ]; then
    # Update existing DATABASE_URL
    sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:password@localhost:5432/nft_marketplace_dev|' .env.local
else
    # Create .env.local if it doesn't exist
    cp .env.local.example .env.local
    sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:password@localhost:5432/nft_marketplace_dev|' .env.local
fi

# Run database migrations
echo "🗄️  Running database migrations..."
export DATABASE_URL="postgresql://postgres:password@localhost:5432/nft_marketplace_dev"
psql $DATABASE_URL -f database/migrations/001_initial_schema.sql

# Seed test data
echo "🌱 Seeding test data..."
node scripts/seed-local-data.js

echo ""
echo "✅ Quick setup complete!"
echo ""
echo "🎉 You can now:"
echo "   1. Restart your dev server: npm run dev"
echo "   2. Visit: http://localhost:3000/login"
echo "   3. Login with: admin / admin123"
echo ""
echo "🔧 To stop the database: docker-compose down"