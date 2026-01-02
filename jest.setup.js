import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill for TextEncoder/TextDecoder in Node.js test environment
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock Web APIs for Next.js server environment
global.Request = class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map(Object.entries(options.headers || {}));
    this.body = options.body;
  }
  
  async json() {
    return JSON.parse(this.body || '{}');
  }
  
  async text() {
    return this.body || '';
  }
};

global.Response = class MockResponse {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = new Map(Object.entries(options.headers || {}));
  }
  
  async json() {
    return JSON.parse(this.body || '{}');
  }
  
  async text() {
    return this.body || '';
  }
};

global.Headers = class MockHeaders extends Map {
  constructor(init) {
    super();
    if (init) {
      if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.set(key, value));
      } else if (typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => this.set(key, value));
      }
    }
  }
  
  get(name) {
    return super.get(name.toLowerCase());
  }
  
  set(name, value) {
    return super.set(name.toLowerCase(), value);
  }
  
  has(name) {
    return super.has(name.toLowerCase());
  }
  
  delete(name) {
    return super.delete(name.toLowerCase());
  }
};

global.URL = class MockURL {
  constructor(url, base) {
    const fullUrl = base ? new URL(url, base).href : url;
    const parsed = new URL(fullUrl);
    this.href = parsed.href;
    this.origin = parsed.origin;
    this.protocol = parsed.protocol;
    this.host = parsed.host;
    this.hostname = parsed.hostname;
    this.port = parsed.port;
    this.pathname = parsed.pathname;
    this.search = parsed.search;
    this.searchParams = new URLSearchParams(parsed.search);
    this.hash = parsed.hash;
  }
};

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.DELEGATE_PRIVATE_KEY = 'test-private-key'

// Mock jose library
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token'),
  })),
  jwtVerify: jest.fn().mockResolvedValue({
    payload: {
      userId: 'test-user',
      username: 'testuser',
      roles: ['admin'],
      mfaVerified: true,
      loginTime: Date.now(),
      expiresAt: Date.now() + 86400000,
    },
  }),
}));