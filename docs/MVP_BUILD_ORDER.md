# MVP Build Order

## Purpose
Define the exact implementation sequence for the MVP so product, engineering, architecture, and security stay aligned on what must be built first and what must not be built yet.

This document is the authoritative build sequence for MVP delivery. It translates the approved implementation plan and product requirements into a phase-by-phase order of operations that protects tenant isolation, security, and release discipline.

## Phase 1: Foundation

### Goals
- Establish the tenant boundary and host-based tenant resolution.
- Implement secure session-based authentication with admin-created users only.
- Implement the canonical role model and authorization baseline.
- Implement audit logging for privileged and sensitive actions.
- Provide school provisioning, domain verification, and tenant-safe administrative controls.

### Dependencies
- Governing architecture and security docs.
- Canonical role matrix.
- Foundation implementation and database specifications.

### Deliverables
- School provisioning support
- SchoolDomain support
- SchoolTheme support
- SchoolSettings support
- User support
- Session support
- Role support
- RoleAssignment support
- AuditLog support
- Tenant resolution middleware
- Authentication middleware
- Authorization middleware
- Audit middleware

### Completion Criteria
- A school can be provisioned and resolved as a tenant.
- `school_id` isolation is enforced on all tenant-scoped paths.
- Session authentication is working with secure HttpOnly cookies.
- Admin-created users can be invited, activated, and managed.
- Role assignments are tenant-scoped and auditable.
- Audit logging captures required security and administrative events.

## Phase 2: School Core

### Goals
- Build the school-facing operational core that sits above the foundation.
- Enable the basic tenant administration workflows used to configure a school.
- Prepare the platform for people, academic structure, and later workflows.

### Dependencies
- Foundation must be complete and approved.
- Tenant resolution, auth, authz, and audit must already be in place.

### Deliverables
- School setup and maintenance workflows
- School configuration workflows
- School branding and operational settings workflows
- Core school administration surfaces

### Completion Criteria
- School admins can configure their school within tenant-safe boundaries.
- Core school settings are editable only by authorized roles.
- No academic workflow is introduced yet.

## Phase 3: People

### Goals
- Introduce the managed people layer for the school.
- Establish student, teacher, and parent records with tenant-safe relationships.
- Enable invitation and linkage workflows that support the later academic modules.

### Dependencies
- Foundation complete.
- School Core complete.

### Deliverables
- Student management
- Teacher management
- Parent management
- Student enrollment and guardian linkage
- Teacher assignment relationships

### Completion Criteria
- School admins can create and manage people records.
- People records are tenant-scoped and auditable.
- Parent and teacher relationships are constrained by school context.

## Phase 4: Academic Structure

### Goals
- Establish the academic containers needed for all future academic workflows.
- Model the school calendar and instructional structure.
- Prepare the system for attendance, assessments, and results.

### Dependencies
- Foundation complete.
- People complete.

### Deliverables
- Academic years
- Terms
- Classes
- Subjects
- Teacher-class assignments
- Teacher-subject assignments

### Completion Criteria
- Academic structure can be configured for a school.
- Structure changes are tenant-scoped and auditable.
- Later attendance and assessment workflows have valid academic containers to attach to.

## Phase 5: Attendance

### Goals
- Allow teachers and school admins to record attendance.
- Support attendance review, correction, and finalization.
- Keep attendance aligned with the approved status model and tenant isolation rules.

### Dependencies
- Foundation complete.
- People complete.
- Academic Structure complete.

### Deliverables
- Attendance entry
- Attendance review
- Attendance correction
- Attendance locking/finalization
- Parent visibility where approved

### Completion Criteria
- Attendance can be recorded for the correct student and class context.
- Attendance is auditable and tenant-scoped.
- Locked attendance cannot be casually changed.

## Phase 6: Assessments

### Goals
- Allow teachers to create and manage assessments.
- Support assessment lifecycle states from draft through closure.
- Prepare the assessment data needed for results processing.

### Dependencies
- Foundation complete.
- People complete.
- Academic Structure complete.
- Attendance complete where assessment workflows depend on attendance context.

