# Database Design

## Purpose
Describe the conceptual database structure of School OS so architecture, product, and security reviews share the same mental model before implementation begins.

## Scope
- Covers domain organization, entity relationships, tenant ownership, lifecycle intent, and deletion behavior.
- Does not define Prisma schema, SQL, indexes, migrations, or API implementation details.
- Assumes a single Neon PostgreSQL database with shared tables and `school_id` tenant isolation.

## Design Principles
- Shared tables are acceptable only when every tenant-owned row has a school boundary.
- `school_id` is mandatory on every tenant-owned entity.
- Platform-wide entities must be clearly labeled and never confused with tenant-owned records.
- Relationship modeling must preserve tenant isolation.
- Delete behavior should default to archive or soft delete when records are operationally meaningful.
- Verified custom domains are resolved before subdomains, and duplicate host mappings are prohibited.

## Domain Map
- School Domain
- Identity Domain
- Academic Domain
- People Domain
- Assessment Domain
- Attendance Domain
- Reporting Domain
- Communication Domain

## Conceptual Entity Map

### School Domain

#### School
- Purpose: Root tenant record and business boundary.
- Relationships: Has one or more domains, settings, theme records, users, students, teachers, parents, classes, years, terms, subjects, assessments, attendance records, results, report cards, and announcements.
- Tenant ownership: Tenant-owned root entity.
- Lifecycle notes: School records move through pending onboarding, active use, suspension, and archival.
- Deletion behavior: Prefer archival over hard delete.
- `school_id`: Owns the top-level boundary and is the source of all tenant-scoped filtering.

#### SchoolDomain
- Purpose: Stores the school's access domain or mapped custom domain.
- Relationships: Belongs to one school.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Custom domains must be verified before use; verified custom domains resolve before subdomains; conflicts are rejected and audited.
- Deletion behavior: Remove only when the mapping is no longer active.
- `school_id`: Required.

#### SchoolTheme
- Purpose: Stores presentation settings such as logo and approved colors.
- Relationships: Belongs to one school.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Can be drafted, approved, updated, or reset.
- Deletion behavior: Prefer reset or archive.
- `school_id`: Required.

#### SchoolSettings
- Purpose: Stores school-level operational preferences.
- Relationships: Belongs to one school.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Settings can change over time as policy evolves.
- Deletion behavior: Prefer versioned updates over delete.
- `school_id`: Required.

### Identity Domain

#### User
- Purpose: Login identity for a human or platform operator.
- Relationships: Belongs to one school in the tenant model, or to the platform for Super Admin users; linked to one or more roles.
- Tenant ownership: Tenant-owned for school users, platform-owned for super admins.
- Lifecycle notes: Invited, active, suspended, deactivated, or archived.
- Deletion behavior: Prefer deactivation over hard delete.
- `school_id`: Required for school users.

#### Role
- Purpose: Fixed authorization category.
- Relationships: Assigned to users.
- Tenant ownership: Shared policy object; assignments are tenant-scoped.
- Lifecycle notes: Roles are stable and changed by governance, not by daily operations.
- Deletion behavior: Do not casually delete roles; deprecate through governance.
- `school_id`: Not required for global role definitions; required for assignment records.

#### Session
- Purpose: Represents an authenticated access session.
- Relationships: Belongs to one user and one active tenant context.
- Tenant ownership: Derived from authenticated user context.
- Lifecycle notes: Created on login, refreshed during use, revoked on logout or admin action, expires automatically.
- Deletion behavior: Expire or revoke rather than delete manually.
- `school_id`: Required for tenant-scoped work.

#### RoleAssignment
- Purpose: Links a user to a canonical role within a specific school.
- Relationships: Belongs to one user and one role.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Created on invite or assignment, updated on role change, revoked on removal.
- Deletion behavior: Prefer revocation or archival over hard delete.
- `school_id`: Required.

### People Domain

#### Student
- Purpose: Student profile and enrollment anchor.
- Relationships: Linked to parents, classes, attendance, assessments, report cards.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft or created, enrolled, active, transferred, withdrawn, archived.
- Deletion behavior: Prefer archive or withdrawal status over hard delete.
- `school_id`: Required.

#### Teacher
- Purpose: Staff profile for instructional responsibility.
- Relationships: Linked to classes, subjects, attendance, assessments, and results workflows.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Pending invite, active, suspended, inactive, archived.
- Deletion behavior: Prefer archive or inactive state.
- `school_id`: Required.

#### Parent
- Purpose: Guardian profile for linked student visibility.
- Relationships: Linked to one or more students and communication audiences.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Pending link, active, unlinked, suspended, archived.
- Deletion behavior: Prefer archive over delete.
- `school_id`: Required.

