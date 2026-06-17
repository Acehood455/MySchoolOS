# Entity Lifecycles

## Purpose
Define the lifecycle states, transitions, and audit expectations for the major entities in School OS so contributors can build predictable workflows without inventing inconsistent state models.

## Scope
- Covers lifecycle behavior for School, Student, Teacher, Parent, AcademicYear, Term, Class, Attendance, Assessment, AssessmentResult, ReportCard, and User.
- Describes business states, not storage or code implementation details.
- Applies to planning, design, security review, and future implementation.

## Lifecycle Principles
- States should be simple enough to explain to school staff.
- Published or completed records should become harder to modify, not easier.
- State changes must be auditable when they affect access, visibility, or permanence.
- Invalid transitions must be blocked by design, not corrected after the fact.
- Archive and deactivate are preferred over hard delete for most business records.

## School

### State Diagram
Pending -> Active -> Suspended -> Archived

### State Descriptions
- Pending: School record exists but onboarding is incomplete.
- Active: School is fully operational.
- Suspended: Access is restricted due to admin, security, or policy action.
- Archived: School is retained for history and compliance with minimal operational access.

### Valid Transitions
- Pending -> Active
- Active -> Suspended
- Suspended -> Active
- Active -> Archived
- Suspended -> Archived

### Invalid Transitions
- Active -> Pending
- Archived -> Active

### Triggering Actions
- Onboarding completion activates the school.
- Compliance, safety, or payment issues may suspend the school.
- Administrative review restores a suspended school to active status.
- Long-term retention moves it to archived status.

### Audit Requirements
- School created
- School activated
- School suspended
- School reactivated
- School archived

## Student

### State Diagram
Invited -> Enrolled -> Active -> Suspended -> Withdrawn -> Archived

### State Descriptions
- Invited: Student record has been created or linked but not fully active.
- Enrolled: Student is accepted into the school.
- Active: Student participates in normal school workflows.
- Suspended: Student access or participation is restricted.
- Withdrawn: Student has formally left the school.
- Archived: Student record is retained for history.

### Valid Transitions
- Invited -> Enrolled
- Enrolled -> Active
- Active -> Suspended
- Suspended -> Active
- Active -> Withdrawn
- Suspended -> Withdrawn
- Withdrawn -> Archived

### Invalid Transitions
- Archived -> Active
- Withdrawn -> Enrolled without a re-enrollment process

### Triggering Actions
- Enrollment approval activates the student.
- Disciplinary or administrative action may suspend the student.
- Exit or transfer processing moves the student to withdrawn.

### Audit Requirements
- Student created
- Student enrolled
- Student updated
- Student suspended
- Student withdrawn
- Student archived

## Teacher

### State Diagram
Invited -> Active -> Suspended -> Inactive -> Archived

### State Descriptions
- Invited: Teacher account or profile has been prepared.
- Active: Teacher is authorized to teach and access assigned workflows.
- Suspended: Teacher access is temporarily restricted.
- Inactive: Teacher is not currently assigned active duties.
- Archived: Teacher record is retained for history.

### Valid Transitions
- Invited -> Active
- Active -> Suspended
- Suspended -> Active
- Active -> Inactive
- Inactive -> Active
- Suspended -> Inactive
- Inactive -> Archived

### Invalid Transitions
- Archived -> Active
- Active -> Invited

### Triggering Actions
- Invitation acceptance activates the teacher.
- Admin action suspends, deactivates, or archives the teacher.

### Audit Requirements
- Teacher created
- Teacher activated
- Teacher suspended
- Teacher deactivated
- Teacher archived

## Parent

### State Diagram
Invited -> Linked -> Active -> Unlinked -> Archived

### State Descriptions
- Invited: Parent profile exists but has not yet been linked or activated.
- Linked: Parent is connected to at least one student.
- Active: Parent can use approved visibility and communication features.
- Unlinked: Parent has no active student association.
- Archived: Parent record is retained for history.

### Valid Transitions
- Invited -> Linked
- Linked -> Active
- Active -> Unlinked
- Unlinked -> Linked
- Active -> Archived
- Unlinked -> Archived

### Invalid Transitions
- Archived -> Active
- Active -> Invited

### Triggering Actions
- Student link confirmation activates the parent relationship.
- Student departure or link removal can unlink the parent.

### Audit Requirements
- Parent created
- Parent linked to student
- Parent updated
- Parent unlinked
- Parent archived

## AcademicYear

### State Diagram
Planned -> Open -> Closed -> Archived

### State Descriptions
- Planned: Year exists but is not yet in use.
- Open: Academic operations can be recorded.
- Closed: No new operational records should be added.
- Archived: Year is preserved for historical reference.

### Valid Transitions
- Planned -> Open
- Open -> Closed
- Closed -> Archived

### Invalid Transitions
- Closed -> Open without formal reopening
- Archived -> Open

### Triggering Actions
- Administrative setup opens the year.
- End-of-year processing closes it.

### Audit Requirements
- Academic year created
- Academic year opened
- Academic year closed
- Academic year archived

## Term

### State Diagram
Planned -> Open -> Closed -> Archived

### State Descriptions
- Planned: Term exists but is not yet active.
- Open: Teaching, attendance, and assessment activities can occur.
- Closed: Term is finalized.
- Archived: Term remains as part of history.

### Valid Transitions
- Planned -> Open
- Open -> Closed
- Closed -> Archived

### Invalid Transitions
- Closed -> Open without formal reopening
- Archived -> Open

### Triggering Actions
- School calendar setup opens the term.
- Term end closes it.

