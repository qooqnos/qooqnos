import {
  EntityId,
  Repository,
  UserId,
  WorkspaceId,
  ServiceId,
  BookingId,
  TimestampedEntity,
  createEntityId,
  createUserId,
  createWorkspaceId,
  createServiceId,
  createBookingId,
} from "@qooqnos/core";

// ============================================================================
// DOMAIN ENTITIES
// ============================================================================

export interface User extends TimestampedEntity {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly workspaceIds: readonly WorkspaceId[];
}

export interface Workspace extends TimestampedEntity {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly ownerId: UserId;
  readonly memberIds: readonly UserId[];
}

export interface Service extends TimestampedEntity {
  readonly id: ServiceId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly currency: string;
  readonly providerId: UserId;
}

export interface Booking extends TimestampedEntity {
  readonly id: BookingId;
  readonly serviceId: ServiceId;
  readonly buyerId: UserId;
  readonly providerId: UserId;
  readonly workspaceId: WorkspaceId;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly status: "pending" | "confirmed" | "completed" | "cancelled";
  readonly totalPrice: number;
}

// ============================================================================
// IN-MEMORY DATABASE
// ============================================================================

export class InMemoryDatabase {
  private users: Map<UserId, User> = new Map();
  private workspaces: Map<WorkspaceId, Workspace> = new Map();
  private services: Map<ServiceId, Service> = new Map();
  private bookings: Map<BookingId, Booking> = new Map();

  getUserRepository(): Repository<User> {
    return {
      create: async (user: User) => {
        if (this.users.has(user.id)) {
          throw new Error(`User ${user.id} already exists`);
        }
        this.users.set(user.id, user);
      },
      read: async (id: EntityId) => {
        return this.users.get(id as UserId) ?? null;
      },
      update: async (user: User) => {
        if (!this.users.has(user.id)) {
          throw new Error(`User ${user.id} not found`);
        }
        this.users.set(user.id, user);
      },
      delete: async (id: EntityId) => {
        this.users.delete(id as UserId);
      },
    };
  }

  getWorkspaceRepository(): Repository<Workspace> {
    return {
      create: async (workspace: Workspace) => {
        if (this.workspaces.has(workspace.id)) {
          throw new Error(`Workspace ${workspace.id} already exists`);
        }
        this.workspaces.set(workspace.id, workspace);
      },
      read: async (id: EntityId) => {
        return this.workspaces.get(id as WorkspaceId) ?? null;
      },
      update: async (workspace: Workspace) => {
        if (!this.workspaces.has(workspace.id)) {
          throw new Error(`Workspace ${workspace.id} not found`);
        }
        this.workspaces.set(workspace.id, workspace);
      },
      delete: async (id: EntityId) => {
        this.workspaces.delete(id as WorkspaceId);
      },
    };
  }

  getServiceRepository(): Repository<Service> {
    return {
      create: async (service: Service) => {
        if (this.services.has(service.id)) {
          throw new Error(`Service ${service.id} already exists`);
        }
        this.services.set(service.id, service);
      },
      read: async (id: EntityId) => {
        return this.services.get(id as ServiceId) ?? null;
      },
      update: async (service: Service) => {
        if (!this.services.has(service.id)) {
          throw new Error(`Service ${service.id} not found`);
        }
        this.services.set(service.id, service);
      },
      delete: async (id: EntityId) => {
        this.services.delete(id as ServiceId);
      },
    };
  }

  getBookingRepository(): Repository<Booking> {
    return {
      create: async (booking: Booking) => {
        if (this.bookings.has(booking.id)) {
          throw new Error(`Booking ${booking.id} already exists`);
        }
        this.bookings.set(booking.id, booking);
      },
      read: async (id: EntityId) => {
        return this.bookings.get(id as BookingId) ?? null;
      },
      update: async (booking: Booking) => {
        if (!this.bookings.has(booking.id)) {
          throw new Error(`Booking ${booking.id} not found`);
        }
        this.bookings.set(booking.id, booking);
      },
      delete: async (id: EntityId) => {
        this.bookings.delete(id as BookingId);
      },
    };
  }

  async findServicesByWorkspace(
    workspaceId: WorkspaceId
  ): Promise<readonly Service[]> {
    return Array.from(this.services.values()).filter(
      (s) => s.workspaceId === workspaceId
    );
  }

  async findBookingsByUser(userId: UserId): Promise<readonly Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (b) => b.buyerId === userId || b.providerId === userId
    );
  }

  async findWorkspacesByUser(userId: UserId): Promise<readonly Workspace[]> {
    return Array.from(this.workspaces.values()).filter(
      (w) =>
        w.ownerId === userId ||
        (w.memberIds as readonly UserId[]).includes(userId)
    );
  }

  clear(): void {
    this.users.clear();
    this.workspaces.clear();
    this.services.clear();
    this.bookings.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createUser(
  id: string,
  email: string,
  name: string
): User {
  const now = new Date();
  return {
    id: createUserId(id),
    email,
    name,
    workspaceIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createWorkspace(
  id: string,
  name: string,
  ownerId: UserId
): Workspace {
  const now = new Date();
  return {
    id: createWorkspaceId(id),
    name,
    ownerId,
    memberIds: [ownerId],
    createdAt: now,
    updatedAt: now,
  };
}

export function createService(
  id: string,
  workspaceId: WorkspaceId,
  name: string,
  description: string,
  price: number,
  currency: string,
  providerId: UserId
): Service {
  const now = new Date();
  return {
    id: createServiceId(id),
    workspaceId,
    name,
    description,
    price,
    currency,
    providerId,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBooking(
  id: string,
  serviceId: ServiceId,
  buyerId: UserId,
  providerId: UserId,
  workspaceId: WorkspaceId,
  startTime: Date,
  endTime: Date,
  totalPrice: number
): Booking {
  const now = new Date();
  return {
    id: createBookingId(id),
    serviceId,
    buyerId,
    providerId,
    workspaceId,
    startTime,
    endTime,
    status: "pending",
    totalPrice,
    createdAt: now,
    updatedAt: now,
  };
}
export {
  createDatabaseConnection,
  SQL,
  type DatabaseConfig,
  type DatabaseConnection,
  type Transaction,
  type QueryResult,
  DatabaseError,
  ConnectionError,
  QueryError,
} from "./postgres-adapter";

export {
  MigrationRunner,
  BUILTIN_MIGRATIONS,
  type Migration,
  type MigrationStatus,
  MigrationError,
} from "./migrations";

export {
  UserRepository,
  WorkspaceRepository,
  ServiceRepository,
  BookingRepository,
} from "./database-repository";

export { DatabaseFactory } from "./database-factory";

export { PostgresDatabase } from "./postgres-database";
