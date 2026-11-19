# Từ điển schema bổ sung — 17/11/2026

Sinh từ catalog PostgreSQL tạm sau khi import migration thành công. Xem `20261117-platform-migration.md` để biết nghiệp vụ, quyền và cách import. CHECK/FK/UNIQUE dưới đây là định nghĩa thật của DB kiểm thử.

## application_answers

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| answer_id | uuid | Không | gen_random_uuid() |
| application_id | uuid | Không | — |
| question_id | uuid | Không | — |
| answer_text | text | Không | — |
| updated_by | uuid | Không | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `application_answers_answer_text_check`: `CHECK ((char_length(answer_text) <= 10000))`
- `application_answers_application_id_fkey`: `FOREIGN KEY (application_id) REFERENCES recruitment_applications(application_id)`
- `application_answers_application_id_question_id_key`: `UNIQUE (application_id, question_id)`
- `application_answers_pkey`: `PRIMARY KEY (answer_id)`
- `application_answers_question_id_fkey`: `FOREIGN KEY (question_id) REFERENCES recruitment_questions(question_id)`
- `application_answers_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES users(user_id)`

## application_reviews

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| review_id | uuid | Không | gen_random_uuid() |
| application_id | uuid | Không | — |
| reviewer_id | uuid | Không | — |
| stage | text | Không | — |
| score | numeric(5,2) | Có | — |
| recommendation | text | Không | 'undecided'::text |
| internal_note | text | Không | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `application_reviews_application_id_fkey`: `FOREIGN KEY (application_id) REFERENCES recruitment_applications(application_id)`
- `application_reviews_application_id_reviewer_id_stage_key`: `UNIQUE (application_id, reviewer_id, stage)`
- `application_reviews_internal_note_check`: `CHECK (((internal_note ~ '[^[:space:]]'::text) AND (char_length(internal_note) <= 10000)))`
- `application_reviews_pkey`: `PRIMARY KEY (review_id)`
- `application_reviews_recommendation_check`: `CHECK ((recommendation = ANY (ARRAY['pass'::text, 'fail'::text, 'undecided'::text])))`
- `application_reviews_reviewer_id_fkey`: `FOREIGN KEY (reviewer_id) REFERENCES users(user_id)`
- `application_reviews_score_check`: `CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)))`
- `application_reviews_stage_check`: `CHECK ((stage = ANY (ARRAY['application'::text, 'interview'::text])))`

## audit_logs

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| audit_id | uuid | Không | gen_random_uuid() |
| actor_id | uuid | Có | — |
| club_id | uuid | Có | — |
| action | text | Không | — |
| entity_type | text | Không | — |
| entity_id | uuid | Không | — |
| change_data | jsonb | Không | '{}'::jsonb |
| created_at | timestamp with time zone | Không | now() |

Ràng buộc:

- `audit_logs_action_check`: `CHECK (((char_length(action) >= 1) AND (char_length(action) <= 100)))`
- `audit_logs_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES users(user_id)`
- `audit_logs_change_data_check`: `CHECK (((jsonb_typeof(change_data) = 'object'::text) AND (pg_column_size(change_data) <= 32768)))`
- `audit_logs_club_id_fkey`: `FOREIGN KEY (club_id) REFERENCES clubs(club_id)`
- `audit_logs_entity_type_check`: `CHECK (((char_length(entity_type) >= 1) AND (char_length(entity_type) <= 100)))`
- `audit_logs_pkey`: `PRIMARY KEY (audit_id)`

## channel_members

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| channel_member_id | uuid | Không | gen_random_uuid() |
| channel_id | uuid | Không | — |
| membership_id | uuid | Không | — |
| added_by | uuid | Không | — |
| joined_at | timestamp with time zone | Không | now() |
| removed_at | timestamp with time zone | Có | — |
| removed_by | uuid | Có | — |

Ràng buộc:

