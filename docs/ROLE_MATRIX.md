# Role Matrix

## Purpose
Define the canonical MVP role model for School OS so every contributor uses the same authorization vocabulary.

## Scope
- Covers the approved MVP roles and their intended responsibilities.
- Serves as the role source of truth for product, architecture, security, and future implementation work.
- Does not define implementation code or low-level permission tables.

## Canonical Roles

| Canonical Role | Common Alias | Primary Purpose | Tenant Scope |
| --- | --- | --- | --- |
| Super Admin | Platform administrator | Manages platform-wide tenant administration, support escalation, security controls, and system-level governance. | Platform-wide; may act across tenants with explicit authorization |
| School Admin | School Administrator | Manages a single school's setup, staff, learners, policies, and approved operational settings. | Tenant-scoped |
| Teacher | Teacher | Manages class-level instructional workflows, attendance, assessments, and result preparation within assigned scope. | Tenant-scoped |
| Parent | Parent or Guardian | Views approved child-related information and school communication for linked learners. | Tenant-scoped |
| Student | Learner | Accesses assigned learning activities and approved personal or academic information. | Tenant-scoped |

## Role Principles
- Roles are intentionally small and stable for MVP.
- Role names should be used consistently across all documents and future implementation work.
- Role-specific permissions may vary by feature, but the role set itself should not expand casually.
- Finance-related and support-related responsibilities are handled through existing roles and approval controls, not through separate MVP roles.
- No public signup means every role assignment is traceable and admin-controlled.

## Role Responsibilities

### Super Admin
- Can create, suspend, close, or reactivate schools.
- Can manage domain mappings and support escalation.
- Can review cross-tenant operational health with explicit controls.
- Can assign or revoke roles where platform policy allows it.
- Must not bypass tenant isolation or audit requirements.

### School Admin
- Can configure the school, invite staff, and manage approved school settings.
- Can manage students, teachers, parents, classes, subjects, attendance, assessments, and announcements within school scope.
- Can publish or approve school-level academic workflows where policy permits.
- Must not access other schools unless explicitly authorized through a platform-level support process.

### Teacher
- Can record attendance and manage assigned instructional workflows.
- Can prepare assessment results and class-level academic activities within scope.
- Can communicate through approved school channels.
- Must not manage unrelated tenant administration.

### Parent
- Can view approved learner-linked information and school communication.
- Can receive notices and school updates within the approved tenant scope.
- Must not view other students or schools.

### Student
- Can access assigned learning activities and approved personal academic information.
- Can view only the records and communication explicitly permitted by school policy.
- Must not manage administrative workflows.

## Prohibited Role Shapes
- No public self-service role creation.
- No tenant-defined free-form roles in MVP.
- No Finance Officer role in MVP.
- No Platform Operator role in MVP.
- No role should weaken tenant isolation or approval boundaries.

## Alias Guidance
- "School Administrator" and "School Admin" refer to the same canonical role.
- "Learner" maps to the canonical `Student` role.
- "Parent or Guardian" maps to the canonical `Parent` role.
- Historical references to `Platform Operator` should be read as platform support capability exercised by `Super Admin` or approved support staff.
- Historical references to `Finance Officer` should be read as finance-capable workflow access assigned through existing roles and policy, not as a standalone role.

## Change Rules
- Any change to the canonical role set requires a controlled documentation update and review.
- New role names should not be introduced casually in downstream docs.
- If a future role is added, the matrix must be updated first and all dependent docs must be aligned in the same change window.