#### StudentEnrollment
- Purpose: Records a student's enrollment or transfer relationship to the school and academic context.
- Relationships: Belongs to one student and one school, and may reference class, year, and term context.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Enrolled, active, transferred, withdrawn, archived.
- Deletion behavior: Prefer archive or withdrawal state over hard delete.
- `school_id`: Required.

#### StudentGuardianLink
- Purpose: Connects a parent to a student for approved visibility.
- Relationships: Belongs to one student and one parent.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Pending, active, removed, archived.
- Deletion behavior: Prefer removal or archival over delete.
- `school_id`: Required.

### Academic Domain

#### AcademicYear
- Purpose: School-wide academic cycle container.
- Relationships: Contains terms, classes, assessments, attendance periods, and results.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, open, closed, archived.
- Deletion behavior: Prefer archive after completion.
- `school_id`: Required.

#### Term
- Purpose: Subdivision of an academic year.
- Relationships: Belongs to one academic year and contains classes, assessments, attendance, and report publishing milestones.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, open, closed, archived.
- Deletion behavior: Prefer archive after closure.
- `school_id`: Required.

#### Class
- Purpose: Represents a teaching group, section, or homeroom.
- Relationships: Belongs to academic year and term context; linked to teachers, students, subjects, assessments, attendance.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Planned, active, suspended, archived.
- Deletion behavior: Prefer archive rather than delete because historical records depend on it.
- `school_id`: Required.

#### Subject
- Purpose: Represents a subject area or course discipline.
- Relationships: Linked to classes, teachers, assessments, results.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, active, inactive, archived.
- Deletion behavior: Prefer archive if already referenced.
- `school_id`: Required.

#### TeacherClassAssignment
- Purpose: Connects a teacher to a class.
- Relationships: Belongs to one teacher and one class.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Assigned, reassigned, removed, archived.
- Deletion behavior: Prefer removal or archival.
- `school_id`: Required.

#### TeacherSubjectAssignment
- Purpose: Connects a teacher to a subject.
- Relationships: Belongs to one teacher and one subject.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Assigned, reassigned, removed, archived.
- Deletion behavior: Prefer removal or archival.
- `school_id`: Required.

### Assessment Domain

#### Assessment
- Purpose: Represents CA1, CA2, Exam, or another approved evaluative activity.
- Relationships: Belongs to a term, class, subject, and teacher owner; produces many assessment results.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, open, closed, archived.
- Deletion behavior: Prefer archive; do not delete after results exist.
- `school_id`: Required.

#### AssessmentResult
- Purpose: Stores a student's score for a specific assessment.
- Relationships: Belongs to one assessment and one student.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, submitted, reviewed, published, archived.
- Deletion behavior: Prefer correction or archival; avoid hard delete if published.
- `school_id`: Required.

#### ReportCard
- Purpose: Summarizes performance across assessments and terms.
- Relationships: Derived from assessment results, academic year, term, student, class, and subject context.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, generated, reviewed, published, reissued, archived.
- Deletion behavior: Prefer reissue or archive.
- `school_id`: Required.

#### GradingPolicy
- Purpose: Stores CA1, CA2, Exam weighting and grade thresholds.
- Relationships: Applies to a school, year, term, or reporting cycle depending on policy design.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, active, superseded, archived.
- Deletion behavior: Prefer versioned supersession over delete.
- `school_id`: Required.

### Attendance Domain

#### Attendance
- Purpose: Records attendance state for a student in a class or attendance period.
- Relationships: Belongs to student, class, teacher recorder, term, and academic year context.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, recorded, corrected, locked, archived.
- Deletion behavior: Prefer correction over deletion.
- `school_id`: Required.

### Reporting Domain

#### AuditLog
- Purpose: Immutable record of security-relevant and operationally sensitive events.
- Relationships: References actors, tenant context, and affected resources.
- Tenant ownership: Tenant-aware platform record.
- Lifecycle notes: Append-only.
- Deletion behavior: Retain according to policy; do not delete through normal application flow.
- `school_id`: Required for tenant-scoped events; platform events may remain global.

#### DomainVerification
- Purpose: Records verification status for a school domain or mapped custom domain.
- Relationships: Belongs to one school and one host mapping.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Pending, verified, remapped, revoked, archived. Custom domains require verification before participating in tenant resolution.
- Deletion behavior: Prefer revocation or archival.
- `school_id`: Required.

### Communication Domain

