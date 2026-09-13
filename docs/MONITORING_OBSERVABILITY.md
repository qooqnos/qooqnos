# 📊 **MONITORING_OBSERVABILITY.md**

## Logging Strategy

### Structured Logging
```typescript
export class Logger {
  private context: Record<string, any> = {};

  setContext(ctx: Record<string, any>): void {
    this.context = ctx;
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.log('DEBUG', message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log('WARN', message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.log('ERROR', message, {
      ...meta,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      }
    });
  }

  private log(
    level: string,
    message: string,
    meta?: Record<string, any>
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.context.requestId,
      userId: this.context.userId,
      tenantId: this.context.tenantId,
      traceId: this.context.traceId,
      ...meta
    };

    console.log(JSON.stringify(logEntry));
  }
}
```

## Metrics Collection

### Application Metrics
```typescript
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();

  recordCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const metric = this.metrics.get(key) || { name, type: 'counter', value: 0, labels };
    metric.value += value;
    this.metrics.set(key, metric);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const metric = this.metrics.get(key) || {
      name,
      type: 'histogram',
      values: [],
      labels
    };
    (metric.values as number[]).push(value);
    this.metrics.set(key, metric);
  }

  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.metrics.set(key, { name, type: 'gauge', value, labels });
  }

  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }
}
```

### Business Metrics
```typescript
export class UserMetrics {
  constructor(private metricsCollector: MetricsCollector) {}

  recordUserRegistration(source: string): void {
    this.metricsCollector.recordCounter('users.registration', 1, { source });
  }

  recordUserLogin(method: string): void {
    this.metricsCollector.recordCounter('users.login', 1, { method });
  }

  recordProductCreation(category: string): void {
    this.metricsCollector.recordCounter('products.created', 1, { category });
  }

  recordBookingCreation(status: string): void {
    this.metricsCollector.recordCounter('bookings.created', 1, { status });
  }

  recordPaymentProcessed(status: string, amount: number): void {
    this.metricsCollector.recordCounter('payments.processed', 1, { status });
    this.metricsCollector.recordHistogram('payments.amount', amount, { status });
  }
}
```

## Distributed Tracing

```typescript
export class Tracer {
  private traceId: string;
  private spans: Map<string, Span> = new Map();

  constructor() {
    this.traceId = generateUUID();
  }

  getTraceId(): string {
    return this.traceId;
  }

  startSpan(name: string, attributes?: Record<string, any>): Span {
    const span: Span = {
      spanId: generateUUID(),
      traceId: this.traceId,
      name,
      startTime: Date.now(),
      attributes: attributes || {}
    };

    this.spans.set(span.spanId, span);
    return span;
  }

  endSpan(span: Span): void {
    span.duration = Date.now() - span.startTime;
    span.endTime = Date.now();
  }

  recordSpanEvent(span: Span, eventName: string, attributes?: Record<string, any>): void {
    if (!span.events) span.events = [];
    span.events.push({
      name: eventName,
      timestamp: Date.now(),
      attributes: attributes || {}
    });
  }

  recordSpanException(span: Span, error: Error): void {
    span.status = 'error';
    span.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  exportSpans(): ExportedTrace {
    return {
      traceId: this.traceId,
      spans: Array.from(this.spans.values())
    };
  }
}
```

## Alerting

```typescript
export class AlertManager {
  constructor(
    private notificationService: NotificationService,
    private metricsCollector: MetricsCollector
  ) {
    this.setupAlerts();
  }

  private setupAlerts(): void {
    // High error rate
    this.registerAlert({
      name: 'high_error_rate',
      condition: () => this.getErrorRate() > 0.05,
      severity: 'critical',
      message: 'Error rate exceeded 5%',
      action: async () => {
        await this.notificationService.alertOps(
          'CRITICAL: Error rate exceeded 5%',
          { errorRate: this.getErrorRate() }
        );
      }
    });

    // Database connection pool exhausted
    this.registerAlert({
      name: 'db_pool_exhausted',
      condition: () => this.getActiveConnections() > 90,
      severity: 'high',
      message: 'Database connection pool exhausted',
      action: async () => {
        await this.notificationService.alertOps(
          'HIGH: Database connection pool at 90%',
          { activeConnections: this.getActiveConnections() }
        );
      }
    });

    // High API latency
    this.registerAlert({
      name: 'high_latency',
      condition: () => this.getP99Latency() > 1000,
      severity: 'medium',
      message: 'API P99 latency exceeded 1 second',
      action: async () => {
        await this.notificationService.alertOps(
          'MEDIUM: API P99 latency > 1s',
          { p99Latency: this.getP99Latency() }
        );
      }
    });
  }
}
```

## Dashboards

```typescript
export class MetricsDashboard {
  async getRealTimeDashboard(): Promise<Dashboard> {
    return {
      title: 'Phoenix AI Marketplace - Real-time Dashboard',
      lastUpdated: new Date().toISOString(),
      widgets: [
        {
          title: 'Requests per second',
          type: 'chart',
          data: await this.getRequestsPerSecond()
        },
        {
          title: 'API Latency (P50, P95, P99)',
          type: 'chart',
          data: await this.getLatencyPercentiles()
        },
        {
          title: 'Error Rate',
          type: 'gauge',
          value: await this.getErrorRate(),
          threshold: { warning: 0.01, critical: 0.05 }
        },
        {
          title: 'Active Users',
          type: 'gauge',
          value: await this.getActiveUsers()
        }
      ]
    };
  }
}
```

## Synthetic Monitoring

```typescript
describe('Synthetic Monitoring - Hourly Checks', () => {
  it('should complete user registration flow', async () => {
    const email = `synthetic-${Date.now()}@phoenix.app`;
    
    const registerRes = await fetch(`${apiUrl}/api/v1/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'SyntheticPass123!',
        firstName: 'Synthetic',
        lastName: 'User'
      })
    });

    expect(registerRes.status).toBe(201);
  });
});
```
