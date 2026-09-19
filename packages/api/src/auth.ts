import { createHmac } from "crypto";
import { UserId, AuthContext, createUserId, createRequestId, createCorrelationId } from "@qooqnos/core";

// ============================================================================
// JWT AUTHENTICATION SYSTEM
// ============================================================================

export interface JwtPayload {
  readonly userId: string;
  readonly workspaceId: string;
  readonly permissions: readonly string[];
  readonly iat: number;
  readonly exp: number;
}

export interface TokenConfig {
  readonly secret: string;
  readonly expiresIn: number; // seconds
  readonly issuer: string;
  readonly audience: string;
}

// ============================================================================
// JWT TOKEN MANAGER
// ============================================================================

export class JwtManager {
  private config: TokenConfig;

  constructor(config: TokenConfig) {
    if (!config.secret || config.secret.length < 32) {
      throw new Error("JWT secret must be at least 32 characters");
    }
    this.config = config;
  }

  /**
   * Generate a JWT token
   */
  generateToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.config.expiresIn;

    const jwtPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: expiresAt,
    };

    const header = {
      alg: "HS256",
      typ: "JWT",
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(jwtPayload));

    const signature = this.createSignature(
      `${encodedHeader}.${encodedPayload}`
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): { ok: true; payload: JwtPayload } | { ok: false; error: string } {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { ok: false, error: "Invalid token format" };
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      // Verify signature
      const expectedSignature = this.createSignature(
        `${encodedHeader}.${encodedPayload}`
      );

      if (signature !== expectedSignature) {
        return { ok: false, error: "Invalid signature" };
      }

      // Decode payload
      const payload = JSON.parse(
        this.base64UrlDecode(encodedPayload)
      ) as JwtPayload;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return { ok: false, error: "Token expired" };
      }

      return { ok: true, payload };
    } catch (error) {
      return { ok: false, error: `Token verification failed: ${error instanceof Error ? error.message : "unknown"}` };
    }
  }

  private createSignature(data: string): string {
    const hmac = createHmac("sha256", this.config.secret);
    hmac.update(data);
    return this.base64UrlEncode(hmac.digest());
  }

  private base64UrlEncode(data: string | Buffer): string {
    return Buffer.from(data)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  private base64UrlDecode(encoded: string): string {
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const decoded = Buffer.from(
      padded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString();
    return decoded;
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

export interface AuthMiddlewareConfig extends TokenConfig {
  readonly skipPaths?: readonly string[];
}

export class AuthMiddleware {
  private jwtManager: JwtManager;
  private config: AuthMiddlewareConfig;

  constructor(config: AuthMiddlewareConfig) {
    this.jwtManager = new JwtManager(config);
    this.config = config;
  }

  /**
   * Extract auth context from request headers
   */
  extractAuthContext(
    headers: Record<string, string>,
    path: string,
    requestId: string,
    correlationId: string
  ): AuthContext | null {
    // Check if path is in skipPaths
    if (this.config.skipPaths?.some(p => path.startsWith(p))) {
      return null;
    }

    const authHeader = headers.authorization || headers["Authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const result = this.jwtManager.verifyToken(token);

    if (!result.ok) {
      return null;
    }

    const { payload } = result;

    return {
      userId: createUserId(payload.userId),
      workspaceId: payload.workspaceId as any,
      permissions: payload.permissions as any,
      requestId: requestId as any,
      correlationId: correlationId as any,
    };
  }

  /**
   * Check if user has permission
   */
  hasPermission(
    auth: AuthContext,
    requiredPermission: string
  ): boolean {
    return (auth.permissions as readonly string[]).includes(requiredPermission) || 
           (auth.permissions as readonly string[]).includes("admin");
  }

  /**
   * Generate token for user
   */
  generateUserToken(
    userId: string,
    workspaceId: string,
    permissions: readonly string[] = ["read", "write"]
  ): string {
    return this.jwtManager.generateToken({
      userId,
      workspaceId,
      permissions,
    });
  }
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export function createDefaultAuthConfig(): TokenConfig {
  const secret = process.env.JWT_SECRET || "dev-secret-key-change-in-production-12345678";

  return {
    secret,
    expiresIn: 24 * 60 * 60, // 24 hours
    issuer: "phoenix",
    audience: "phoenix-api",
  };
}

export function createDefaultAuthMiddleware(): AuthMiddleware {
  return new AuthMiddleware({
    ...createDefaultAuthConfig(),
    skipPaths: ["/health", "/users"],
  });
}

// ============================================================================
// PASSWORD HASHING
// ============================================================================

export class PasswordHasher {
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 64;
  private static readonly DIGEST = "sha256";

  /**
   * Hash a password (simple implementation - use bcrypt in production)
   */
  static hashPassword(password: string, salt?: string): {
    hash: string;
    salt: string;
  } {
    const crypto = require("crypto");
    if (!salt) {
      salt = crypto.randomBytes(16).toString("hex");
    }

    const hash = crypto
      .pbkdf2Sync(
        password,
        salt,
        this.ITERATIONS,
        this.KEY_LENGTH,
        this.DIGEST
      )
      .toString("hex");

    return { hash, salt };
  }

  /**
   * Verify a password against a hash
   */
  static verifyPassword(
    password: string,
    hash: string,
    salt: string
  ): boolean {
    const { hash: newHash } = this.hashPassword(password, salt);
    return newHash === hash;
  }
}

// ============================================================================
// MOCK USER DATABASE FOR TESTING
// ============================================================================

export interface StoredUser {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly passwordSalt: string;
  readonly name: string;
  readonly permissions: readonly string[];
  readonly workspaceId: string;
}

export class MockUserDatabase {
  private users: Map<string, StoredUser> = new Map();

  constructor() {
    // Create test user
    const { hash, salt } = PasswordHasher.hashPassword("password123");
    this.users.set("user_1", {
      id: "user_1",
      email: "alice@example.com",
      name: "Alice",
      passwordHash: hash,
      passwordSalt: salt,
      permissions: ["read", "write", "delete"],
      workspaceId: "workspace_1",
    });
  }

  /**
   * Authenticate user by email and password
   */
  authenticateUser(
    email: string,
    password: string
  ): StoredUser | null {
    for (const user of this.users.values()) {
      if (
        user.email === email &&
        PasswordHasher.verifyPassword(
          password,
          user.passwordHash,
          user.passwordSalt
        )
      ) {
        return user;
      }
    }
    return null;
  }

  /**
   * Get user by ID
   */
  getUser(id: string): StoredUser | null {
    return this.users.get(id) ?? null;
  }

  /**
   * Create new user
   */
  createUser(email: string, name: string, password: string): StoredUser {
    const { hash, salt } = PasswordHasher.hashPassword(password);
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const user: StoredUser = {
      id,
      email,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      permissions: ["read", "write"],
      workspaceId: `workspace_${id}`,
    };

    this.users.set(id, user);
    return user;
  }
}
