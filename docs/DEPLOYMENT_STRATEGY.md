# 🚀 **DEPLOYMENT_STRATEGY.md**

## منابع Deployment

### Development Environment
```yaml
# .env.development
API_URL=http://localhost:8787
DATABASE_URL=local
LOG_LEVEL=debug
CACHE_TTL=60
FEATURE_FLAGS=*
```

### Staging Environment
```yaml
# .env.staging
API_URL=https://staging.phoenix.app
DATABASE_URL=staging
LOG_LEVEL=info
CACHE_TTL=3600
FEATURE_FLAGS=beta:*
```

### Production Environment
```yaml
# .env.production
API_URL=https://api.phoenix.app
DATABASE_URL=production
LOG_LEVEL=warn
CACHE_TTL=86400
FEATURE_FLAGS=stable:*
```

## Cloudflare Deployment Strategy

### Deploy Pipeline
```bash
# 1. Local Development
npm run dev

# 2. Staging Deploy
npm run deploy:staging

# 3. Production Deploy (requires approval)
npm run deploy:production
```

## Zero-Downtime Deployment

### Blue-Green Strategy
- Deploy to blue environment
- Run tests
- Switch traffic from green to blue
- Keep green for rollback

### Rollback Strategy
```bash
#!/bin/bash
# rollback.sh

TARGET_ENV=${1:-production}
PREVIOUS_VERSION=$(git describe --tags --abbrev=0)

echo "🔄 Rolling back to $PREVIOUS_VERSION on $TARGET_ENV..."

git checkout $PREVIOUS_VERSION
npm run deploy:${TARGET_ENV}
```

## Health Checks

```typescript
export async function healthCheck(): Promise<HealthStatus> {
  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    queue: await checkQueue(),
    vectorize: await checkVectorize(),
    external_services: await checkExternalServices()
  };

  const isHealthy = Object.values(checks).every(check => check.status === 'ok');

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.APP_VERSION
  };
}
```

## Feature Flags for Safe Deployment

```typescript
export class FeatureFlags {
  isEnabled(featureName: string, context?: Record<string, any>): boolean {
    // Check main flag
    if (!this.flags.has(featureName)) {
      return false;
    }

    // Check context-based overrides
    if (context?.tenantId) {
      const tenantOverride = this.flags.get(`${featureName}:${context.tenantId}`);
      if (tenantOverride !== undefined) {
        return tenantOverride;
      }
    }

    return this.flags.get(featureName) || false;
  }
}
```

## Database Backup Strategy

```typescript
async function backupDatabase(env: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `phoenix-${env}-${timestamp}`;

  console.log(`Creating backup: ${backupName}...`);

  const data = await db.dump();
  await r2.put(`backups/${backupName}.sql`, data);

  console.log(`✓ Backup completed: ${backupName}`);
}
```
