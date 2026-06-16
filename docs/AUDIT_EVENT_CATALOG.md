# Audit Event Catalog

## Purpose
Define the canonical set of audit events for School OS so security, support, compliance, and architecture teams have one shared record of what must be traceable.

## Scope
- Covers the major event families across authentication, authorization, tenancy, academic workflows, reporting, communication, and system administration.
- Defines naming conventions and severity guidance.
- Does not define storage format or implementation code.

## Audit Principles
- If an action can change access, ownership, visibility, publication, or tenant scope, it should usually be logged.
- High-risk actions should always be auditable.
- Audit logs should support incident investigation, support triage, and compliance review.
- Tenant-scoped events must include the affected `school_id` when applicable.
- Audit logs should be append-only and tamper-resistant.

## Event Fields
- Event Name
- Description
- Actor
- Resource
- Severity
- Must Log

## Severity Scale
- Low: Routine operational event with limited risk.
- Medium: Important operational change that may require review.
- High: Sensitive action that affects access, visibility, or business-critical records.
- Critical: Event with potential for tenant leakage, unauthorized access, or major integrity impact.

## Authentication

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| auth.login.succeeded | A user successfully authenticates. | User | Session | Low | Yes |
| auth.login.failed | A login attempt fails. | User or unknown actor | Session attempt | Medium | Yes |
| auth.logout | A user ends an active session. | User | Session | Low | Yes |
| auth.session.created | A new session is issued. | System | Session | Low | Yes |
| auth.session.refreshed | A session is extended or renewed. | System | Session | Low | Yes |
| auth.session.revoked | A session is explicitly invalidated. | User, School Admin, Super Admin | Session | Medium | Yes |
| auth.password.reset.requested | A reset request is issued. | User or admin | User account | Medium | Yes |
| auth.password.reset.completed | A password is changed through reset flow. | User or admin | User account | High | Yes |
| auth.mfa.challenge.deferred | MFA is not active because it is deferred. | System | Authentication policy | Low | No |

## Authorization

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| role.assigned | A role is granted to a user. | School Admin, Super Admin | User role assignment | High | Yes |
| role.revoked | A role is removed from a user. | School Admin, Super Admin | User role assignment | High | Yes |
| permission.denied | A protected action is blocked by authorization. | System | Protected resource | Medium | Yes |
| privilege.escalated | A user gains a more privileged role or access. | School Admin, Super Admin | User access | Critical | Yes |
| privilege.attempted | An unauthorized privilege change is attempted. | User, admin, attacker | User access | Critical | Yes |

## Tenant Management

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| school.created | A new school tenant is created. | Super Admin | School | High | Yes |
| school.updated | School metadata or policy settings are changed. | School Admin, Super Admin | School | High | Yes |
| school.suspended | Tenant access is suspended. | Super Admin | School | Critical | Yes |
| school.reactivated | Suspended tenant access is restored. | Super Admin | School | High | Yes |
| school.closed | A school is formally closed. | Super Admin, School Admin | School | High | Yes |
| school.archived | A school is moved to historical storage state. | Super Admin, School Admin | School | Medium | Yes |
| school.deleted_requested | A deletion request is made. | School Admin, Super Admin | School | High | Yes |
| school.domain.added | A domain mapping is added. | Super Admin, School Admin | SchoolDomain | High | Yes |
| school.domain.removed | A domain mapping is removed. | Super Admin, School Admin | SchoolDomain | High | Yes |
| school.theme.updated | Branding settings are changed. | School Admin | SchoolTheme | Medium | Yes |
| school.settings.updated | Operational settings are changed. | School Admin | SchoolSettings | Medium | Yes |

## Student Management

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| student.created | A student record is created. | School Admin, authorized staff | Student | High | Yes |
| student.updated | Student profile data changes. | School Admin, authorized staff | Student | High | Yes |
| student.enrolled | Student is enrolled into the school. | School Admin | Student | High | Yes |
| student.transferred | Student is moved out or between schools. | School Admin | Student | Critical | Yes |
| student.promoted | Student advances to the next academic level. | School Admin, authorized staff | Student | Medium | Yes |
| student.withdrawn | Student leaves the school. | School Admin | Student | High | Yes |
| student.archived | Student record is archived. | School Admin | Student | Medium | Yes |
| student.reactivated | Archived or inactive student becomes active again. | School Admin | Student | Medium | Yes |

