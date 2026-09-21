/**
 * Database Repository Implementation
 * 
 * Adapts the PostgreSQL connection to work with the existing Repository interface.
 * Provides CRUD operations for all domain entities.
 */

import {
  Repository,
  EntityId,
  UserId,
  WorkspaceId,
  ServiceId,
  BookingId,
} from "@qooqnos/core";

import {
  User,
  Workspace,
  Service,
  Booking,
  createUser,
  createWorkspace,
  createService,
  createBooking,
} from "./index";

import { DatabaseConnection, SQL } from "./postgres-adapter";

// ============================================================================
// USER REPOSITORY
// ============================================================================

export class UserRepository implements Repository<User> {
  constructor(private db: DatabaseConnection) {}

  async create(user: User): Promise<void> {
    const sql = SQL.insert("users", ["id", "email", "name", "created_at", "updated_at"]);
    await this.db.query(sql, [
      user.id,
      user.email,
      user.name,
      user.createdAt,
      user.updatedAt,
    ]);
  }

  async read(id: EntityId): Promise<User | null> {
    const sql = SQL.select("users", ["*"], { id: 1 });
    const result = await this.db.query<Record<string, unknown>>(sql, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const user = createUser(
      row.id as string,
      row.email as string,
      row.name as string
    );
    return {
      ...user,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async update(user: User): Promise<void> {
    const sql = SQL.update("users", ["id", "email", "name", "updated_at"], "id");
    await this.db.query(sql, [
      user.email,
      user.name,
      new Date(),
      user.id,
    ]);
  }

  async delete(id: EntityId): Promise<void> {
    const sql = SQL.delete("users", "id");
    await this.db.query(sql, [id]);
  }
}

// ============================================================================
// WORKSPACE REPOSITORY
// ============================================================================

export class WorkspaceRepository implements Repository<Workspace> {
  constructor(private db: DatabaseConnection) {}

  async create(workspace: Workspace): Promise<void> {
    const sql = SQL.insert("workspaces", ["id", "name", "owner_id", "created_at", "updated_at"]);
    await this.db.query(sql, [
      workspace.id,
      workspace.name,
      workspace.ownerId,
      workspace.createdAt,
      workspace.updatedAt,
    ]);
  }

  async read(id: EntityId): Promise<Workspace | null> {
    const sql = SQL.select("workspaces", ["*"], { id: 1 });
    const result = await this.db.query<Record<string, unknown>>(sql, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const workspace = createWorkspace(
      row.id as string,
      row.name as string,
      row.owner_id as UserId
    );
    return {
      ...workspace,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async update(workspace: Workspace): Promise<void> {
    const sql = SQL.update("workspaces", ["id", "name", "owner_id", "updated_at"], "id");
    await this.db.query(sql, [
      workspace.name,
      workspace.ownerId,
      new Date(),
      workspace.id,
    ]);
  }

  async delete(id: EntityId): Promise<void> {
    const sql = SQL.delete("workspaces", "id");
    await this.db.query(sql, [id]);
  }
}

// ============================================================================
// SERVICE REPOSITORY
// ============================================================================

export class ServiceRepository implements Repository<Service> {
  constructor(private db: DatabaseConnection) {}

  async create(service: Service): Promise<void> {
    const sql = SQL.insert("services", [
      "id",
      "workspace_id",
      "name",
      "description",
      "price",
      "currency",
      "provider_id",
      "created_at",
      "updated_at",
    ]);
    await this.db.query(sql, [
      service.id,
      service.workspaceId,
      service.name,
      service.description,
      service.price,
      service.currency,
      service.providerId,
      service.createdAt,
      service.updatedAt,
    ]);
  }

  async read(id: EntityId): Promise<Service | null> {
    const sql = SQL.select("services", ["*"], { id: 1 });
    const result = await this.db.query<Record<string, unknown>>(sql, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const service = createService(
      row.id as string,
      row.workspace_id as WorkspaceId,
      row.name as string,
      row.description as string,
      row.price as number,
      row.currency as string,
      row.provider_id as UserId
    );
    return {
      ...service,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async update(service: Service): Promise<void> {
    const sql = SQL.update(
      "services",
      ["id", "name", "description", "price", "currency", "updated_at"],
      "id"
    );
    await this.db.query(sql, [
      service.name,
      service.description,
      service.price,
      service.currency,
      new Date(),
      service.id,
    ]);
  }

  async delete(id: EntityId): Promise<void> {
    const sql = SQL.delete("services", "id");
    await this.db.query(sql, [id]);
  }
}

// ============================================================================
// BOOKING REPOSITORY
// ============================================================================

export class BookingRepository implements Repository<Booking> {
  constructor(private db: DatabaseConnection) {}

  async create(booking: Booking): Promise<void> {
    const sql = SQL.insert("bookings", [
      "id",
      "service_id",
      "buyer_id",
      "provider_id",
      "workspace_id",
      "start_time",
      "end_time",
      "status",
      "total_price",
      "created_at",
      "updated_at",
    ]);
    await this.db.query(sql, [
      booking.id,
      booking.serviceId,
      booking.buyerId,
      booking.providerId,
      booking.workspaceId,
      booking.startTime,
      booking.endTime,
      booking.status,
      booking.totalPrice,
      booking.createdAt,
      booking.updatedAt,
    ]);
  }

  async read(id: EntityId): Promise<Booking | null> {
    const sql = SQL.select("bookings", ["*"], { id: 1 });
    const result = await this.db.query<Record<string, unknown>>(sql, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const booking = createBooking(
      row.id as string,
      row.service_id as ServiceId,
      row.buyer_id as UserId,
      row.provider_id as UserId,
      row.workspace_id as WorkspaceId,
      new Date(row.start_time as string),
      new Date(row.end_time as string),
      row.total_price as number
    );
    return {
      ...booking,
      status: row.status as "pending" | "confirmed" | "completed" | "cancelled",
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async update(booking: Booking): Promise<void> {
    const sql = SQL.update(
      "bookings",
      ["id", "status", "end_time", "updated_at"],
      "id"
    );
    await this.db.query(sql, [
      booking.status,
      booking.endTime,
      new Date(),
      booking.id,
    ]);
  }

  async delete(id: EntityId): Promise<void> {
    const sql = SQL.delete("bookings", "id");
    await this.db.query(sql, [id]);
  }
}