#### Announcements
- Purpose: School notices and communication messages.
- Relationships: Belongs to a school and may target classes, roles, students, parents, or staff groups.
- Tenant ownership: Tenant-owned.
- Lifecycle notes: Draft, scheduled, published, archived, deleted before publish only if permitted.
- Deletion behavior: Prefer archive after publication.
- `school_id`: Required.

## Relationship Diagrams

### School Domain
School
  - SchoolDomain
  - DomainVerification
  - SchoolTheme
  - SchoolSettings
  - Users
  - Students
  - Teachers
  - Parents
  - AcademicYears
  - Classes
  - Assessments
  - Attendance
  - ReportCards
  - Announcements

### Identity and People
User
  - Role assignments
  - Session(s)
  - RoleAssignment

Parent
  - Student links
  - StudentGuardianLink

Teacher
  - Class assignments
  - Subject assignments
  - Assessment ownership
  - TeacherClassAssignment
  - TeacherSubjectAssignment

### Academic and Assessment
AcademicYear
  - Terms
  - Classes
  - GradingPolicy

Term
  - Classes
  - Assessments
  - Attendance records
  - ReportCards

Class
  - Students
  - Teachers
  - Subjects
  - Assessments
  - Attendance records

Assessment
  - AssessmentResults

Student
  - Attendance records
  - AssessmentResults
  - ReportCards
  - StudentEnrollment
  - StudentGuardianLink

### Attendance and Reporting
Attendance
  - Student
  - Class
  - Teacher
  - Term / AcademicYear context

ReportCard
  - Student
  - AcademicYear
  - Term
  - Published assessment summary

## Required Relationship Rules

### Parent <-> Student
- A parent may be linked to one or more students.
- A student may be linked to one or more parents if the school approves it.
- Every link must remain within the same `school_id`.
- Parent access should always resolve through linked student context.

### Teacher <-> Subject
- A teacher may teach one or more subjects.
- A subject may be taught by one or more teachers if the school structure allows it.
- Subject assignment must remain within the same school.

### Teacher <-> Class
- A teacher may be assigned to one or more classes.
- A class may have one primary teacher or multiple responsible teachers depending on school policy.
- Assignments must be tenant-scoped and auditable.

### Assessment <-> AssessmentResult
- One assessment can produce many assessment results.
- One result belongs to exactly one assessment and one student.
- Results cannot cross school boundaries.

### RoleAssignment
- One role assignment belongs to exactly one user and one school.
- A user may have more than one role only if governance allows it.

### StudentEnrollment / StudentGuardianLink / TeacherClassAssignment / TeacherSubjectAssignment
- These links are first-class tenant records.
- They must never reference cross-school records.
- Their creation, removal, and reassignment are auditable.

### DomainVerification
- A verified host must resolve to exactly one school.
- No host may remain ambiguous or point to multiple active tenants.
- Verified custom domains are resolved before subdomains.
- Conflicting host mappings must be rejected and audited before any tenant data access occurs.

### GradingPolicy
- A school may version grading policies over time.
- Published result calculations should reference the correct active policy for the term or reporting cycle.

## Tenant-Owned Entity List
The following entity families are tenant-owned and must contain `school_id`:
- SchoolDomain
- DomainVerification
- SchoolTheme
- SchoolSettings
- User for school users
- RoleAssignment
- Student
- StudentEnrollment
- StudentGuardianLink
- Teacher
- TeacherClassAssignment
- TeacherSubjectAssignment
- Parent
- AcademicYear
- Term
- Class
- Subject
- GradingPolicy
- Assessment
- AssessmentResult
- ReportCard
- Attendance
- Announcements
- AuditLog for tenant-scoped events

## Deletion Behavior Guidance
- Prefer archive, suspend, close, or deactivate over hard delete.
- Do not delete published academic history unless a legal or security requirement demands it.
- Use correction workflows for operational mistakes where historical continuity matters.
- Use irreversible delete only for pre-publication or legally removable data.

## Lifecycle Notes by Domain
- School and identity records should support suspension and reactivation.
- Academic structure should support closure at term and year boundaries.
- Assessment and attendance records should lock after review or publication.
- Reports should become immutable after publication.
- Communications should support scheduled publish and archive.

## Future Extensibility Recommendations
- Keep `school_id` mandatory for every tenant-owned entity.
- Add new entities only with a clear owner and lifecycle.
- Treat relationship links as first-class security boundaries.
- When adding global platform entities, document why they are not tenant-owned.
- Keep reporting aggregates non-identifying unless explicitly approved otherwise.
- Preserve compatibility with school subdomains and mapped custom domains for tenant resolution.
- Add policy entities whenever a rule needs to be versioned independently from the codebase.
