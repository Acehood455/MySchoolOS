import {
  AppError,
  type AuditActorType,
  type AuditOutcome,
  type AuditQuery,
  type AuditRecord,
  type AuditSeverity
} from "@myschoolos/shared";
import { randomUUID } from "node:crypto";
import { freezeAuditRecord, type AuditPersistence } from "./audit.persistence.js";

function defaultClock(): Date {
  return new Date();
}

function defaultIdFactory(): string {
  return `audit_${randomUUID().replace(/-/g, "")}`;
}

export interface AuditServiceOptions {
  readonly persistence: AuditPersistence;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
}

export interface AuditEventInput {
  readonly eventName: string;
  readonly actorType: AuditActorType;
  readonly actorId?: string;
  readonly schoolId?: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly severity: AuditSeverity;
  readonly outcome: AuditOutcome;
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly beforeState?: Readonly<Record<string, unknown>>;
  readonly afterState?: Readonly<Record<string, unknown>>;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class AuditService {
  public constructor(private readonly options: AuditServiceOptions) {}

  public async record(input: AuditEventInput): Promise<AuditRecord> {
    this.validate(input);

    const record = freezeAuditRecord({
      ...input,
      id: this.options.idFactory?.() ?? defaultIdFactory(),
      createdAt: (this.options.clock?.() ?? defaultClock()).toISOString()
    } as AuditRecord);

    const persisted = await this.options.persistence.append(record);

    return freezeAuditRecord(persisted);
  }

  public list(query?: AuditQuery): Promise<readonly AuditRecord[]> {
    return this.options.persistence.list(query);
  }

  private validate(input: AuditEventInput): void {
    if (!input.eventName.trim()) {
      throw new AppError("Audit event name is required", {
        status: 400,
        code: "audit_event_invalid"
      });
    }

    if (!input.resourceType.trim()) {
      throw new AppError("Audit resource type is required", {
        status: 400,
        code: "audit_event_invalid"
      });
    }

    if (input.actorType === "user" && !input.actorId?.trim()) {
      throw new AppError("Audit actor id is required for user events", {
        status: 400,
        code: "audit_event_invalid"
      });
    }

    if (!input.severity) {
      throw new AppError("Audit severity is required", {
        status: 400,
        code: "audit_event_invalid"
      });
    }

    if (!input.outcome) {
      throw new AppError("Audit outcome is required", {
        status: 400,
        code: "audit_event_invalid"
      });
    }
  }
}