- `channel_members_added_by_fkey`: `FOREIGN KEY (added_by) REFERENCES users(user_id)`
- `channel_members_channel_id_fkey`: `FOREIGN KEY (channel_id) REFERENCES club_channels(channel_id)`
- `channel_members_check`: `CHECK (((removed_at IS NULL) = (removed_by IS NULL)))`
- `channel_members_check1`: `CHECK (((removed_at IS NULL) OR (removed_at >= joined_at)))`
- `channel_members_membership_id_fkey`: `FOREIGN KEY (membership_id) REFERENCES club_memberships(membership_id)`
- `channel_members_pkey`: `PRIMARY KEY (channel_member_id)`
- `channel_members_removed_by_fkey`: `FOREIGN KEY (removed_by) REFERENCES users(user_id)`

## channel_messages

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| message_id | uuid | Không | gen_random_uuid() |
| channel_id | uuid | Không | — |
| sender_membership_id | uuid | Không | — |
| client_message_id | uuid | Không | — |
| content | text | Không | — |
| updated_by | uuid | Không | — |
| created_at | timestamp with time zone | Không | now() |
| edited_at | timestamp with time zone | Có | — |
| deleted_at | timestamp with time zone | Có | — |
| deleted_by | uuid | Có | — |

Ràng buộc:

- `channel_messages_channel_id_fkey`: `FOREIGN KEY (channel_id) REFERENCES club_channels(channel_id)`
- `channel_messages_channel_id_sender_membership_id_client_mes_key`: `UNIQUE (channel_id, sender_membership_id, client_message_id)`
- `channel_messages_check`: `CHECK (((deleted_at IS NULL) = (deleted_by IS NULL)))`
- `channel_messages_content_check`: `CHECK (((content ~ '[^[:space:]]'::text) AND (char_length(content) <= 5000)))`
- `channel_messages_deleted_by_fkey`: `FOREIGN KEY (deleted_by) REFERENCES users(user_id)`
- `channel_messages_message_id_channel_id_key`: `UNIQUE (message_id, channel_id)`
- `channel_messages_pkey`: `PRIMARY KEY (message_id)`
- `channel_messages_sender_membership_id_fkey`: `FOREIGN KEY (sender_membership_id) REFERENCES club_memberships(membership_id)`
- `channel_messages_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES users(user_id)`

## channel_read_states

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| channel_id | uuid | Không | — |
| membership_id | uuid | Không | — |
| last_read_message_id | uuid | Có | — |
| last_read_at | timestamp with time zone | Không | now() |

Ràng buộc:

- `channel_read_states_channel_id_fkey`: `FOREIGN KEY (channel_id) REFERENCES club_channels(channel_id)`
- `channel_read_states_last_read_message_id_channel_id_fkey`: `FOREIGN KEY (last_read_message_id, channel_id) REFERENCES channel_messages(message_id, channel_id)`
- `channel_read_states_membership_id_fkey`: `FOREIGN KEY (membership_id) REFERENCES club_memberships(membership_id)`
- `channel_read_states_pkey`: `PRIMARY KEY (channel_id, membership_id)`

## club_change_requests

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| change_request_id | uuid | Không | gen_random_uuid() |
| club_id | uuid | Không | — |
| requested_by | uuid | Không | — |
| proposed_data | jsonb | Không | — |
| base_club_updated_at | timestamp with time zone | Không | — |
| status | text | Không | 'pending'::text |
| reviewed_by | uuid | Có | — |
| reviewed_at | timestamp with time zone | Có | — |
| review_note | text | Có | — |
| updated_by | uuid | Không | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `club_change_requests_check`: `CHECK ((((status = ANY (ARRAY['approved'::text, 'rejected'::text])) AND (reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL)) OR ((status <> ALL (ARRAY['approved'::text, 'rejected'::text])) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL))))`
- `club_change_requests_club_id_fkey`: `FOREIGN KEY (club_id) REFERENCES clubs(club_id)`
- `club_change_requests_pkey`: `PRIMARY KEY (change_request_id)`
- `club_change_requests_proposed_data_check`: `CHECK (((jsonb_typeof(proposed_data) = 'object'::text) AND (proposed_data <> '{}'::jsonb) AND (pg_column_size(proposed_data) <= 262144)))`
- `club_change_requests_requested_by_fkey`: `FOREIGN KEY (requested_by) REFERENCES users(user_id)`
- `club_change_requests_review_note_check`: `CHECK ((char_length(review_note) <= 5000))`
- `club_change_requests_reviewed_by_fkey`: `FOREIGN KEY (reviewed_by) REFERENCES users(user_id)`
- `club_change_requests_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))`
- `club_change_requests_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES users(user_id)`

