# Data Ownership

## Purpose
Define ownership, access, and tenant isolation rules for the major business entities in School OS so every contributor can reason about control boundaries without inventing ad hoc permissions.

## Scope
- Covers the primary school, identity, academic, people, assessment, attendance, reporting, and communication entities.
- Describes ownership and access intent, not physical schema or implementation code.
- Applies to product planning, architecture review, security review, and future implementation work.

## Governing Assumptions
- Single Neon PostgreSQL database.
- Shared tables.
- `school_id` on every tenant-owned record.
- Strict tenant isolation.
- No cross-school data access.
- School identity may be resolved through a subdomain or a mapped custom domain, but data ownership remains school-scoped.
- Session-based authentication with admin-created users only.

## Access Model Terms
- `Can View`: Roles or actors allowed to read the entity in normal operation.
- `Can Create`: Roles or actors allowed to create the entity.
- `Can Edit`: Roles or actors allowed to modify the entity after creation.
- `Can Delete`: Roles or actors allowed to remove the entity, usually with soft-delete or restricted archive behavior.
- `Audit Requirements`: Actions that must be recorded in audit logs.

## Ownership Principles
- Every tenant-owned entity belongs to exactly one school.
- Ownership follows the business boundary, not the UI screen.
- Platform-level actors may administer tenants, but they do not own tenant data.
- Sensitive changes to identity, roles, results, attendance, and school settings must always be auditable.
- Default access should be least-privilege and role-scoped.

## Ownership Tables

### School Domain

| Entity | Purpose | Owner | Tenant Scope | Can View | Can Create | Can Edit | Can Delete | Audit Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| School | Represents the tenant and the top-level business boundary. | School Admin; platform may provision and suspend | Tenant-owned; one school per tenant boundary | Super Admin, School Admin | Super Admin, School Admin | Super Admin, School Admin | Super Admin only, or restricted archival/suspension flow | Creation, update, suspension, reactivation, archival, deletion requests |
| SchoolDomain | Stores the school's access domain(s) such as subdomain or mapped custom domain. | School Admin; platform for mapping support | Tenant-owned | Super Admin, School Admin | Super Admin, School Admin | Super Admin, School Admin | Super Admin, School Admin | Domain add, update, remove, verification, remap |
| SchoolTheme | Stores approved visual identity settings such as logo and colors. | School Admin | Tenant-owned | Super Admin, School Admin | School Admin | School Admin | School Admin | Theme create, update, reset |
| SchoolSettings | Stores operational preferences, feature toggles, academic preferences, and local configuration. | School Admin | Tenant-owned | Super Admin, School Admin | School Admin | School Admin | School Admin | Settings create, update, reset, policy changes |

### Identity Domain

| Entity | Purpose | Owner | Tenant Scope | Can View | Can Create | Can Edit | Can Delete | Audit Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User | Represents a login identity for a human or platform operator. | Super Admin for platform users; School Admin for school users | Tenant-owned for school users; platform-owned for Super Admin accounts | Super Admin, School Admin, self for limited profile fields | Super Admin, School Admin | Super Admin, School Admin, self for permitted profile fields | Super Admin, School Admin, restricted deactivation only | User creation, invite issuance, activation, role change, deactivation, password reset, lockout |
| Role | Defines authorization category. | Architecture + Security governance; assigned by admin | Shared definition, but assignment is tenant-scoped | Super Admin, School Admin | Super Admin, School Admin assign existing roles only | Super Admin may manage platform roles; School Admin may assign only allowed roles | Rare, governance-only | Role assignment, revocation, elevation attempts |
| Session | Tracks authenticated access state. | Platform security controls | Tenant-scoped by authenticated user and school context | Self, security admins, support only when authorized | System only | System only | System only | Session creation, refresh, revocation, expiry, suspicious activity |

### People Domain

