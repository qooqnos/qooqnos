import {
  EntityId,
  VerificationStatus,
  Result,
  Ok,
  Err,
  UserId,
  WorkspaceId,
  type OnboardingStatus as LegacyOnboardingStatus,
} from "@qooqnos/core";
import { InMemoryDatabase, User } from "@qooqnos/database/legacy";

// ============================================================================
// ONBOARDING TYPES
// ============================================================================

export interface OnboardingSession {
  readonly userId: UserId;
  readonly status: LegacyOnboardingStatus;
  readonly verificationStatus: VerificationStatus;
  readonly currentStep: number;
  readonly completedSteps: readonly number[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OnboardingStep {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly validator: (data: unknown) => Result<unknown>;
}

// ============================================================================
// ONBOARDING WORKFLOW
// ============================================================================

export class OnboardingWorkflow {
  private steps: OnboardingStep[] = [
    {
      id: 1,
      name: "Email Verification",
      description: "Verify your email address",
      required: true,
      validator: this.validateEmailStep.bind(this),
    },
    {
      id: 2,
      name: "Profile Setup",
      description: "Complete your profile information",
      required: true,
      validator: this.validateProfileStep.bind(this),
    },
    {
      id: 3,
      name: "Workspace Creation",
      description: "Create your first workspace",
      required: true,
      validator: this.validateWorkspaceStep.bind(this),
    },
    {
      id: 4,
      name: "Service Setup",
      description: "List your first service (optional)",
      required: false,
      validator: this.validateServiceStep.bind(this),
    },
  ];

  constructor(private db: InMemoryDatabase) {}

  getSteps(): readonly OnboardingStep[] {
    return this.steps;
  }

  getStep(stepId: number): OnboardingStep | undefined {
    return this.steps.find((s) => s.id === stepId);
  }

  async startOnboarding(
    userId: UserId
  ): Promise<Result<OnboardingSession>> {
    try {
      const session: OnboardingSession = {
        userId,
        status: "incomplete",
        verificationStatus: "pending",
        currentStep: 1,
        completedSteps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return Ok(session);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error("Failed to start onboarding")
      );
    }
  }

  async completeStep(
    session: OnboardingSession,
    stepId: number,
    data: unknown
  ): Promise<Result<OnboardingSession>> {
    const step = this.getStep(stepId);
    if (!step) {
      return Err(new Error(`Step ${stepId} not found`));
    }

    const validation = step.validator(data);
    if (!validation.ok) {
      return validation as Result<OnboardingSession>;
    }

    if (session.completedSteps.includes(stepId)) {
      return Err(new Error(`Step ${stepId} already completed`));
    }

    const completedSteps = [...session.completedSteps, stepId].sort(
      (a, b) => a - b
    );
    const requiredSteps = this.steps.filter((s) => s.required).map((s) => s.id);
    const allRequired = requiredSteps.every((id) => completedSteps.includes(id));

    const updatedSession: OnboardingSession = {
      ...session,
      completedSteps,
      currentStep: stepId + 1,
      status: allRequired ? "complete" : "incomplete",
      verificationStatus: allRequired ? "verified" : session.verificationStatus,
      updatedAt: new Date(),
    };

    return Ok(updatedSession);
  }

  private validateEmailStep(data: unknown): Result<unknown> {
    if (!data || typeof data !== "object") {
      return Err(new Error("Invalid email data"));
    }
    const { email } = data as Record<string, unknown>;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email as string)) {
      return Err(new Error("Invalid email format"));
    }
    return Ok(data);
  }

  private validateProfileStep(data: unknown): Result<unknown> {
    if (!data || typeof data !== "object") {
      return Err(new Error("Invalid profile data"));
    }
    const { name, phone, country } = data as Record<string, unknown>;
    if (!name || !phone || !country) {
      return Err(new Error("Name, phone, and country are required"));
    }
    return Ok(data);
  }

  private validateWorkspaceStep(data: unknown): Result<unknown> {
    if (!data || typeof data !== "object") {
      return Err(new Error("Invalid workspace data"));
    }
    const { workspaceName, industry } = data as Record<string, unknown>;
    if (!workspaceName || !industry) {
      return Err(new Error("Workspace name and industry are required"));
    }
    return Ok(data);
  }

  private validateServiceStep(data: unknown): Result<unknown> {
    if (!data || typeof data !== "object") {
      return Err(new Error("Invalid service data"));
    }
    const { serviceName, price } = data as Record<string, unknown>;
    if (!serviceName || price === undefined) {
      return Err(new Error("Service name and price are required"));
    }
    if (typeof price !== "number" || price < 0) {
      return Err(new Error("Price must be a non-negative number"));
    }
    return Ok(data);
  }

  async getProgress(
    session: OnboardingSession
  ): Promise<{ readonly completed: number; readonly total: number }> {
    return {
      completed: session.completedSteps.length,
      total: this.steps.length,
    };
  }
}

// ============================================================================
// ONBOARDING MANAGER
// ============================================================================

export class OnboardingManager {
  private sessions: Map<UserId, OnboardingSession> = new Map();
  private workflow: OnboardingWorkflow;

  constructor(private db: InMemoryDatabase) {
    this.workflow = new OnboardingWorkflow(db);
  }

  async initializeUser(
    user: User
  ): Promise<Result<OnboardingSession>> {
    const existing = this.sessions.get(user.id);
    if (existing) {
      return Ok(existing);
    }

    const result = await this.workflow.startOnboarding(user.id);
    if (result.ok) {
      this.sessions.set(user.id, result.value);
    }
    return result;
  }

  async completeStep(
    userId: UserId,
    stepId: number,
    data: unknown
  ): Promise<Result<OnboardingSession>> {
    const session = this.sessions.get(userId);
    if (!session) {
      return Err(new Error("Onboarding session not found"));
    }

    const result = await this.workflow.completeStep(session, stepId, data);
    if (result.ok) {
      this.sessions.set(userId, result.value);
    }
    return result;
  }

  getSession(userId: UserId): OnboardingSession | undefined {
    return this.sessions.get(userId);
  }

  getWorkflow(): OnboardingWorkflow {
    return this.workflow;
  }
}