## club_channels

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| channel_id | uuid | Không | gen_random_uuid() |
| club_id | uuid | Không | — |
| department_id | uuid | Có | — |
| kind | text | Không | — |
| name | text | Không | — |
| description | text | Có | — |
| created_at | timestamp with time zone | Không | now() |

Ràng buộc:

- `club_channels_check`: `CHECK (((kind = 'department'::text) = (department_id IS NOT NULL)))`
- `club_channels_club_id_fkey`: `FOREIGN KEY (club_id) REFERENCES clubs(club_id)`
- `club_channels_department_id_fkey`: `FOREIGN KEY (department_id) REFERENCES club_departments(department_id)`
- `club_channels_description_check`: `CHECK ((char_length(description) <= 5000))`
- `club_channels_kind_check`: `CHECK ((kind = ANY (ARRAY['general'::text, 'department'::text])))`
- `club_channels_name_check`: `CHECK (((name ~ '[^[:space:]]'::text) AND (char_length(name) <= 160)))`
- `club_channels_pkey`: `PRIMARY KEY (channel_id)`

## interview_appointments

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| appointment_id | uuid | Không | gen_random_uuid() |
| application_id | uuid | Không | — |
| session_id | uuid | Không | — |
| scheduled_start_at | timestamp with time zone | Không | — |
| scheduled_end_at | timestamp with time zone | Không | — |
| status | text | Không | 'scheduled'::text |
| candidate_note | text | Có | — |
| created_by | uuid | Không | — |
| updated_by | uuid | Không | — |
| cancelled_at | timestamp with time zone | Có | — |
| cancellation_reason | text | Có | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `interview_appointments_application_id_fkey`: `FOREIGN KEY (application_id) REFERENCES recruitment_applications(application_id)`
- `interview_appointments_cancellation_reason_check`: `CHECK ((char_length(cancellation_reason) <= 2000))`
- `interview_appointments_candidate_note_check`: `CHECK ((char_length(candidate_note) <= 5000))`
- `interview_appointments_check`: `CHECK ((scheduled_end_at > scheduled_start_at))`
- `interview_appointments_check1`: `CHECK (((status = 'cancelled'::text) = (cancelled_at IS NOT NULL)))`
- `interview_appointments_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES users(user_id)`
- `interview_appointments_pkey`: `PRIMARY KEY (appointment_id)`
- `interview_appointments_session_id_fkey`: `FOREIGN KEY (session_id) REFERENCES meeting_sessions(session_id)`
- `interview_appointments_session_id_key`: `UNIQUE (session_id)`
- `interview_appointments_status_check`: `CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])))`
- `interview_appointments_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES users(user_id)`
- `v2_interview_consistency`: `TRIGGER DEFERRABLE INITIALLY DEFERRED`

## interview_panel_members

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| appointment_id | uuid | Không | — |
| membership_id | uuid | Không | — |
| assigned_by | uuid | Không | — |
| created_at | timestamp with time zone | Không | now() |

Ràng buộc:

- `interview_panel_members_appointment_id_fkey`: `FOREIGN KEY (appointment_id) REFERENCES interview_appointments(appointment_id)`
- `interview_panel_members_assigned_by_fkey`: `FOREIGN KEY (assigned_by) REFERENCES users(user_id)`
- `interview_panel_members_membership_id_fkey`: `FOREIGN KEY (membership_id) REFERENCES club_memberships(membership_id)`
- `interview_panel_members_pkey`: `PRIMARY KEY (appointment_id, membership_id)`