| Entity | Purpose | Owner | Tenant Scope | Can View | Can Create | Can Edit | Can Delete | Audit Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Student | Represents a learner enrolled in a school. | School Admin; academic staff in approved workflows | Tenant-owned | Super Admin, School Admin, Teacher, Parent, Student on own record | School Admin | School Admin, designated staff | School Admin, restricted archive or soft delete | Create, update, enrollment state changes, transfer, archive, restore |
| Teacher | Represents a staff member with instructional responsibility. | School Admin | Tenant-owned | Super Admin, School Admin, Teacher (self), limited related staff | School Admin | School Admin, self for profile fields | School Admin, restricted archive or deactivate | Create, update, assignment changes, archive, restore |
| Parent | Represents a guardian linked to one or more students. | School Admin | Tenant-owned | Super Admin, School Admin, Parent, limited Teacher access through student context | School Admin | School Admin, Parent for profile fields | School Admin, restricted archive or deactivate | Create, update, link/unlink student, archive, restore |

### Academic Domain

| Entity | Purpose | Owner | Tenant Scope | Can View | Can Create | Can Edit | Can Delete | Audit Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AcademicYear | Defines a school-wide academic cycle. | School Admin | Tenant-owned | Super Admin, School Admin, Teachers in scope | School Admin | School Admin | School Admin, if no dependent published records exist; otherwise archive | Create, open, close, archive, reopen attempts |
| Term | Defines an operational period within an academic year. | School Admin | Tenant-owned | Super Admin, School Admin, Teachers in scope | School Admin | School Admin | School Admin, if safe to archive | Create, update, open, close, archive |
| Class | Represents a teaching cohort, section, or homeroom. | School Admin and assigned academic staff | Tenant-owned | Super Admin, School Admin, Teacher, Parent through linked student, Student through enrollment | School Admin | School Admin, assigned teacher where allowed | School Admin, restricted archive only | Create, roster change, teacher assignment, archive, restore |
| Subject | Represents a curriculum subject or instructional area. | School Admin | Tenant-owned | Super Admin, School Admin, Teacher, Student in assigned context | School Admin | School Admin | School Admin, restricted archive | Create, update, archive, restore |

### Assessment Domain

| Entity | Purpose | Owner | Tenant Scope | Can View | Can Create | Can Edit | Can Delete | Audit Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Assessment | Represents an evaluative activity such as CA1, CA2, or Exam. | Teacher within assigned scope; School Admin has oversight | Tenant-owned | Super Admin, School Admin, Teacher, Student and Parent after publication rules permit | Teacher, School Admin | Teacher until review lock, School Admin | School Admin, restricted archive before publication | Create, edit, submit, review, publish, archive |
| AssessmentResult | Stores a student's score for a given assessment. | Teacher; authorized reviewer; school admin oversight | Tenant-owned | Super Admin, School Admin, Teacher, Student, Parent according to publication rules | Teacher, import or grading workflow | Teacher before lock; reviewer after submission | Restricted; usually not hard deleted | Result entry, correction, review, publication, override |
| ReportCard | Represents the published summary of term performance. | School Admin and authorized academic staff | Tenant-owned | Super Admin, School Admin, Teacher, Student, Parent according to visibility rules | System or School Admin workflow | Restricted to reissue, correction, archive | Restricted; usually archive only | Generate, review, publish, reissue, archive |

### Attendance Domain

| Entity | Purpose | Owner | Tenant Scope | Can View | Can Create | Can Edit | Can Delete | Audit Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Attendance | Records presence, absence, lateness, or excusal for a class session or attendance period. | Teacher; School Admin oversight | Tenant-owned | Super Admin, School Admin, Teacher, relevant Parent through student context, Student through self context where appropriate | Teacher, School Admin | Teacher before lock; School Admin for correction | Restricted; usually correction instead of deletion | Record, update, lock, unlock, correction, exception approval |

### Reporting Domain

| Entity | Purpose | Owner | Tenant Scope | Can View | Can Create | Can Edit | Can Delete | Audit Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AuditLog | Immutable record of security-relevant and operationally sensitive events. | Platform / Security | Tenant-scoped where applicable; platform-wide events also exist | Super Admin, Security, limited support roles | System only | System only | System only, retention policy only | Every required audit event, export, access, correction, admin action |

### Communication Domain

| Entity | Purpose | Owner | Tenant Scope | Can View | Can Create | Can Edit | Can Delete | Audit Requirements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Announcements | School-wide or audience-scoped communication notices. | School Admin; authorized staff | Tenant-owned | Super Admin, School Admin, Teacher, Parent, Student according to audience scope | School Admin, authorized staff | School Admin, authorized staff before publish | School Admin, restricted archive or delete before publish | Create, edit, publish, unpublish, archive, delete attempt |