### Audit Requirements
- Term created
- Term opened
- Term closed
- Term archived

## Class

### State Diagram
Draft -> Active -> Suspended -> Archived

### State Descriptions
- Draft: Class exists but is not yet operational.
- Active: Class accepts students and instructional activity.
- Suspended: Class is temporarily unavailable.
- Archived: Class is kept for historical reference.

### Valid Transitions
- Draft -> Active
- Active -> Suspended
- Suspended -> Active
- Active -> Archived
- Suspended -> Archived

### Invalid Transitions
- Archived -> Active
- Active -> Draft

### Triggering Actions
- Class setup activates the class.
- Policy changes or calendar changes may suspend or archive it.

### Audit Requirements
- Class created
- Class updated
- Class suspended
- Class archived

## Attendance

### State Diagram
Draft -> Recorded -> Corrected -> Locked -> Archived

### State Descriptions
- Draft: Attendance entry has started but is not finalized.
- Recorded: Attendance is saved for the class period.
- Corrected: A previously recorded attendance item has been adjusted.
- Locked: Attendance is final for reporting or publication.
- Archived: Attendance is retained for history.

### Valid Transitions
- Draft -> Recorded
- Recorded -> Corrected
- Corrected -> Locked
- Recorded -> Locked
- Locked -> Archived

### Invalid Transitions
- Locked -> Recorded without a formal unlock workflow
- Archived -> Recorded

### Triggering Actions
- Teacher submits attendance to move from draft to recorded.
- Authorized correction updates the record.
- Reporting close locks the record.

### Audit Requirements
- Attendance recorded
- Attendance corrected
- Attendance locked
- Attendance unlocked
- Attendance archived

## Assessment

### State Diagram
Draft -> Open -> Closed -> Archived

### State Descriptions
- Draft: Assessment is being prepared.
- Open: Assessment is active for grading or entry.
- Closed: Assessment is finalized and no longer accepts ordinary edits.
- Archived: Assessment is preserved for history.

### Valid Transitions
- Draft -> Open
- Open -> Closed
- Closed -> Archived

### Invalid Transitions
- Closed -> Open
- Archived -> Open
- Draft -> Closed

### Triggering Actions
- Teacher setup moves the assessment into open state.
- Submission cutoff closes it.
- Retention or end-of-cycle processing archives it.

### Audit Requirements
- Assessment created
- Assessment updated
- Assessment opened
- Assessment closed
- Assessment archived

## AssessmentResult

### State Diagram
Draft -> Submitted -> Reviewed -> Published -> Archived

### State Descriptions
- Draft: Score entry is not final.
- Submitted: Result has been entered for review.
- Reviewed: Result has been checked and accepted or flagged.
- Published: Result is visible according to rules.
- Archived: Result is retained as historical academic data.

### Valid Transitions
- Draft -> Submitted
- Submitted -> Reviewed
- Reviewed -> Published
- Published -> Archived

### Invalid Transitions
- Published -> Submitted
- Archived -> Reviewed
- Archived -> Submitted

### Triggering Actions
- Teacher enters the score to submit it.
- Reviewer checks or approves it.
- Publication occurs after authorized review.

### Audit Requirements
- Result submitted
- Result reviewed
- Result published
- Result archived

## ReportCard

### State Diagram
Draft -> Generated -> Reviewed -> Published -> Reissued -> Archived

### State Descriptions
- Draft: Report card content is being assembled.
- Generated: Report card has been produced from source data.
- Reviewed: Authorized staff have checked the output.
- Published: Report card is visible to the intended audience.
- Reissued: A corrected or updated version has been created.
- Archived: Report card remains for history.

### Valid Transitions
- Draft -> Generated
- Generated -> Reviewed
- Reviewed -> Published
- Published -> Reissued
- Reissued -> Reviewed
- Published -> Archived
- Reissued -> Archived

### Invalid Transitions
- Published -> Draft
- Archived -> Published

### Triggering Actions
- Term close or results publication generates report cards.
- Staff review authorizes publication.
- Corrections create a reissue.

### Audit Requirements
- Report card generated
- Report card reviewed
- Report card published
- Report card reissued
- Report card archived

## User

### State Diagram
Invited -> Active -> Suspended -> Deactivated -> Archived

### State Descriptions
- Invited: Account invitation has been issued.
- Active: User can log in and access permitted features.
- Suspended: User access is temporarily disabled.
- Deactivated: User can no longer access the system and may need re-provisioning.
- Archived: User record is retained for history.

### Valid Transitions
- Invited -> Active
- Active -> Suspended
- Suspended -> Active
- Active -> Deactivated
- Suspended -> Deactivated
- Deactivated -> Archived

### Invalid Transitions
- Archived -> Active
- Deactivated -> Invited without a new invitation

### Triggering Actions
- Invitation acceptance activates the user.
- Security or admin action suspends or deactivates the user.
- Retention policy archives the record.

### Audit Requirements
- User invited
- User activated
- User suspended
- User deactivated
- User archived

## Cross-Entity State Rules
- Published records should generally not return to draft.
- Corrections should preserve a traceable prior state.
- Archiving should not erase historical auditability.
- Tenant boundary changes should be modeled as migration or re-linking events, not silent edits.

## Future Extensibility Recommendations
- Keep state names stable and obvious to non-technical users.
- If a new entity is added, define its lifecycle before implementation begins.
- Prefer one canonical lifecycle per entity family rather than per-screen state variants.
- Reuse shared state concepts such as draft, active, suspended, archived where the business meaning matches.