## notification_jobs

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| job_id | uuid | Không | gen_random_uuid() |
| event_type | text | Không | — |
| entity_type | text | Không | — |
| entity_id | uuid | Không | — |
| payload | jsonb | Không | '{}'::jsonb |
| deduplication_key | text | Không | — |
| run_at | timestamp with time zone | Không | now() |
| status | text | Không | 'pending'::text |
| attempt_count | integer | Không | 0 |
| claim_token | uuid | Có | — |
| locked_until | timestamp with time zone | Có | — |
| processed_at | timestamp with time zone | Có | — |
| last_error | text | Có | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `notification_jobs_attempt_count_check`: `CHECK ((attempt_count >= 0))`
- `notification_jobs_check`: `CHECK ((((status = 'processing'::text) AND (claim_token IS NOT NULL) AND (locked_until IS NOT NULL)) OR ((status <> 'processing'::text) AND (claim_token IS NULL) AND (locked_until IS NULL))))`
- `notification_jobs_check1`: `CHECK (((status <> 'completed'::text) OR (processed_at IS NOT NULL)))`
- `notification_jobs_deduplication_key_check`: `CHECK (((char_length(deduplication_key) >= 1) AND (char_length(deduplication_key) <= 500)))`
- `notification_jobs_deduplication_key_key`: `UNIQUE (deduplication_key)`
- `notification_jobs_entity_type_check`: `CHECK ((entity_type = ANY (ARRAY['club'::text, 'campaign'::text, 'post'::text, 'activity'::text, 'registration'::text, 'application'::text, 'interview'::text, 'club_change'::text, 'channel_member'::text])))`
- `notification_jobs_event_type_check`: `CHECK ((event_type ~ '^[a-z][a-z0-9_.]{1,99}$'::text))`
- `notification_jobs_last_error_check`: `CHECK ((char_length(last_error) <= 2000))`
- `notification_jobs_payload_check`: `CHECK (((jsonb_typeof(payload) = 'object'::text) AND (pg_column_size(payload) <= 32768)))`
- `notification_jobs_pkey`: `PRIMARY KEY (job_id)`
- `notification_jobs_status_check`: `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'cancelled'::text, 'failed'::text])))`

## notifications

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| notification_id | uuid | Không | gen_random_uuid() |
| recipient_id | uuid | Không | — |
| actor_id | uuid | Có | — |
| type | text | Không | — |
| title | text | Không | — |
| body | text | Không | — |
| data | jsonb | Không | '{}'::jsonb |
| deduplication_key | text | Không | — |
| read_at | timestamp with time zone | Có | — |
| created_at | timestamp with time zone | Không | now() |

Ràng buộc:

- `notifications_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES users(user_id)`
- `notifications_body_check`: `CHECK ((char_length(body) <= 5000))`
- `notifications_check`: `CHECK (((read_at IS NULL) OR (read_at >= created_at)))`
- `notifications_data_check`: `CHECK (((jsonb_typeof(data) = 'object'::text) AND (pg_column_size(data) <= 16384)))`
- `notifications_deduplication_key_check`: `CHECK (((char_length(deduplication_key) >= 1) AND (char_length(deduplication_key) <= 500)))`
- `notifications_pkey`: `PRIMARY KEY (notification_id)`
- `notifications_recipient_id_deduplication_key_key`: `UNIQUE (recipient_id, deduplication_key)`
- `notifications_recipient_id_fkey`: `FOREIGN KEY (recipient_id) REFERENCES users(user_id)`
- `notifications_title_check`: `CHECK (((title ~ '[^[:space:]]'::text) AND (char_length(title) <= 200)))`
- `notifications_type_check`: `CHECK ((type ~ '^[a-z][a-z0-9_.]{1,99}$'::text))`