## Teacher Management

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| teacher.created | A teacher profile is created. | School Admin | Teacher | High | Yes |
| teacher.updated | Teacher data is changed. | School Admin, teacher self-service for profile fields | Teacher | High | Yes |
| teacher.assigned_class | Teacher is assigned to a class. | School Admin | Teacher/Class | High | Yes |
| teacher.assigned_subject | Teacher is assigned to a subject. | School Admin | Teacher/Subject | High | Yes |
| teacher.suspended | Teacher access is suspended. | School Admin | Teacher | High | Yes |
| teacher.deactivated | Teacher access is removed. | School Admin | Teacher | High | Yes |
| teacher.archived | Teacher record is archived. | School Admin | Teacher | Medium | Yes |

## Parent Management

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| parent.created | A parent profile is created. | School Admin | Parent | High | Yes |
| parent.updated | Parent details are updated. | School Admin, parent self updates | Parent | High | Yes |
| parent.linked_student | Parent is linked to a student. | School Admin | Parent/Student link | High | Yes |
| parent.unlinked_student | Parent is removed from a student. | School Admin | Parent/Student link | High | Yes |
| parent.suspended | Parent access is suspended. | School Admin | Parent | Medium | Yes |
| parent.archived | Parent record is archived. | School Admin | Parent | Medium | Yes |

## Academic Structure

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| academic_year.created | Academic year is created. | School Admin | AcademicYear | High | Yes |
| academic_year.opened | Academic year becomes operational. | School Admin | AcademicYear | High | Yes |
| academic_year.closed | Academic year is closed for operations. | School Admin | AcademicYear | High | Yes |
| academic_year.archived | Academic year is archived. | School Admin | AcademicYear | Medium | Yes |
| term.created | Term is created. | School Admin | Term | High | Yes |
| term.opened | Term becomes active. | School Admin | Term | High | Yes |
| term.closed | Term is closed. | School Admin | Term | High | Yes |
| class.created | Class is created. | School Admin | Class | High | Yes |
| class.updated | Class details change. | School Admin, assigned staff | Class | High | Yes |
| class.teacher_assigned | Teacher assignment changes for a class. | School Admin | Class/Teacher | High | Yes |
| class.archived | Class is archived. | School Admin | Class | Medium | Yes |
| subject.created | Subject is created. | School Admin | Subject | Medium | Yes |
| subject.updated | Subject is updated. | School Admin | Subject | Medium | Yes |
| subject.archived | Subject is archived. | School Admin | Subject | Medium | Yes |

## Attendance

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| attendance.recorded | Attendance is entered for a student. | Teacher, School Admin | Attendance | High | Yes |
| attendance.updated | Attendance is corrected or edited. | Teacher, School Admin | Attendance | High | Yes |
| attendance.locked | Attendance is finalized for reporting. | Teacher, School Admin | Attendance | High | Yes |
| attendance.unlocked | Attendance is reopened for correction. | School Admin | Attendance | Critical | Yes |
| attendance.bulk_imported | Attendance is imported in bulk. | School Admin, authorized staff | Attendance | High | Yes |

## Assessments

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| assessment.created | Assessment draft is created. | Teacher, School Admin | Assessment | High | Yes |
| assessment.updated | Assessment metadata changes. | Teacher, School Admin | Assessment | High | Yes |
| assessment.scheduled | Assessment is scheduled. | Teacher, School Admin | Assessment | High | Yes |
| assessment.locked | Assessment is locked for grading. | Teacher, School Admin | Assessment | High | Yes |
| assessment.reviewed | Assessment is reviewed. | Authorized reviewer | Assessment | High | Yes |
| assessment.archived | Assessment is archived. | School Admin | Assessment | Medium | Yes |

## Results

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| result.created | A result score is entered. | Teacher, School Admin | AssessmentResult | High | Yes |
| result.updated | A result score or metadata is corrected. | Teacher, School Admin | AssessmentResult | High | Yes |
| result.reviewed | A result is checked by an authorized reviewer. | Authorized reviewer | AssessmentResult | High | Yes |
| result.rejected | A result is rejected during review. | Authorized reviewer | AssessmentResult | High | Yes |
| result.published | Result becomes visible to authorized viewers. | School Admin, system on approval | AssessmentResult | Critical | Yes |
| result.reissued | A corrected result is reissued. | School Admin, authorized staff | AssessmentResult | High | Yes |
| report_card.generated | Report card is created from results. | System, School Admin | ReportCard | High | Yes |
| report_card.reviewed | Report card is checked before release. | Authorized reviewer | ReportCard | High | Yes |
| report_card.published | Report card is made visible to learners or parents. | School Admin, system on approval | ReportCard | Critical | Yes |

