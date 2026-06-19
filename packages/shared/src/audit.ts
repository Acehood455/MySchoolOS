export type AuditActorType = "user" | "system";
export type AuditSeverity = "low" | "medium" | "high" | "critical";
export type AuditOutcome = "success" | "failure";

export interface AuditActor {
  readonly actorType: AuditActorType;
  readonly actorId?: string;
}

export interface AuditResource {
  readonly resourceType: string;
  readonly resourceId?: string;
}

export interface AuditRecord {
  readonly id: string;
  readonly eventName: string;
  readonly actorType: AuditActorType;
  readonly actorId?: string;
  readonly schoolId?: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly severity: AuditSeverity;
  readonly outcome: AuditOutcome;
  readonly createdAt: string;
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly beforeState?: Readonly<Record<string, unknown>>;
  readonly afterState?: Readonly<Record<string, unknown>>;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AuditWriteInput extends Omit<AuditRecord, "id" | "createdAt"> {
  readonly id?: string;
  readonly createdAt?: string;
}

export interface AuditQuery {
  readonly schoolId?: string;
  readonly eventName?: string;
  readonly actorId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly outcome?: AuditOutcome;
  readonly limit?: number;
}