## recruitment_applications

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| application_id | uuid | Không | gen_random_uuid() |
| campaign_id | uuid | Không | — |
| recruitment_department_id | uuid | Không | — |
| applicant_id | uuid | Không | — |
| status | text | Không | 'draft'::text |
| profile_snapshot | jsonb | Có | — |
| submitted_at | timestamp with time zone | Có | — |
| withdrawn_at | timestamp with time zone | Có | — |
| decided_by | uuid | Có | — |
| decided_at | timestamp with time zone | Có | — |
| result_message | text | Có | — |
| admitted_membership_id | uuid | Có | — |
| updated_by | uuid | Không | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `recruitment_applications_admitted_membership_id_fkey`: `FOREIGN KEY (admitted_membership_id) REFERENCES club_memberships(membership_id)`
- `recruitment_applications_admitted_membership_id_key`: `UNIQUE (admitted_membership_id)`
- `recruitment_applications_applicant_id_fkey`: `FOREIGN KEY (applicant_id) REFERENCES users(user_id)`
- `recruitment_applications_campaign_id_applicant_id_key`: `UNIQUE (campaign_id, applicant_id)`
- `recruitment_applications_campaign_id_fkey`: `FOREIGN KEY (campaign_id) REFERENCES recruitment_campaigns(campaign_id)`
- `recruitment_applications_check`: `CHECK (((status = ANY (ARRAY['draft'::text, 'withdrawn'::text])) OR (submitted_at IS NOT NULL)))`
- `recruitment_applications_check1`: `CHECK ((((status = ANY (ARRAY['accepted'::text, 'rejected'::text])) AND (decided_by IS NOT NULL) AND (decided_at IS NOT NULL)) OR ((status <> ALL (ARRAY['accepted'::text, 'rejected'::text])) AND (decided_by IS NULL) AND (decided_at IS NULL))))`
- `recruitment_applications_check2`: `CHECK (((submitted_at IS NULL) = (profile_snapshot IS NULL)))`
- `recruitment_applications_check3`: `CHECK ((((status = ANY (ARRAY['accepted'::text, 'rejected'::text])) AND (result_message IS NOT NULL) AND (result_message ~ '[^[:space:]]'::text)) OR ((status <> ALL (ARRAY['accepted'::text, 'rejected'::text])) AND (result_message IS NULL))))`
- `recruitment_applications_check4`: `CHECK (((status = 'accepted'::text) = (admitted_membership_id IS NOT NULL)))`
- `recruitment_applications_check5`: `CHECK (((status = 'withdrawn'::text) = (withdrawn_at IS NOT NULL)))`
- `recruitment_applications_decided_by_fkey`: `FOREIGN KEY (decided_by) REFERENCES users(user_id)`
- `recruitment_applications_pkey`: `PRIMARY KEY (application_id)`
- `recruitment_applications_profile_snapshot_check`: `CHECK (((profile_snapshot IS NULL) OR ((jsonb_typeof(profile_snapshot) = 'object'::text) AND (pg_column_size(profile_snapshot) <= 16384))))`
- `recruitment_applications_recruitment_department_id_campaig_fkey`: `FOREIGN KEY (recruitment_department_id, campaign_id) REFERENCES recruitment_departments(recruitment_department_id, campaign_id)`
- `recruitment_applications_result_message_check`: `CHECK ((char_length(result_message) <= 5000))`
- `recruitment_applications_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'interviewing'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text])))`
- `recruitment_applications_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES users(user_id)`