## Reporting

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| report.viewed | A tenant report is opened. | School Admin, Teacher, Parent, Student, Super Admin | Report | Medium | Yes |
| report.exported | A report or data export is generated. | School Admin, Super Admin, authorized staff | Report/export | Critical | Yes |
| report.filtered | A report query is narrowed or scoped. | User | Report | Low | No |
| report.shared | A report is shared through an approved workflow. | School Admin, authorized staff | Report | High | Yes |
| analytics.aggregate_viewed | Non-identifying aggregate reporting is viewed. | Super Admin, platform operator | Aggregate metrics | Medium | Yes |

## Announcements

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| announcement.created | Announcement draft is created. | School Admin, authorized staff | Announcement | Medium | Yes |
| announcement.updated | Announcement content changes. | School Admin, authorized staff | Announcement | Medium | Yes |
| announcement.scheduled | Announcement is scheduled for later. | School Admin, authorized staff | Announcement | Medium | Yes |
| announcement.published | Announcement becomes visible to the intended audience. | School Admin, authorized staff | Announcement | High | Yes |
| announcement.unpublished | Published announcement is withdrawn. | School Admin, authorized staff | Announcement | High | Yes |
| announcement.archived | Announcement is archived. | School Admin, authorized staff | Announcement | Low | Yes |

## System Administration

| Event Name | Description | Actor | Resource | Severity | Must Log |
| --- | --- | --- | --- | --- | --- |
| system.feature_flag_changed | A feature flag changes state or audience. | Super Admin, platform operator | Feature flag | High | Yes |
| system.support_access_granted | Temporary support access is approved. | Super Admin, Security, authorized support | Support scope | Critical | Yes |
| system.support_access_revoked | Temporary support access ends. | Super Admin, Security, authorized support | Support scope | High | Yes |
| system.config_changed | Platform configuration changes. | Super Admin, platform operator | Platform config | High | Yes |
| system.integration_connected | An approved integration is enabled. | Super Admin, platform operator | Integration | High | Yes |
| system.integration_disconnected | An integration is disabled. | Super Admin, platform operator | Integration | High | Yes |
| system.backup_verified | Backup integrity or restore readiness is checked. | System, operator | Backup/restore | Medium | Yes |
| system.restore_started | A restore process begins. | Super Admin, platform operator | Backup/restore | Critical | Yes |
| system.restore_completed | A restore process completes. | Super Admin, platform operator | Backup/restore | Critical | Yes |

## Sensitive Events
The following event families are always sensitive and should be treated as at least High severity:
- Role assignment or revocation
- School creation, suspension, closure, or deletion requests
- User deactivation, suspension, password reset, or privilege changes
- Student transfer, withdrawal, or archival
- Attendance unlocking or correction after lock
- Assessment result review, publication, or reissue
- Report exports
- Support access grant or revocation
- Integration changes

## High-Risk Events
The following actions are high-risk and should trigger elevated review or alerts:
- Cross-tenant access attempts
- Support access to tenant data
- Result publication
- Report export
- School suspension or closure
- Privilege escalation
- Session revocation due to suspicious activity
- Restore operations
- Any action touching multiple tenants

## Audit Retention Requirements
- Retain audit records long enough to support investigation, support review, and compliance obligations.
- Retention must be at least as strict as the retention required for the associated business record.
- Security-critical audit records should be retained longer than routine operational logs when policy allows.
- Deletion of audit records should be exceptional and policy-driven, not application-driven.

## Compliance Considerations
- Audit logs must support traceability for identity, tenancy, academic record changes, and support actions.
- Logs should include actor, target resource, tenant context, timestamp, action, and outcome.
- Tenant leakage events should be preserved with high fidelity for incident review.
- Export and administrative actions should be fully traceable.
- If a jurisdiction requires stricter retention, that policy should supersede the baseline.

## Future Extensibility Recommendations
- Add new audit events whenever a new privileged action is introduced.
- Keep event names stable and lower-case with dot-separated namespaces.
- Prefer explicit events over generic catch-all logging.
- Treat missing audit coverage as a design defect.
