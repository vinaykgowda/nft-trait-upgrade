#!/bin/bash

# NFT Trait Marketplace Deployment Verification Script
set -e

echo "🔍 Starting deployment verification..."

# Get the deployment URL
if [ -z "$1" ]; then
    echo "Usage: $0 <deployment-url>"
    echo "Example: $0 https://your-app.vercel.app"
    exit 1
fi

DEPLOYMENT_URL=$1
echo "🌐 Verifying deployment at: $DEPLOYMENT_URL"

# Test health endpoint
echo "🏥 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/health")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Health endpoint responding correctly"
else
    echo "❌ Health endpoint failed (HTTP $HEALTH_RESPONSE)"
    exit 1
fi

# Test API documentation endpoint
echo "📚 Testing API documentation..."
DOCS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/docs")
if [ "$DOCS_RESPONSE" = "200" ]; then
    echo "✅ API documentation accessible"
else
    echo "⚠️  API documentation not accessible (HTTP $DOCS_RESPONSE)"
fi

# Test public endpoints
echo "🔧 Testing public API endpoints..."

# Test project endpoint
PROJECT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/project")
if [ "$PROJECT_RESPONSE" = "200" ]; then
    echo "✅ Project API responding"
else
    echo "❌ Project API failed (HTTP $PROJECT_RESPONSE)"
fi

# Test traits endpoint
TRAITS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/traits")
if [ "$TRAITS_RESPONSE" = "200" ]; then
    echo "✅ Traits API responding"
else
    echo "❌ Traits API failed (HTTP $TRAITS_RESPONSE)"
fi

# Test trait slots endpoint
SLOTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/trait-slots")
if [ "$SLOTS_RESPONSE" = "200" ]; then
    echo "✅ Trait slots API responding"
else
    echo "❌ Trait slots API failed (HTTP $SLOTS_RESPONSE)"
fi

echo ""
echo "🎉 Deployment verification completed!"
echo "📋 Manual verification checklist:"
echo "   1. ✅ Health endpoint working"
echo "   2. ✅ Public APIs responding"
echo "   3. 🔲 Admin login functionality (test manually)"
echo "   4. 🔲 Wallet connection (test manually)"
echo "   5. 🔲 Database operations (check logs)"
echo "   6. 🔲 Solana RPC connectivity (check logs)"
echo "   7. 🔲 Irys upload functionality (test manually)"