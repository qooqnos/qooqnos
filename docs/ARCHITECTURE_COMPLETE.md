# 🏗️ **PHOENIX_COMPLETE_ARCHITECTURE.md**

# PHOENIX AI MARKETPLACE - معماری کامل جامع

---

## 📑 فهرست

1. [خلاصه اجرایی](#خلاصه-اجرایی)
2. [معماری بنیاد](#معماری-بنیاد)
3. [معماری ماژول](#معماری-ماژول)
4. [معماری پایگاه داده](#معماری-پایگاه-داده)
5. [معماری API](#معماری-api)
6. [معماری امنیت](#معماری-امنیت)
7. [معماری ابرساخت](#معماری-ابرساخت)
8. [استراتژی آزمایش](#استراتژی-آزمایش)
9. [استراتژی استقرار](#استراتژی-استقرار)
10. [نظارت و رصد](#نظارت-و-رصد)
11. [خط لوله CI/CD](#خط-لوله-cicd)
12. [راهنمای توسعه](#راهنمای-توسعه)

---

## خلاصه اجرایی

### Vision
Phoenix AI Marketplace یک بازاریابی چند‌مستاجر و هوش مصنوعی است که مشتریان را به تجار، خدمات و محصولات متناسب متصل می‌کند.

### Architecture Blueprint
- **Pattern**: Modular Monolith
- **Infrastructure**: Cloudflare (Workers, D1, R2, Queues, Vectorize)
- **Language**: TypeScript
- **Framework**: Hono.js
- **Database**: SQLite (D1)
- **Package Manager**: npm@11, Node.js@22

### Tech Stack
```
┌─────────────────────────────────────────┐
│         Frontend (React/Next.js)         │
├─────────────────────────────────────────┤
│     API Layer (Hono.js / REST / GraphQL)│
├─────────────────────────────────────────┤
│        Module Layer (15+ Modules)       │
├─────────────────────────────────────────┤
│      Core Services Layer (Runtime)      │
├─────────────────────────────────────────┤
│    Infrastructure (Cloudflare Workers)  │
├─────────────────────────────────────────┤
│  D1(DB) | R2(Files) | Queues | Vectorize
└─────────────────────────────────────────┘
```

---

## معماری بنیاد

### 1. ساختار Monorepo

```
qooqnos/
├── packages/
│   ├── core/                    # هسته اساسی
│   │   ├── src/
│   │   │   ├── types/          # Type definitions
│   │   │   ├── errors/         # Custom error classes
│   │   │   ├── constants/      # Application constants
│   │   │   ├── utils/          # Utility functions
│   │   │   ├── middleware/     # Common middleware
│   │   │   └── di/             # Dependency Injection
│   │   └── package.json
│   │
│   ├── database/                # لایه دسترسی داده‌ها
│   │   ├── src/
│   │   │   ├── connection/     # D1 wrapper
│   │   │   ├── migrations/     # Migration runner
│   │   │   ├── repository/     # Base repository
│   │   │   └── seeds/          # Database seeds
│   │   ├── migrations/         # SQL migrations
│   │   └── package.json
│   │
│   ├── runtime/                 # محیط اجرایی
│   │   ├── src/
│   │   │   ├── boot/           # Application boot
│   │   │   ├── event/          # Event bus
│   │   │   ├── queue/          # Queue service
│   │   │   ├── cache/          # Cache service
│   │   │   └── scheduler/      # Job scheduler
│   │   └── package.json
│   │
│   ├── api/                     # لایه HTTP API
│   │   ├── src/
│   │   │   ├── http/           # Server setup
│   │   │   ├── middleware/     # API middleware
│   │   │   ├── graphql/        # GraphQL support
│   │   │   └── routes/         # API routes
│   │   └── package.json
│   │
│   ├── modules/                 # Feature modules
│   │   ├── identity/            # Auth & Users
│   │   ├── authorization/       # RBAC/ABAC
│   │   ├── catalog/             # Products/Services
│   │   ├── discovery/           # Search & Matching
│   │   ├── booking/             # Reservations
│   │   ├── payment/             # Transactions
│   │   ├── communications/      # Notifications
│   │   ├── crm/                 # Relationships
│   │   ├── analytics/           # Observability
│   │   ├── media/               # File handling
│   │   ├── reviews/             # Ratings
│   │   └── [more modules...]
│   │
│   ├── shared/                  # Shared libraries
│   │   ├── ui-kit/              # UI components
│   │   ├── validators/          # Validation rules
│   │   ├── i18n/                # Translations
│   │   └── icons/               # Icon library
│   │
│   └── ui/                      # Frontend app
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   └── styles/
│       └── package.json
│
├── migrations/                  # SQL migrations
├── .claude/                     # Claude skills
│   └── skills/
│       ├── phoenix-architect/
│       ├── phoenix-implementation/
│       └── [24 more skills]
├── docs/                        # Documentation
├── .github/workflows/           # CI/CD pipelines
├── CLAUDE.md                    # Claude instructions
├── package.json
├── tsconfig.base.json
└── wrangler.toml                # Cloudflare config
```

### 2. Core Package Structure

```typescript
// packages/core/src/types/index.ts

// Base types for entire application
export interface Entity {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface AggregateRoot extends Entity {
  version: number;
  uncommittedEvents: DomainEvent[];
}

export interface Service {
  moduleName: string;
  permissions: string[];
}

export interface DomainEvent {
  eventId: string;
  eventName: string;
  aggregateId: string;
  aggregateType: string;
  tenantId: string;
  timestamp: Date;
  payload: any;
  metadata: Record<string, any>;
}

// Error hierarchy
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(public errors: string[]) {
    super('Validation failed', 400, 'VALIDATION_ERROR', { errors });
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
```

---

## معماری ماژول

### 1. Module Interface

```typescript
// packages/core/src/types/module.types.ts

export interface IModule {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly dependencies: string[];
  readonly permissions: Record<string, string>;
  readonly events: string[];
  
  initialize(context: ModuleContext): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ModuleContext {
  services: ServiceRegistry;
  database: DatabaseService;
  events: EventBus;
  cache: CacheService;
  queue: QueueService;
  logger: Logger;
  config: ConfigService;
  authorization: AuthorizationService;
}

export interface IRepository<T extends Entity> {
  findById(id: string, tenantId: string): Promise<T | null>;
  findAll(tenantId: string, filters?: any): Promise<T[]>;
  create(entity: T, tenantId: string): Promise<T>;
  update(entity: T, tenantId: string): Promise<T>;
  delete(id: string, tenantId: string): Promise<void>;
}
```

### 2. Identity Module

```typescript
// packages/modules/identity/src/IdentityModule.ts

export class IdentityModule implements IModule {
  readonly name = 'identity';
  readonly version = '1.0.0';
  readonly description = 'User identity and authentication';
  
  readonly dependencies = ['database', 'runtime'];
  
  readonly permissions = {
    USER_CREATE: 'identity:user:create',
    USER_READ: 'identity:user:read',
    USER_UPDATE: 'identity:user:update',
    WORKSPACE_CREATE: 'identity:workspace:create',
    TEAM_CREATE: 'identity:team:create'
  };
  
  readonly events = [
    'identity.user.created',
    'identity.user.authenticated',
    'identity.workspace.created',
    'identity.team.created'
  ];
  
  async initialize(context: ModuleContext): Promise<void> {
    // Register services
    context.services.register('UserService', 
      new UserService(context));
    context.services.register('AuthService', 
      new AuthService(context));
    context.services.register('WorkspaceService', 
      new WorkspaceService(context));
    
    // Register repositories
    context.services.register('UserRepository', 
      new UserRepository(context.database));
    
    // Run migrations
    await context.database.runMigrations('identity');
    
    // Subscribe to events
    context.events.subscribe('identity.user.created', 
      this.onUserCreated.bind(this));
  }
  
  async shutdown(): Promise<void> {
    // Cleanup
  }
}
```

### 3. Module Lifecycle

هر ماژول دارای چرخه عمر:

1. **Initialization**: سرویس‌ها و repositories ثبت می‌شوند
2. **Activation**: ماژول فعال می‌شود
3. **Runtime**: عملیات عادی
4. **Shutdown**: تمیز‌سازی منابع

---

## معماری پایگاه داده

### 1. Schema Overview

```
Identity Layer:
├── organizations (مالکین)
├── workspaces (فضاهای کاری)
├── users (کاربران)
├── teams (تیم‌ها)
└── team_members (اعضای تیم)

Authorization Layer:
├── roles (نقش‌ها)
├── permissions (دسترسی‌ها)
├── role_permissions (نقش - دسترسی)
└── user_roles (کاربر - نقش)

Catalog Layer:
├── categories (دسته‌بندی‌ها)
├── products (محصولات)
├── services (خدمات)
└── product_variants (انواع محصول)

Transactional Layer:
├── bookings (رزرو‌ها)
├── payments (پرداخت‌ها)
├── invoices (فاکتورها)
└── transactions (تراکنش‌ها)

Analytics Layer:
├── events (رویدادها)
├── metrics (معیارها)
└── audit_logs (گزارش‌های حسابرسی)
```

### 2. Multi-Tenancy Design

هر جدول کاربر‌مرکز حتماً دارای `tenant_id`:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,        -- Multi-tenancy
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  -- ... other fields
  
  UNIQUE(tenant_id, email),       -- Tenant scoping
  FOREIGN KEY (tenant_id) REFERENCES organizations(id)
);

-- Indexes for tenant queries
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
```

### 3. Migration Strategy

```typescript
// packages/database/src/migrations/MigrationRunner.ts

export class MigrationRunner {
  async runMigrations(context: string): Promise<void> {
    const files = await this.getMigrationFiles(context);
    
    for (const file of files) {
      const { name, sql } = file;
      
      try {
        await this.db.execute(sql);
        await this.recordMigration(name);
        console.log(`✓ Migration: ${name}`);
      } catch (error) {
        console.error(`✗ Migration failed: ${name}`);
        throw error;
      }
    }
  }
}
```

---

## معماری API

### 1. RESTful Endpoints Structure

```
/api/v1/
├── auth/
│   ├── POST /register           # ثبت نام
│   ├── POST /login              # ورود
│   ├── POST /logout             # خروج
│   ├── POST /refresh-token      # تازه‌سازی توکن
│   └── POST /mfa/setup          # تنظیم 2FA
│
├── users/
│   ├── GET /profile             # پروفایل کاربر
│   ├── PATCH /profile           # تعدیل پروفایل
│   ├── GET /workspaces          # فضاهای کاری کاربر
│   └── GET /:id                 # اطلاعات کاربر
│
├── workspaces/
│   ├── POST /                   # ایجاد workspace
│   ├── GET /                    # لیست workspaces
│   ├── GET /:id                 # جزئیات workspace
│   ├── PATCH /:id               # تعدیل workspace
│   ├── DELETE /:id              # حذف workspace
│   └── POST /:id/members        # اضافه کردن کاربر
│
├── products/
│   ├── GET /                    # جستجو و فیلتر
│   ├── POST /                   # ایجاد محصول
│   ├── GET /:id                 # جزئیات محصول
│   ├── PATCH /:id               # تعدیل محصول
│   └── DELETE /:id              # حذف محصول
│
├── bookings/
│   ├── GET /                    # لیست رزرو‌ها
│   ├── POST /                   # ایجاد رزرو
│   ├── GET /:id                 # جزئیات رزرو
│   ├── PATCH /:id               # تعدیل رزرو
│   └── DELETE /:id              # لغو رزرو
│
├── payments/
│   ├── POST /                   # آغاز پرداخت
│   ├── POST /webhook            # Webhook پرداخت
│   ├── GET /:id                 # وضعیت پرداخت
│   └── POST /:id/refund         # بازپرداخت
│
└── search/
    ├── GET /                    # جستجوی معنایی
    ├── GET /suggestions         # تکمیل خودکار
    └── GET /recommendations    # توصیه‌ها
```

### 2. API Response Format

```typescript
// Success Response
{
  success: true,
  data: { /* actual data */ },
  meta: {
    timestamp: "2026-09-13T10:30:00Z",
    requestId: "req-123",
    version: "1.0"
  }
}

// Error Response
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    statusCode: 400,
    details: {
      errors: ["email is required"]
    },
    timestamp: "2026-09-13T10:30:00Z",
    requestId: "req-123"
  }
}
```

### 3. Pagination

```typescript
{
  data: [{ /* items */ }],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8,
    hasNextPage: true,
    hasPreviousPage: false
  }
}
```

---

## معماری امنیت

### 1. Authentication Flow

```
User Login
    ↓
Email + Password Validation
    ↓
JWT Token Generation (short-lived)
    ↓
Refresh Token Storage (long-lived)
    ↓
Session Creation
    ↓
Response with Tokens
```

### 2. Authorization Layers

```
Request
  ↓
[Layer 1: JWT Validation]
  ↓
[Layer 2: Tenant Isolation Check]
  ↓
[Layer 3: RBAC Check]
  ↓
[Layer 4: ABAC Policy Evaluation]
  ↓
[Layer 5: Resource Access Control]
  ↓
Authorized/Denied
```

### 3. Tenant Isolation

```typescript
// Enforced at middleware level
export async function tenantMiddleware(req: Request) {
  const tenantId = extractTenantFromRequest(req);
  
  if (!tenantId) {
    throw new AuthorizationError('Tenant not identified');
  }
  
  // Verify user belongs to tenant
  const user = await verifyUserTenant(userId, tenantId);
  
  // Store in context
  context.tenantId = tenantId;
  context.userId = user.id;
}

// Enforced in repositories
class UserRepository implements IRepository<User> {
  async findById(id: string, tenantId: string): Promise<User | null> {
    // ALWAYS include tenant_id in queries
    return this.db.query(
      'SELECT * FROM users WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
  }
}
```

### 4. Data Protection

- **Encryption at Rest**: Cloudflare handles encryption
- **Encryption in Transit**: TLS 1.3
- **Password Hashing**: bcrypt with salt
- **Token Storage**: HttpOnly cookies
- **Audit Logging**: All sensitive operations logged

---

## معماری ابرساخت

### 1. Cloudflare Stack

```
┌─────────────────────────────────────┐
│     Cloudflare Workers (Edge)       │
│   (API Processing & Logic)          │
└─────────────────────────────────────┘
           ↓ ↓ ↓ ↓
    ┌──────────────────────┐
    │ D1 Database (SQLite) │
    │ (Source of Truth)    │
    └──────────────────────┘
    
    ┌──────────────────────┐
    │ R2 Object Storage    │
    │ (Files & Media)      │
    └──────────────────────┘
    
    ┌──────────────────────┐
    │ KV Store             │
    │ (Cache & Sessions)   │
    └──────────────────────┘
    
    ┌──────────────────────┐
    │ Queues               │
    │ (Async Jobs)         │
    └──────────────────────┘
    
    ┌──────────────────────┐
    │ Vectorize            │
    │ (AI Embeddings)      │
    └──────────────────────┘
```

### 2. Worker Configuration

```toml
# wrangler.toml

name = "phoenix-api"
type = "service-worker"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "phoenix-prod"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "phoenix-media"

[[kv_namespaces]]
binding = "CACHE"
id = "xxxxx"

[[queues.bindings]]
binding = "NOTIFICATION_QUEUE"
queue = "phoenix-notifications"

[[vectorize]]
binding = "VECTORIZE"
index_name = "phoenix-embeddings"
```

### 3. Deployment Flow

```
Code Push → GitHub Actions
  ↓
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
  ↓
wrangler deploy --env staging
  ↓
Smoke Tests
  ↓
Approval Required
  ↓
wrangler deploy --env production
  ↓
Health Checks
  ↓
Done ✓
```

---

## استراتژی آزمایش

### 1. Test Pyramid

```
        ▲
       / \
      /E2E \         10% - End-to-End Tests
     /─────\        (Complete user flows)
    /       \
   /Integration\    20% - Integration Tests
  /───────────\    (Module collaboration)
 /             \
/      Unit     \   70% - Unit Tests
─────────────────  (Individual functions)
```

### 2. Test Types

**Unit Tests** (70%):
```typescript
describe('AuthService', () => {
  it('should authenticate user', () => {
    // Test single function
  });
});
```

**Integration Tests** (20%):
```typescript
describe('Identity Module', () => {
  it('should complete auth flow', async () => {
    // Test multiple components
  });
});
```

**E2E Tests** (10%):
```typescript
describe('User Registration', () => {
  it('should register and login', async () => {
    // Test full user journey
  });
});
```

### 3. Coverage Goals

- Overall: 80%+
- Functions: 80%+
- Lines: 80%+
- Branches: 75%+

---

## استراتژی استقرار

### 1. Environments

**Development**
- Local SQLite
- Fast feedback
- All features enabled

**Staging**
- Production-like setup
- Beta features
- Full testing

**Production**
- Stable features only
- High availability
- Monitoring enabled

### 2. Deployment Strategy

**Blue-Green**:
1. Deploy to blue environment
2. Run health checks
3. Switch traffic
4. Keep green for rollback

**Canary** (for large changes):
1. Route 5% traffic to new version
2. Monitor metrics
3. Gradually increase to 100%
4. Automatic rollback if issues

### 3. Database Migrations

```bash
# Before deployment
npm run migrate:prod

# Health check
npm run health:check

# Switch traffic
# If failed
npm run rollback:migration
```

---

## نظارت و رصد

### 1. Metrics Tracked

**System Metrics**:
- Request count per second
- Response time (P50, P95, P99)
- Error rate
- Database query time
- Cache hit rate

**Business Metrics**:
- User registrations
- Product views
- Bookings created
- Payments processed
- Revenue

### 2. Logging Strategy

```typescript
// Structured logging
{
  timestamp: "2026-09-13T10:30:00Z",
  level: "INFO",
  message: "User authenticated",
  requestId: "req-123",
  userId: "user-456",
  tenantId: "org-789",
  traceId: "trace-000",
  duration: 142  // ms
}
```

### 3. Alerts

- Error rate > 5%
- P99 latency > 1 second
- Database pool > 90%
- Memory usage > 80%
- Disk space < 10%

---

## خط لوله CI/CD

### 1. Build Pipeline

```yaml
1. Lint
   └─→ eslint .

2. Type Check
   └─→ tsc --noEmit

3. Format Check
   └─→ prettier --check .

4. Unit Tests
   └─→ vitest run --unit

5. Integration Tests
   └─→ vitest run --integration

6. Coverage Report
   └─→ vitest run --coverage

7. Build
   └─→ tsc -b

8. Artifact Upload
```

### 2. Deployment Pipeline

```
Commit to main
    ↓
Build & Test
    ↓
✓ All passed?
    ↓ No: Notify
    ↓ Yes
    ↓
Deploy to staging
    ↓
Run smoke tests
    ↓
✓ Tests passed?
    ↓ No: Rollback
    ↓ Yes
    ↓
Manual approval (tag)
    ↓
Deploy to production
    ↓
Run health checks
    ↓
✓ Healthy?
    ↓ No: Automatic rollback
    ↓ Yes
    ↓
Done ✓
```

---

## راهنمای توسعه

### 1. Local Setup

```bash
# Clone & install
git clone https://github.com/qooqnos/qooqnos.git
cd qooqnos
npm install

# Setup environment
cp .env.example .env.development

# Start development
npm run dev

# Watch tests
npm run test:watch
```

### 2. Git Workflow

```bash
# Branch naming
feature/user-auth
bugfix/login-error
refactor/auth-flow
docs/api-guide

# Commit convention
git commit -m "feat: add user authentication"
git commit -m "fix: prevent SQL injection"
git commit -m "refactor: simplify auth"
git commit -m "docs: update README"
git commit -m "test: add auth tests"
```

### 3. Adding Module

```bash
# Create module
mkdir packages/modules/new-feature
cd packages/modules/new-feature

# Create structure
mkdir -p src/{domain,application,infrastructure,api}
mkdir -p tests/{unit,integration}

# Implement
# - Domain entities
# - Application services
# - Infrastructure repositories
# - API routes

# Register in runtime
# - Add to module loader
# - Add migrations
# - Add permissions
```

### 4. Pre-Commit

- [ ] Code compiles: `npm run typecheck`
- [ ] Tests pass: `npm run test`
- [ ] Linting: `npm run lint`
- [ ] No console.log
- [ ] Commit message format

### 5. Before Push

- [ ] Branch updated with main
- [ ] All tests passing
- [ ] Coverage maintained
- [ ] No secrets committed

---

## نقشه راه اجرایی

### Phase 1: Foundation (Weeks 1-3)
- [ ] Monorepo setup
- [ ] Core package
- [ ] Database layer
- [ ] Runtime boot
- [ ] API scaffold

### Phase 2: Identity (Weeks 4-6)
- [ ] User management
- [ ] Authentication
- [ ] Authorization (RBAC/ABAC)
- [ ] Tenant isolation
- [ ] Auth endpoints

### Phase 3: Catalog (Weeks 7-9)
- [ ] Product management
- [ ] Service management
- [ ] Inventory
- [ ] Pricing
- [ ] Product endpoints

### Phase 4: Discovery (Weeks 10-13)
- [ ] Search infrastructure
- [ ] Semantic search (Vectorize)
- [ ] AI matching
- [ ] Recommendations
- [ ] Search endpoints

### Phase 5: Booking (Weeks 14-16)
- [ ] Availability management
- [ ] Booking lifecycle
- [ ] Calendar integration
- [ ] Notifications
- [ ] Booking endpoints

### Phase 6: Payment (Weeks 17-19)
- [ ] Payment processing
- [ ] Invoice generation
- [ ] Refund handling
- [ ] Financial reports

---

## ملخص

✅ **Architecture Complete**: معماری جامع و واضح  
✅ **Database Design**: طراحی چند‌مستاجر  
✅ **Module System**: سیستم ماژول انعطاف‌پذیر  
✅ **API Contracts**: قرارداد API جامع  
✅ **Security Layers**: لایه‌های امنیتی چندگانه  
✅ **Infrastructure**: زیرساخت Cloudflare  
✅ **Testing Strategy**: استراتژی آزمایش جامع  
✅ **CI/CD Pipeline**: خط لوله خودکار  
✅ **Monitoring**: نظارت و رصد  
✅ **Development Guide**: راهنمای توسعه

---

## بعدی: پیاده‌سازی کد

حالا آماده‌ایم برای شروع پیاده‌سازی:

1. **Core Package**: Type definitions و utilities
2. **Database Layer**: Connection و migrations
3. **Identity Module**: Auth و users
4. **Authorization Module**: RBAC/ABAC
5. **API Layer**: HTTP server و routes