## recruitment_campaigns

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| campaign_id | uuid | Không | gen_random_uuid() |
| club_id | uuid | Không | — |
| title | text | Không | — |
| description | text | Không | — |
| cover_url | text | Có | — |
| application_opens_at | timestamp with time zone | Không | — |
| application_closes_at | timestamp with time zone | Không | — |
| status | text | Không | 'draft'::text |
| created_by | uuid | Không | — |
| updated_by | uuid | Không | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `recruitment_campaigns_check`: `CHECK ((application_closes_at > application_opens_at))`
- `recruitment_campaigns_club_id_fkey`: `FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE RESTRICT`
- `recruitment_campaigns_cover_url_check`: `CHECK (((cover_url IS NULL) OR ((cover_url ~ '^https?://'::text) AND (char_length(cover_url) <= 2048))))`
- `recruitment_campaigns_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES users(user_id)`
- `recruitment_campaigns_description_check`: `CHECK (((description ~ '[^[:space:]]'::text) AND (char_length(description) <= 50000)))`
- `recruitment_campaigns_pkey`: `PRIMARY KEY (campaign_id)`
- `recruitment_campaigns_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'completed'::text, 'cancelled'::text])))`
- `recruitment_campaigns_title_check`: `CHECK (((title ~ '[^[:space:]]'::text) AND (char_length(title) <= 200)))`
- `recruitment_campaigns_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES users(user_id)`

## recruitment_departments

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| recruitment_department_id | uuid | Không | gen_random_uuid() |
| campaign_id | uuid | Không | — |
| department_id | uuid | Không | — |
| description | text | Không | — |
| requirements | text | Có | — |
| target_quantity | integer | Có | — |
| created_by | uuid | Không | — |
| updated_by | uuid | Không | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `recruitment_departments_campaign_id_department_id_key`: `UNIQUE (campaign_id, department_id)`
- `recruitment_departments_campaign_id_fkey`: `FOREIGN KEY (campaign_id) REFERENCES recruitment_campaigns(campaign_id)`
- `recruitment_departments_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES users(user_id)`
- `recruitment_departments_department_id_fkey`: `FOREIGN KEY (department_id) REFERENCES club_departments(department_id)`
- `recruitment_departments_description_check`: `CHECK (((description ~ '[^[:space:]]'::text) AND (char_length(description) <= 20000)))`
- `recruitment_departments_pkey`: `PRIMARY KEY (recruitment_department_id)`
- `recruitment_departments_recruitment_department_id_campaign__key`: `UNIQUE (recruitment_department_id, campaign_id)`
- `recruitment_departments_requirements_check`: `CHECK ((char_length(requirements) <= 20000))`
- `recruitment_departments_target_quantity_check`: `CHECK ((target_quantity > 0))`
- `recruitment_departments_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES users(user_id)`

## recruitment_questions

| Cột | Kiểu | Cho NULL | Default |
| --- | --- | --- | --- |
| question_id | uuid | Không | gen_random_uuid() |
| recruitment_department_id | uuid | Không | — |
| question_text | text | Không | — |
| help_text | text | Có | — |
| is_required | boolean | Không | true |
| max_length | integer | Không | 5000 |
| sort_order | integer | Không | — |
| created_by | uuid | Không | — |
| updated_by | uuid | Không | — |
| created_at | timestamp with time zone | Không | now() |
| updated_at | timestamp with time zone | Không | clock_timestamp() |

Ràng buộc:

- `recruitment_questions_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES users(user_id)`
- `recruitment_questions_help_text_check`: `CHECK ((char_length(help_text) <= 2000))`
- `recruitment_questions_max_length_check`: `CHECK (((max_length >= 1) AND (max_length <= 10000)))`
- `recruitment_questions_pkey`: `PRIMARY KEY (question_id)`
- `recruitment_questions_question_text_check`: `CHECK (((question_text ~ '[^[:space:]]'::text) AND (char_length(question_text) <= 2000)))`
- `recruitment_questions_recruitment_department_id_fkey`: `FOREIGN KEY (recruitment_department_id) REFERENCES recruitment_departments(recruitment_department_id)`
- `recruitment_questions_recruitment_department_id_sort_order_key`: `UNIQUE (recruitment_department_id, sort_order)`
- `recruitment_questions_sort_order_check`: `CHECK ((sort_order > 0))`
- `recruitment_questions_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES users(user_id)`

