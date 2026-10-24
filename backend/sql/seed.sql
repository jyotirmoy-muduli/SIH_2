
USE sih_26264;

INSERT INTO institutions
(permanent_id, institution_name, institution_type, state, district)
VALUES
('DEMO-AICTE-001', 'National Institute of Technology Demo',
 'Engineering College', 'Delhi', 'New Delhi'),
('DEMO-AICTE-002', 'Western Technical University Demo',
 'Technical University', 'Maharashtra', 'Pune'),
('DEMO-AICTE-003', 'Eastern Engineering College Demo',
 'Engineering College', 'Odisha', 'Bhubaneswar');

INSERT INTO complaint_cases
(case_number, institution_id, subject, description, bureau_name,
 complaint_type, priority, status, due_date)
SELECT
'DEMO-CASE-001', id,
'Delay in examination results',
'Students report that examination results have not been published on time.',
'PGRC', 'Student Grievance', 'HIGH', 'IN_PROGRESS', '2026-11-05'
FROM institutions WHERE permanent_id = 'DEMO-AICTE-001';

INSERT INTO complaint_cases
(case_number, institution_id, subject, description, bureau_name,
 complaint_type, priority, status, due_date)
SELECT
'DEMO-CASE-002', id,
'Examination result publication delay',
'Students are waiting for delayed examination results at the institution.',
'Regulation Bureau', 'Regulatory Complaint', 'HIGH', 'UNDER_REVIEW',
'2026-11-03'
FROM institutions WHERE permanent_id = 'DEMO-AICTE-001';

INSERT INTO complaint_cases
(case_number, institution_id, subject, description, bureau_name,
 complaint_type, priority, status, due_date)
SELECT
'DEMO-CASE-003', id,
'Faculty shortage',
'Complaint regarding insufficient faculty members in technical departments.',
'Regulation Bureau', 'Compliance', 'URGENT', 'RECEIVED', '2026-10-25'
FROM institutions WHERE permanent_id = 'DEMO-AICTE-002';

INSERT INTO complaint_cases
(case_number, institution_id, subject, description, bureau_name,
 complaint_type, priority, status, due_date)
SELECT
'DEMO-CASE-004', id,
'Student grievance portal access',
'Students report difficulty accessing the institutional grievance portal.',
'PGRC', 'Student Grievance', 'MEDIUM', 'RESOLVED', '2026-10-20'
FROM institutions WHERE permanent_id = 'DEMO-AICTE-003';

INSERT INTO case_actions
(case_id, action_type, new_status, notes)
SELECT id, 'CASE_CREATED', status, 'Synthetic demonstration case'
FROM complaint_cases
WHERE case_number IN (
  'DEMO-CASE-001',
  'DEMO-CASE-002',
  'DEMO-CASE-003',
  'DEMO-CASE-004'
);
