import {
  InMemoryDatabase,
  createUser,
  createWorkspace,
  createService,
} from "@qooqnos/database";
import { HttpServer } from "./server";

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

async function startServer(): Promise<void> {
  const db = new InMemoryDatabase();
  
  // Pre-populate test data
  await seedDatabase(db);

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const LOG_LEVEL = (process.env.LOG_LEVEL as any) ?? "info";

  // Create and start HTTP server
  const server = new HttpServer(db, {
    port: PORT,
    hostname: "0.0.0.0",
    logLevel: LOG_LEVEL,
  });

  await server.start();

  console.log("");
  console.log("════════════════════════════════════════════");
  console.log("✨ Phoenix API Server Ready");
  console.log("════════════════════════════════════════════");
  console.log("");
  console.log("📡 Server running on http://localhost:" + PORT);
  console.log("");
  console.log("Example requests:");
  console.log(`  curl http://localhost:${PORT}/health`);
  console.log(`  curl -X POST http://localhost:${PORT}/users -H "Content-Type: application/json" -d '{"email":"test@example.com","name":"Test"}'`);
  console.log("");
}

async function seedDatabase(db: InMemoryDatabase): Promise<void> {
  try {
    // Create test users
    const user1 = createUser("user_1", "alice@phoenix.com", "Alice");
    const user2 = createUser("user_2", "bob@phoenix.com", "Bob");

    await db.getUserRepository().create(user1);
    await db.getUserRepository().create(user2);

    // Create a workspace
    const workspace = createWorkspace(
      "workspace_1",
      "Tech Services",
      user1.id
    );
    await db.getWorkspaceRepository().create(workspace);

    // Create some services
    const service1 = createService(
      "service_1",
      workspace.id,
      "Web Development",
      "Build modern web applications",
      500,
      "USD",
      user1.id
    );
    const service2 = createService(
      "service_2",
      workspace.id,
      "UI/UX Design",
      "Create beautiful user interfaces",
      400,
      "USD",
      user1.id
    );

    await db.getServiceRepository().create(service1);
    await db.getServiceRepository().create(service2);

    console.log("✅ Database seeded with test data");
  } catch (error) {
    console.error(
      "⚠️  Database seeding failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

export { startServer, seedDatabase };

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  });
}
