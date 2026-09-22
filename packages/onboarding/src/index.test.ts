import { describe, it, expect, beforeEach } from "vitest";
import {
  OnboardingWorkflow,
  OnboardingManager,
} from "./legacy";
import { InMemoryDatabase, createUser } from "@qooqnos/database/legacy";
import { createUserId } from "@qooqnos/core";

describe("OnboardingWorkflow", () => {
  let db: InMemoryDatabase;
  let workflow: OnboardingWorkflow;

  beforeEach(() => {
    db = new InMemoryDatabase();
    workflow = new OnboardingWorkflow(db);
  });

  it("should initialize with correct steps", () => {
    const steps = workflow.getSteps();
    expect(steps.length).toBe(4);
    expect(steps[0]?.name).toBe("Email Verification");
  });

  it("should validate email step correctly", async () => {
    const userId = createUserId("user_1");
    const session = await workflow.startOnboarding(userId);

    if (!session.ok) {
      throw new Error("Failed to start onboarding");
    }

    const valid = await workflow.completeStep(session.value, 1, {
      email: "test@example.com",
    });

    expect(valid.ok).toBe(true);
  });

  it("should reject invalid email", async () => {
    const userId = createUserId("user_1");
    const session = await workflow.startOnboarding(userId);

    if (!session.ok) {
      throw new Error("Failed to start onboarding");
    }

    const invalid = await workflow.completeStep(session.value, 1, {
      email: "invalid-email",
    });

    expect(invalid.ok).toBe(false);
  });

  it("should track completed steps", async () => {
    const userId = createUserId("user_1");
    const session = await workflow.startOnboarding(userId);

    if (!session.ok) {
      throw new Error("Failed to start onboarding");
    }

    let current = session.value;

    const step1 = await workflow.completeStep(current, 1, {
      email: "test@example.com",
    });

    if (!step1.ok) {
      throw new Error("Failed to complete step 1");
    }

    current = step1.value;

    expect(current.completedSteps.includes(1)).toBe(true);
  });
});

describe("OnboardingManager", () => {
  let db: InMemoryDatabase;
  let manager: OnboardingManager;

  beforeEach(() => {
    db = new InMemoryDatabase();
    manager = new OnboardingManager(db);
  });

  it("should initialize user onboarding", async () => {
    const user = createUser("user_1", "alice@example.com", "Alice");
    const result = await manager.initializeUser(user);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(user.id);
      expect(result.value.status).toBe("incomplete");
    }
  });

  it("should prevent duplicate initialization", async () => {
    const user = createUser("user_1", "alice@example.com", "Alice");
    const first = await manager.initializeUser(user);
    const second = await manager.initializeUser(user);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    if (first.ok && second.ok) {
      expect(first.value.userId).toBe(second.value.userId);
    }
  });

  it("should complete onboarding steps", async () => {
    const user = createUser("user_1", "alice@example.com", "Alice");
    const init = await manager.initializeUser(user);

    if (!init.ok) {
      throw new Error("Failed to initialize");
    }

    const step1 = await manager.completeStep(user.id, 1, {
      email: "alice@example.com",
    });

    expect(step1.ok).toBe(true);
    if (step1.ok) {
      expect(step1.value.completedSteps).toContain(1);
    }
  });
});
