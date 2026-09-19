# 🔥 Phoenix (ققنوس) - AI Marketplace Platform

A production-grade TypeScript monorepo implementing a complete AI services marketplace platform with strict type safety, domain-driven architecture, and comprehensive API layer.

## 📋 Project Overview

Phoenix is a multi-package TypeScript monorepo designed for building an AI marketplace where:

- **Providers** can list their services
- **Buyers** can discover and book services
- **Workspaces** organize multi-tenant business logic
- **Complete onboarding** flow for new users
- **RESTful API** for all operations

## 📦 Package Structure

```
packages/
├── core/           # Domain types & branded types
├── database/       # Data layer with repositories
├── api/            # HTTP API handlers & routing
├── runtime/        # Application bootstrapping
├── i18n/           # Internationalization
└── onboarding/     # User onboarding flow
```

## 🏗️ Architecture

### Core Principles

1. **Strict TypeScript**: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`
2. **Branded Types**: Type-safe entity IDs (`UserId`, `WorkspaceId`, `ServiceId`, `BookingId`)
3. **Layered Architecture**: Clear separation between domain, data, and API layers
4. **Result Type**: Explicit error handling with `Result<T, E>` pattern
5. **In-Memory Database**: Testable and development-friendly data storage

### Domain Model

```typescript
User
  ├─ userId (branded type)
  ├─ email
  ├─ name
  └─ workspaceIds[]

Workspace
  ├─ id
  ├─ name
  ├─ ownerId
  └─ memberIds[]

Service
  ├─ id
  ├─ workspaceId
  ├─ name
  ├─ description
  ├─ price
  └─ providerId

Booking
  ├─ id
  ├─ serviceId
  ├─ buyerId
  ├─ providerId
  ├─ startTime/endTime
  └─ status
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- TypeScript 5.9.2+

### Installation

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Development watch mode
npm run dev
```

### Running the Server

```bash
# Start development server
npm run dev

# The API will be available at http://localhost:3000
```

### Example API Calls

```bash
# Health check
curl http://localhost:3000/health

# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice"}'

# Create a workspace (requires auth)
curl -X POST http://localhost:3000/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"Tech Services"}'

# List workspace services
curl http://localhost:3000/workspaces/workspace_1/services

# Create a booking (requires auth)
curl -X POST http://localhost:3000/bookings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId":"service_1",
    "workspaceId":"workspace_1",
    "providerId":"user_1",
    "startTime":"2024-09-19T10:00:00Z",
    "endTime":"2024-09-19T11:00:00Z",
    "totalPrice":500
  }'
```

## 📚 Package Documentation

### @qooqnos/core

Domain types and interfaces:

```typescript
import {
  UserId, WorkspaceId, ServiceId, BookingId,
  createUserId, createWorkspaceId,
  AuthContext, ApiResponse, Result
} from "@qooqnos/core";
```

**Key Features:**
- Branded types for type-safe entity IDs
- API response/error types
- Authorization context
- Result type for error handling
- Validation utilities

### @qooqnos/database

Data layer with in-memory storage:

```typescript
import {
  InMemoryDatabase,
  User, Workspace, Service, Booking,
  createUser, createWorkspace
} from "@qooqnos/database";

const db = new InMemoryDatabase();
const userRepo = db.getUserRepository();
await userRepo.create(user);
```

**Key Features:**
- Repository pattern for all entities
- Type-safe data access
- In-memory storage (easily replaceable with SQL)
- Query methods (findServicesByWorkspace, etc.)

### @qooqnos/api

HTTP API handlers and routing:

```typescript
import { ApiRouter, ApiHandlers } from "@qooqnos/api";

const router = new ApiRouter(db);
router.registerHandlers();
const response = await router.handleRequest(request);
```

**Endpoints:**
- `GET /health` - Health check
- `POST /users` - Create user
- `GET /users/:id` - Get user
- `POST /workspaces` - Create workspace
- `GET /workspaces/:id` - Get workspace
- `POST /services` - Create service
- `GET /services/:id` - Get service
- `GET /workspaces/:id/services` - List services
- `POST /bookings` - Create booking
- `GET /bookings/:id` - Get booking
- `GET /bookings` - List user bookings (requires auth)

### @qooqnos/onboarding

User onboarding workflow:

```typescript
import { OnboardingManager } from "@qooqnos/onboarding";

const manager = new OnboardingManager(db);
await manager.initializeUser(user);
await manager.completeStep(userId, 1, { email: "..." });
```

**Steps:**
1. Email Verification (required)
2. Profile Setup (required)
3. Workspace Creation (required)
4. Service Setup (optional)

### @qooqnos/i18n

Multi-language support:

```typescript
import { I18nManager } from "@qooqnos/i18n";

const i18n = new I18nManager("en");
i18n.setLanguage("fa"); // Persian
const text = i18n.t("common.welcome");
```

**Supported Languages:**
- English (en)
- Farsi (fa)
- Arabic (ar)

## ✅ Testing

### Unit Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Run specific package tests
npm run -w @qooqnos/onboarding test
```

### Test Coverage

Tests are organized by package using Vitest. Each package can have:
- Unit tests (`*.test.ts`)
- Integration tests
- Contract tests

## 🔒 Security & Type Safety

### Strict Compiler Settings

All packages are compiled with TypeScript strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

### Branded Types

Prevent ID mixups:

```typescript
const userId: UserId = ...;
const workspaceId: WorkspaceId = ...;
// Type error: userId cannot be assigned to workspaceId
```

### Result Type

Explicit error handling:

```typescript
const result = await service.create(entity);
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

## 🛠️ Development Workflow

### Build

```bash
# Build all packages
npm run build

# Clean build artifacts
npm run clean
```

### Code Quality

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

### Adding New Packages

```bash
# Create new package
mkdir -p packages/newpkg/{src,src/__tests__}

# Create package.json, tsconfig.json, src/index.ts
# Update root tsconfig.json references
# Run: npm install
```

## 📖 Design Patterns

### Repository Pattern

```typescript
interface Repository<T> {
  create(entity: T): Promise<void>;
  read(id: EntityId): Promise<T | null>;
  update(entity: T): Promise<void>;
  delete(id: EntityId): Promise<void>;
}
```

### Handler Pattern

```typescript
type HandlerFunction<T> = (
  ctx: ApiRequestContext,
  db: InMemoryDatabase
) => Promise<ApiResponse<T>>;
```

### Validation Pattern

```typescript
function validateEmail(email: string): ValidationResult<string> {
  // returns Result<string, ValidationError[]>
}
```

## 🚢 Deployment

### Build for Production

```bash
npm run build
npm run typecheck
npm run test
```

### Environment Variables

```bash
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

## 🤝 Contributing

1. Ensure strict TypeScript compliance
2. Add tests for new features
3. Update types and interfaces
4. Document API changes

## 📝 License

Proprietary - Phoenix AI Marketplace

## 🔗 Related Documentation

- [Architecture Overview](./docs/ARCHITECTURE_COMPLETE.md)
- [API Contracts](./docs/API_CONTRACT_ERROR_VERSIONING_ARCHITECTURE.md)
- [Database Model](./docs/DATABASE_MODEL.md)
- [Technology Standards](./docs/TECHNOLOGY_AND_LANGUAGE_STANDARDS.md)

---

**Status**: Production-Ready  
**Last Updated**: September 19, 2026  
**Version**: 0.1.0
