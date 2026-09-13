# 👨‍💻 **DEVELOPMENT_GUIDE.md**

## محیط توسعه محلی

### نصب و راه‌اندازی
```bash
# Clone repository
git clone https://github.com/qooqnos/qooqnos.git
cd qooqnos

# Install dependencies
npm install

# Setup environment
cp .env.example .env.development

# Start development server
npm run dev

# In another terminal: watch tests
npm run test:watch
```

## Git Workflow

### Branch Strategy
```bash
# Branch naming
feature/feature-name           # نویایی feature
bugfix/bug-description         # رفع bug
refactor/refactoring-name      # بازنویسی
docs/documentation-update      # مستندات
test/test-name                 # تست‌ها

# Create feature branch
git checkout -b feature/user-auth
git push -u origin feature/user-auth

# Commit messages
git commit -m "feat: add user authentication"
git commit -m "fix: prevent SQL injection"
git commit -m "refactor: simplify auth flow"
git commit -m "docs: update API documentation"
git commit -m "test: add auth service tests"
```

### Pull Request Process
```
1. Create feature branch
2. Make changes
3. Run tests locally: npm run test
4. Push changes
5. Create Pull Request on GitHub
6. Wait for CI/CD to pass
7. Request code review
8. Address review feedback
9. Merge to main
10. Delete feature branch
```

## Database Development

### Creating Migrations
```bash
# Create new migration
touch migrations/XXX_feature_name.sql

# Example migration
cat << 'EOF' > migrations/005_add_product_ratings.sql
CREATE TABLE IF NOT EXISTS product_ratings (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(product_id, user_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_product_ratings_product ON product_ratings(product_id);
EOF

# Run migrations locally
npm run migrate:development
```

## Testing Development

### Writing Unit Tests
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    // Setup
  });

  it('should create user', () => {
    const input = { email: 'test@example.com' };
    const user = service.create(input);
    
    expect(user).toBeDefined();
    expect(user.email).toBe(input.email);
  });
});
```

## Adding New Module

```bash
# 1. Create module directory
mkdir packages/modules/new-module
cd packages/modules/new-module

# 2. Create structure
mkdir -p src/{domain,application,infrastructure,api}
mkdir -p tests/{unit,integration}

# 3. Create package.json
cat > package.json << 'EOF'
{
  "name": "@phoenix/module-new-module",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
EOF

# 4. Build
npm run build
```

## Pre-Commit Checklist

- [ ] Code compiles without errors
- [ ] Tests pass locally
- [ ] Linting passes
- [ ] No console.log statements
- [ ] No commented-out code
- [ ] No TODOs without issue links

## Pre-Push Checklist

- [ ] Commit messages follow convention
- [ ] Branch is up to date with main
- [ ] All tests pass
- [ ] Code coverage hasn't decreased
- [ ] No secrets in commits
