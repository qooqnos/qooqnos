export type CommunicationRateLimitScope =
  | "actor"
  | "tenant"
  | "recipient"
  | "channel"
  | "intent"
  | "provider"
  | "platform";

export interface CommunicationRateLimitRule {
  readonly scope: CommunicationRateLimitScope;
  readonly max: number;
  readonly windowMs: number;
}

export interface CommunicationRateLimitKey {
  readonly actorReference?: string;
  readonly tenantReference: string;
  readonly recipientReference: string;
  readonly channel: string;
  readonly intent: string;
  readonly provider: string;
}

export interface CommunicationRateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
  readonly scope?: CommunicationRateLimitScope;
  readonly key?: string;
}

interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * Bounded in-process guard for the dispatch layer. It is intentionally not a
 * database source of truth: distributed edge/platform enforcement should wrap
 * this guard in production. Provider 429/Retry-After remains authoritative for
 * the provider-specific window.
 */
export class CommunicationRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly rules: readonly CommunicationRateLimitRule[],
    private readonly clock: () => number = Date.now,
  ) {
    for (const rule of rules) {
      if (!Number.isSafeInteger(rule.max) || rule.max < 1) throw new Error("Rate-limit max must be positive");
      if (!Number.isSafeInteger(rule.windowMs) || rule.windowMs < 1000) throw new Error("Rate-limit window must be at least one second");
    }
  }

  checkAndConsume(key: CommunicationRateLimitKey): CommunicationRateLimitDecision {
    const now = this.clock();
    for (const rule of this.rules) {
      const bucketKey = this.bucketKey(rule.scope, key);
      if (!bucketKey) continue;
      const bucket = this.buckets.get(bucketKey);
      if (!bucket || now - bucket.windowStart >= rule.windowMs) {
        this.buckets.set(bucketKey, { count: 1, windowStart: now });
        continue;
      }
      if (bucket.count >= rule.max) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((rule.windowMs - (now - bucket.windowStart)) / 1000)),
          scope: rule.scope,
          key: bucketKey,
        };
      }
      bucket.count += 1;
    }
    this.compact(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }

  private bucketKey(scope: CommunicationRateLimitScope, key: CommunicationRateLimitKey): string | null {
    const value =
      scope === "actor" ? key.actorReference :
      scope === "tenant" ? key.tenantReference :
      scope === "recipient" ? key.recipientReference :
      scope === "channel" ? key.channel :
      scope === "intent" ? key.intent :
      scope === "provider" ? key.provider :
      "platform";
    return "communication:" + scope + ":" + value;
  }

  private compact(now: number): void {
    if (this.buckets.size < 10000) return;
    for (const [key, bucket] of this.buckets) {
      const rule = this.rules.find((item) => key.startsWith("communication:" + item.scope + ":"));
      if (rule && now - bucket.windowStart >= rule.windowMs) this.buckets.delete(key);
    }
  }
}

export function detectCommunicationBurst(
  recentAcceptedAtMs: readonly number[],
  nowMs: number,
  threshold: number,
  windowMs: number,
): boolean {
  if (!Number.isSafeInteger(threshold) || threshold < 1) throw new Error("Anomaly threshold must be positive");
  const recent = recentAcceptedAtMs.filter((timestamp) => nowMs - timestamp >= 0 && nowMs - timestamp <= windowMs);
  return recent.length >= threshold;
}
