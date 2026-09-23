# ⚙️ **CI_CD_PIPELINE.md**

## GitHub Actions Workflows

### Build & Test Pipeline
```yaml
name: Build & Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22.x]

    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Format check
        run: npm run format:check

      - name: Unit tests
        run: npm run test:unit

      - name: Integration tests
        run: npm run test:integration
        env:
          TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Coverage report
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

      - name: Build
        run: npm run build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: dist/
          retention-days: 1
```

### Deployment Pipeline

Production deployment is implemented by `.github/workflows/production-deploy.yml` and is intentionally separate from the ordinary CI workflow.

The production workflow:

1. runs for version tags (`v*`) or manual dispatch;
2. uses the protected GitHub `production` environment;
3. requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets;
4. reads real Cloudflare resource values from deployment variables:
   - `PHOENIX_PROD_D1_DATABASE_ID`
   - `PHOENIX_PROD_D1_DATABASE_NAME`
   - `PHOENIX_PROD_R2_BUCKET_NAME`
   - `PHOENIX_PROD_OUTBOX_QUEUE_NAME`
   - `PHOENIX_PROD_AI_MODEL_ID`
   - optional `PHOENIX_PROD_AI_MODEL_VERSION`
   - optional `PHOENIX_PROD_AI_GATEWAY_ID`
5. renders a temporary production Wrangler config;
6. verifies D1/R2/Queue/Workers AI bindings and migration integrity;
7. runs lint, typecheck, build, Worker dry-run and tests;
8. deploys only after every gate succeeds.

No production Cloudflare resource ID or bucket/queue name is committed to the repository. The generated Wrangler config is ignored by Git.


## CI/CD Configuration Files

### npm scripts
```json
{
  "scripts": {
    "dev": "wrangler dev --local",
    "build": "tsc -b",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run --include '**/*.spec.ts' --exclude '**/integration/**,**/e2e/**'",
    "test:integration": "vitest run --include '**/integration/**'",
    "test:e2e": "vitest run --include '**/e2e/**'",
    "test:coverage": "vitest run --coverage",
    "test:smoke": "vitest run tests/smoke",
    "test:performance": "vitest run tests/performance",
    "migrate:staging": "wrangler d1 migrations apply phoenix-staging",
    "migrate:prod": "wrangler d1 migrations apply phoenix-prod",
    "backup:database": "node scripts/backup.ts",
    "restore:database": "node scripts/restore.ts",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:prod": "wrangler deploy --env production"
  }
}
```

## Security Scanning

```yaml
name: Security Scanning

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: '0 0 * * 0'

jobs:
  dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Dependency check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'Phoenix AI Marketplace'
          path: '.'
          format: 'JSON'

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```
