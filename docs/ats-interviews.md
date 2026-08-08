# ATS — Interviews, forms & textual transcripts

## Scope (Phase 04C)

This phase covers:

- `Interview` linked to an `Application`
- `InterviewInterviewer` (Employee references)
- `InterviewFormTemplate` + `InterviewFormQuestion`
- Snapshot questions on the interview (`InterviewQuestion`)
- `InterviewAnswer` evaluation
- Textual `InterviewTranscriptSegment` (editable)

Not included: microphone capture, audio storage, speech-to-text, AI, Offer/Hiring, frontend.

## Interview lifecycle

| Status | Meaning |
|--------|---------|
| `DRAFT` | Created without `scheduledAt` |
| `SCHEDULED` | Created with `scheduledAt`, or DRAFT promoted when PATCH sets `scheduledAt` |
| `IN_PROGRESS` | `POST …/start` |
| `COMPLETED` | `POST …/complete` (terminal) |
| `CANCELLED` | `POST …/cancel` (terminal) |

Transitions:

```text
DRAFT -> SCHEDULED (via PATCH scheduledAt)
DRAFT -> CANCELLED
SCHEDULED -> IN_PROGRESS
SCHEDULED -> CANCELLED
IN_PROGRESS -> COMPLETED
IN_PROGRESS -> CANCELLED
```

`status` cannot be patched arbitrarily.

Cannot create interviews for applications in terminal stages: `REJECTED`, `WITHDRAWN`, `HIRED`.

Multiple interviews per application are allowed.

## Interviewers

Stored only as `InterviewInterviewer(interviewId, employeeId)`.

- Employee must belong to the same company
- Employee must be `ACTIVE`
- Names are not denormalized onto `Interview`

## Form templates & snapshot

Templates (`InterviewFormTemplate`) are company-scoped and mutable.

When an interview is created with `templateId`, questions are **copied** into `InterviewQuestion` (snapshot). Later template edits do **not** change historical interviews.

## Answers

`PUT /ats/interviews/:id/questions/:questionId/answer`

- Permission: `ats.interview.evaluate`
- Actor must be an assigned interviewer **or** `CLIENT_ADMIN`
- Upsert on `(interviewQuestionId, answeredByUserId)`
- Payload must match question type (`TEXT`/`TEXTAREA` → `answerText`, `RATING` → `rating` 1–5, `YES_NO` → `yesNo`)
- No answers after `COMPLETED` or `CANCELLED`

Completing an interview requires at least one valid answer for every `required` question (any interviewer counts).

Completing does **not** move the Application to `OFFER`.

## Transcript (text only)

Segments store **text + kind + speakerLabel + sequence**.

No audio blobs, paths, S3 keys, MinIO, or base64.

`sequence` is allocated server-side under a row lock on the interview (`FOR UPDATE`) with unique constraint + retry.

Kinds: `QUESTION` | `ANSWER` | `NOTE` | `UNCLASSIFIED`.

Evaluate/transcribe actors: interviewer or `CLIENT_ADMIN`.

## Local audio policy

Optional `Interview.localRecordingName` is a **display name only** (e.g. `session-1.webm`).

Rejected if it looks like a filesystem path (`/`, `\`, `file:`).

Browsers cannot guarantee later access to an arbitrary local path. The server never recovers client audio.

## Application stage integration

Creating an interview does **not** move the Application.

On **start** of an interview:

- If Application is `CONTACTED` → call existing `ApplicationsService.move` to `INTERVIEW` (history + audit)
- If already `INTERVIEW` → no stage change (no duplicate history)
- Other stages → reject start

## Permissions

| Permission | Purpose |
|------------|---------|
| `ats.interview.read` | List/get interviews & templates |
| `ats.interview.manage` | Create/update/start/complete/cancel + templates |
| `ats.interview.evaluate` | Save answers |
| `ats.interview.transcribe` | Transcript CRUD |

- **CLIENT_ADMIN** / **RECRUITER**: all four
- **LEADER**: read + evaluate + transcribe
- **PERFORMANCE_MANAGER** / **COLLABORATOR**: none of these

## Multi-tenancy

`companyId` only from `TenantContext`. All related entities validated in-tenant. Cross-tenant → 404/400 consistent with the rest of the ATS API.

## Audit

Events: `INTERVIEW_*`, `INTERVIEW_ANSWER_SAVED`, `TRANSCRIPT_SEGMENT_*`, `INTERVIEW_TEMPLATE_*`.

Metadata: ids, statuses, types. **Never** full transcript text, answers, notes, or PII.