## Entity Guidance

### School
- Ownership model: The school is the tenant itself and the root owner of all tenant data.
- Access model: Platform staff may administer the school, but school data remains school-scoped.
- Tenant isolation requirements: Every school-owned record must reference exactly one `school_id`. No shared-table access may bypass school context.

### SchoolDomain
- Ownership model: Domain mappings belong to the school, not to an individual user.
- Access model: Only school admins and approved platform operators may manage domains.
- Tenant isolation requirements: A domain can map to only one active school at a time unless explicitly approved for migration.

### SchoolTheme
- Ownership model: Theme settings are approved presentation controls owned by the school.
- Access model: Limited to school admins and approved platform support.
- Tenant isolation requirements: Theme data must never affect authorization, routing security, or data access boundaries.

### SchoolSettings
- Ownership model: Settings belong to the school and reflect approved operating policy.
- Access model: School admins manage settings within approved boundaries.
- Tenant isolation requirements: Settings must remain tenant-scoped and must not be used as hidden global configuration.

### User
- Ownership model: A user belongs to the school tenant that provisioned the account, except platform operators.
- Access model: Users can see their own profile and allowed operational details.
- Tenant isolation requirements: A user session must resolve to exactly one active school context for tenant work.

### Role
- Ownership model: Roles are governed centrally and assigned locally.
- Access model: School admins assign only approved roles; platform admins can manage global role policy.
- Tenant isolation requirements: Role definitions may be shared, but assignments are always tenant-scoped.

### Session
- Ownership model: Session state is system-managed, not user-owned.
- Access model: Visible only to the owning user and authorized security or support staff.
- Tenant isolation requirements: Sessions must resolve both identity and tenant context before tenant data access.

### Student, Teacher, Parent
- Ownership model: People records belong to the school that enrolled or linked them.
- Access model: Access is role-sensitive and relationship-sensitive.
- Tenant isolation requirements: Relationship links such as parent-to-student or teacher-to-class must never cross school boundaries.

### AcademicYear, Term, Class, Subject
- Ownership model: Academic structure is school-owned.
- Access model: Academic admins and assigned staff may manage structure within their scope.
- Tenant isolation requirements: Academic structure cannot be shared across schools.

### Assessment, AssessmentResult, ReportCard
- Ownership model: Assessment data is school-owned and subject to publication rules.
- Access model: Entry, review, and publication are role-gated.
- Tenant isolation requirements: Published and unpublished assessment data must remain inside the school boundary.

### Attendance
- Ownership model: Attendance belongs to the school and usually to a specific class session or school-defined attendance context.
- Access model: Teachers record, school admins oversee, and parents or students only see approved visibility windows.
- Tenant isolation requirements: Attendance records and summaries must not cross school boundaries.

### AuditLog
- Ownership model: Audit logs are platform-protected records with tenant context where applicable.
- Access model: Read access is restricted.
- Tenant isolation requirements: Audit retrieval must be tenant-aware except for approved platform-wide security review.

## Audit Rules
- All creation, updates, deletions, state changes, publication actions, and role changes for tenant-owned data must be auditable.
- Sensitive admin activity must include actor, target, tenant, action, timestamp, and outcome.
- Audit records must not be editable by application users.
- Audit logs should be retained according to security and compliance policy.

## Deletion and Retention Principles
- Prefer soft delete, archive, or close over hard delete for business records.
- Hard delete should be rare and reserved for data that must legally or operationally be removed.
- Published academic records should be immutable or corrected through a tracked correction process.
- Audit logs should be append-only and retained according to policy.

## Future Extensibility Recommendations
- Keep `school_id` mandatory for every tenant-owned entity.
- Add new entities only with a clear owner and lifecycle.
- Treat relationship links as first-class security boundaries.
- When adding global platform entities, document why they are not tenant-owned.
- Keep reporting aggregates non-identifying unless explicitly approved otherwise.
- Preserve compatibility with school subdomains and mapped custom domains for tenant resolution.