### Deliverables
- Assessment creation
- Assessment editing
- Assessment opening
- Assessment closing
- Assessment archival

### Completion Criteria
- Assessments can be created within the correct term, class, subject, and teacher scope.
- Assessment lifecycle behavior is enforced.
- Assessment changes are audited.

## Phase 7: Results

### Goals
- Allow teachers to enter draft results.
- Support review and publication by authorized School Admin users.
- Enforce the finalized result lifecycle and publication rules.

### Dependencies
- Foundation complete.
- People complete.
- Academic Structure complete.
- Assessments complete.

### Deliverables
- Result entry
- Result submission
- Result review
- Result publication
- Result archival
- Grading policy application

### Completion Criteria
- Teachers can prepare draft results.
- Authorized School Admin users can review and publish results.
- Published results respect tenant, role, and relationship boundaries.
- Result audit events are captured.

## Phase 8: Report Cards

### Goals
- Generate report cards from approved assessment results.
- Support review, publication, reissue, and archival.
- Provide a clear published academic summary for students and parents.

### Dependencies
- Foundation complete.
- People complete.
- Academic Structure complete.
- Assessments complete.
- Results complete.

### Deliverables
- Report card generation
- Report card review
- Report card publication
- Report card reissue
- Report card archival

### Completion Criteria
- Report cards can be generated from final results.
- Report cards follow the approved lifecycle.
- Parents and students can access only approved report card data.

## Phase 9: Parent Portal

### Goals
- Provide parent-facing access to approved child-related information.
- Limit visibility to explicit relationships and approved tenant context.
- Expose only the information the parent is allowed to see.

### Dependencies
- Foundation complete.
- People complete.
- Academic Structure complete.
- Attendance complete.
- Assessments complete.
- Results complete.
- Report Cards complete.

### Deliverables
- Parent login and access flow
- Approved child-linked views
- Attendance visibility where approved
- Results visibility where approved
- Report card visibility where approved
- Communication views where approved by product requirements

### Completion Criteria
- Parents can see only linked student information.
- Parent access is constrained by tenant and relationship rules.
- No other tenant data is exposed.

## Phase 10: White Label

### Goals
- Add approved brand and presentation controls for tenant-facing surfaces.
- Keep presentation flexibility separate from identity, authorization, and tenant boundaries.

### Dependencies
- Foundation complete.
- School Core complete.
- Tenant-safe rendering and settings support must already exist.

### Deliverables
- Brand/theme controls
- School visual configuration
- Approved tenant presentation settings

### Completion Criteria
- Branding can be customized within approved limits.
- White-label settings do not affect authentication, authorization, or data isolation.
- Brand changes are auditable.

## Prohibited Sequencing Mistakes
- Building people records before Foundation is complete.
- Building assessments, results, or report cards before academic structure exists.
- Building parent-facing views before parent relationships and results visibility rules exist.
- Building white-label controls before the platform can safely isolate tenant data.
- Building attendance or results before the school, role, and audit foundations exist.
- Introducing cross-tenant reporting before tenant-safe aggregates are explicitly approved.
- Treating UI filtering as a substitute for tenant isolation.
- Allowing role expansion before the canonical role matrix is in place.

## Modules That Must Never Be Built Before Prerequisites Exist
- `Student` before Foundation and People
- `Teacher` before Foundation and People
- `Parent` before Foundation and People
- `AcademicYear` before Foundation and People
- `Term` before Foundation and People
- `Class` before Foundation and People
- `Subject` before Foundation and People
- `Attendance` before Foundation, People, and Academic Structure
- `Assessment` before Foundation, People, and Academic Structure
- `AssessmentResult` before Foundation, People, Academic Structure, and Assessments
- `ReportCard` before Foundation, People, Academic Structure, Assessments, and Results
- Parent portal views before People, Attendance, Results, and Report Cards
- White-label presentation controls before Foundation and safe tenant rendering

## Build Discipline
- Each phase must be completed and approved before the next phase begins.
- Each phase must preserve the approved tenant, role, lifecycle, and audit rules.
- No phase may introduce a hidden dependency on a later phase.
- If a dependency is missing, the phase must stop and the prerequisite must be built first.
