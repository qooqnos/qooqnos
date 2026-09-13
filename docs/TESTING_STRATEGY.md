# 🧪 **TESTING_STRATEGY.md**

## فلسفه آزمایش

### اصول بنیادی
- **Test Pyramid**: واحد (70%) > ادغام (20%) > E2E (10%)
- **TDD-First**: تست نوشتن قبل از کد
- **Coverage Goal**: 80%+ کل کد
- **Fast Feedback**: تست‌های واحد < 100ms
- **Isolated Tests**: بدون وابستگی‌های خارجی

### استراتژی گسترده

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.spec.ts',
        '**/*.test.ts'
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    },
    include: ['**/*.spec.ts', '**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
```

## سطح اول: تست واحد (Unit Tests)

### الگوی تست
```typescript
// packages/core/src/errors/AppError.spec.ts
import { describe, it, expect } from 'vitest';
import { AppError, ValidationError, AuthorizationError } from './AppError';

describe('AppError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new AppError('Test error', 400);
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('toJSON', () => {
    it('should serialize error correctly', () => {
      const error = new ValidationError(['Field required']);
      const json = error.toJSON();
      
      expect(json).toEqual({
        message: expect.any(String),
        statusCode: 400,
        errors: ['Field required'],
        timestamp: expect.any(String)
      });
    });
  });
});
```

### تست خدمات
```typescript
// packages/modules/identity/src/services/AuthService.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './AuthService';
import { UserRepository } from '../infrastructure/UserRepository';
import { TokenService } from '../infrastructure/TokenService';
import { HashingService } from '../infrastructure/HashingService';
import { AuthorizationError, NotFoundError } from '@phoenix/core';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: UserRepository;
  let tokenService: TokenService;
  let hashingService: HashingService;

  beforeEach(() => {
    // Mock dependencies
    userRepository = vi.mocked({
      findByEmail: vi.fn(),
      create: vi.fn()
    });
    
    tokenService = vi.mocked({
      generate: vi.fn(),
      verify: vi.fn()
    });
    
    hashingService = vi.mocked({
      hash: vi.fn(),
      verify: vi.fn()
    });

    authService = new AuthService(
      userRepository,
      tokenService,
      hashingService
    );
  });

  describe('authenticate', () => {
    it('should authenticate valid user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        tenantId: 'tenant-123'
      };

      const mockToken = {
        token: 'jwt-token',
        expiresAt: new Date()
      };

      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(hashingService.verify).mockResolvedValue(true);
      vi.mocked(tokenService.generate).mockReturnValue(mockToken);

      const result = await authService.authenticate(
        'user@example.com',
        'password123'
      );

      expect(result).toEqual(mockToken);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(hashingService.verify).toHaveBeenCalledWith(
        'password123',
        'hashed-password'
      );
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      await expect(
        authService.authenticate('nonexistent@example.com', 'password')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for invalid password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        tenantId: 'tenant-123'
      };

      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(hashingService.verify).mockResolvedValue(false);

      await expect(
        authService.authenticate('user@example.com', 'wrongpassword')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('register', () => {
    it('should create new user account', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'secure-password-123'
      };

      const hashedPassword = 'hashed-secure-password-123';
      const createdUser = {
        id: 'new-user-123',
        email: newUser.email,
        passwordHash: hashedPassword,
        tenantId: 'tenant-123'
      };

      vi.mocked(hashingService.hash).mockResolvedValue(hashedPassword);
      vi.mocked(userRepository.create).mockResolvedValue(createdUser);

      const result = await authService.register(newUser.email, newUser.password);

      expect(result).toEqual(createdUser);
      expect(hashingService.hash).toHaveBeenCalledWith(newUser.password);
    });
  });
});
```

## سطح دوم: تست ادغام (Integration Tests)

```typescript
// packages/modules/identity/tests/integration/IdentityModule.integration.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IdentityModule } from '../../src/IdentityModule';
import { Database } from '@phoenix/database';
import { ModuleContext } from '@phoenix/core';

describe('IdentityModule Integration', () => {
  let module: IdentityModule;
  let database: Database;
  let context: ModuleContext;

  beforeEach(async () => {
    // Initialize test database
    database = new Database(process.env.TEST_DB_URL);
    
    // Create module context
    context = {
      database,
      services: new ServiceRegistry(),
      events: new EventBus(),
      cache: new CacheService(),
      queue: new QueueService(),
      logger: new Logger(),
      config: new ConfigService(),
      authorization: new AuthorizationService()
    };

    module = new IdentityModule();
    await module.initialize(context);
  });

  afterEach(async () => {
    await module.shutdown();
    await database.close();
  });

  describe('user lifecycle', () => {
    it('should create user -> authenticate -> logout flow', async () => {
      const userService = context.services.get<UserService>('UserService');
      const authService = context.services.get<AuthService>('AuthService');

      // 1. Create user
      const user = await userService.createUser({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        tenantId: 'tenant-123',
        workspaceId: 'workspace-123'
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.status).toBe('active');

      // 2. Authenticate
      const token = await authService.authenticate(
        'test@example.com',
        'SecurePass123!'
      );

      expect(token).toBeDefined();
      expect(token.expiresAt).toBeInstanceOf(Date);

      // 3. Verify token
      const verified = await authService.verifyToken(token.token);
      expect(verified.userId).toBe(user.id);

      // 4. Logout
      await authService.logout(token.token);

      // 5. Token should be invalid
      await expect(
        authService.verifyToken(token.token)
      ).rejects.toThrow();
    });
  });
});
```

## Coverage Configuration

```yaml
# .github/workflows/test-coverage.yml
name: Test Coverage

on: [push, pull_request]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with coverage
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```
