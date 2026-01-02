# Local Development Setup

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v14 or higher)
3. **Git**

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Local Database

#### Option A: Using Docker (Recommended)
```bash
# Start PostgreSQL with Docker
docker run --name nft-marketplace-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=nft_marketplace \
  -p 5432:5432 \
  -d postgres:14

# Wait a few seconds for the database to start, then run migrations
npm run db:migrate:local
```

#### Option B: Using Local PostgreSQL
```bash
# Create database
createdb nft_marketplace

# Run migrations
npm run db:migrate:local
```

### 3. Set Up Environment Variables

Copy the example environment file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your local settings (see configuration below).

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

## Environment Configuration

Create a `.env.local` file with these variables:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/nft_marketplace"

# Authentication (generate random 32+ character strings)
NEXTAUTH_SECRET="your-local-nextauth-secret-here-32-chars-minimum"
ADMIN_SESSION_SECRET="your-local-admin-secret-here-32-chars-minimum"

# Solana (for development, you can use devnet)
SOLANA_RPC_URL="https://api.devnet.solana.com"
SOLANA_DELEGATE_PRIVATE_KEY="your-devnet-wallet-private-key-here"

# Irys (for development)
IRYS_NODE_URL="https://devnet.irys.xyz"
IRYS_PRIVATE_KEY="your-devnet-wallet-private-key-here"

# Development flags
NODE_ENV="development"
NEXT_PUBLIC_SOLANA_NETWORK="devnet"
```

## Initial Setup & Testing

### 1. Create Admin User

Once the app is running, create your first admin user:

```bash
curl -X POST http://localhost:3000/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password"
  }'
```

### 2. Access Admin Dashboard

1. Go to: http://localhost:3000/admin/login
2. Login with your admin credentials
3. Set up your first project and traits

### 3. Test Public Interface

1. Go to: http://localhost:3000
2. Browse traits (works without wallet)
3. Connect a Solana wallet to test full functionality

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Database Operations

```bash
# Reset database (drops and recreates all tables)
npm run db:reset

# Run migrations
npm run db:migrate:local

# Seed test data
npm run db:seed
```

### Useful Development Commands

```bash
# Check API health
curl http://localhost:3000/api/health

# View API documentation
open http://localhost:3000/api/docs

# Check system status
curl http://localhost:3000/api/admin/system-health
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:5432
   ```
   - Make sure PostgreSQL is running
   - Check your DATABASE_URL in .env.local

2. **Missing Environment Variables**
   ```
   Error: Environment variable X is not defined
   ```
   - Copy .env.local.example to .env.local
   - Fill in all required variables

3. **Solana RPC Errors**
   ```
   Error: 429 Too Many Requests
   ```
   - Use a custom RPC endpoint
   - Add rate limiting delays

4. **Port Already in Use**
   ```
   Error: Port 3000 is already in use
   ```
   - Kill the process: `lsof -ti:3000 | xargs kill -9`
   - Or use a different port: `npm run dev -- -p 3001`

### Development Tips

1. **Hot Reload**: The development server supports hot reload for most changes
2. **Database Inspection**: Use a tool like pgAdmin or TablePlus to inspect your local database
3. **API Testing**: Use Postman or curl to test API endpoints
4. **Wallet Testing**: Use Phantom or Solflare wallet with devnet SOL

## Project Structure

```
src/
├── app/                 # Next.js app router
│   ├── api/            # API routes
│   ├── admin/          # Admin dashboard pages
│   └── page.tsx        # Public marketplace
├── components/         # React components
├── lib/               # Utilities and services
│   ├── auth/          # Authentication
│   ├── repositories/  # Database access
│   └── services/      # Business logic
└── types/             # TypeScript types

tests/
├── unit/              # Unit tests
├── property/          # Property-based tests
└── integration/       # Integration tests
```

## Next Steps

1. **Explore the Admin Dashboard**: Set up your project configuration
2. **Add Test Traits**: Upload some trait images and configure pricing
3. **Test Purchase Flow**: Use devnet SOL to test the complete purchase process
4. **Review Code**: Explore the codebase to understand the architecture
5. **Run Tests**: Execute the test suite to ensure everything works

## Getting Help

- Check the console for error messages
- Review the API documentation at `/api/docs`
- Look at the test files for usage examples
- Check the health endpoint for system status