declare const schoolIdBrand: unique symbol;

export type SchoolId = string & { readonly [schoolIdBrand]: "SchoolId" };

export interface TenantScope {
  readonly schoolId: SchoolId;
}

export interface DatabaseEnvironment {
  readonly databaseUrl: string;
  readonly directUrl?: string;
  readonly shadowDatabaseUrl?: string;
}

export function createSchoolId(value: string): SchoolId {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("schoolId must not be empty");
  }

  return trimmed as SchoolId;
}

export function createTenantScope(schoolId: string): TenantScope {
  return {
    schoolId: createSchoolId(schoolId)
  };
}

