/**
 * PostgreSQL Database Implementation
 * 
 * Adapts the PostgreSQL connection to provide the same interface as InMemoryDatabase
 * for backward compatibility with the existing API layer.
 */

import { EntityId, Repository, UserId, WorkspaceId, ServiceId, BookingId } from "@qooqnos/core";
import { DatabaseConnection } from "./postgres-adapter";
import {
  User,
  Workspace,
  Service,
  Booking,
  UserRepository,
  WorkspaceRepository,
  ServiceRepository,
  BookingRepository,
} from "./index";

// ============================================================================
// POSTGRES DATABASE ADAPTER
// ============================================================================

export class PostgresDatabase {
  private userRepo: UserRepository;
  private workspaceRepo: WorkspaceRepository;
  private serviceRepo: ServiceRepository;
  private bookingRepo: BookingRepository;

  constructor(private db: DatabaseConnection) {
    this.userRepo = new UserRepository(db);
    this.workspaceRepo = new WorkspaceRepository(db);
    this.serviceRepo = new ServiceRepository(db);
    this.bookingRepo = new BookingRepository(db);
  }

  /**
   * Get user repository
   */
  getUserRepository(): Repository<User> {
    return this.userRepo;
  }

  /**
   * Get workspace repository
   */
  getWorkspaceRepository(): Repository<Workspace> {
    return this.workspaceRepo;
  }

  /**
   * Get service repository
   */
  getServiceRepository(): Repository<Service> {
    return this.serviceRepo;
  }

  /**
   * Get booking repository
   */
  getBookingRepository(): Repository<Booking> {
    return this.bookingRepo;
  }

  /**
   * Find services by workspace
   */
  async findServicesByWorkspace(workspaceId: WorkspaceId): Promise<readonly Service[]> {
    // This would require a list/query method on DatabaseConnection
    // For now, return empty array
    return [];
  }

  /**
   * Find bookings by user
   */
  async findBookingsByUser(userId: UserId): Promise<readonly Booking[]> {
    // This would require a query method
    return [];
  }

  /**
   * Find workspaces by user
   */
  async findWorkspacesByUser(userId: UserId): Promise<readonly Workspace[]> {
    // This would require a query method
    return [];
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.db.close();
  }
}
