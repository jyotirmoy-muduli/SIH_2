import mongoose, { connectDatabase } from "./config/db.js";
import ComplaintCase from "./models/ComplaintCase.js";
import Institution from "./models/Institution.js";

const institutions = [
  {
    permanent_id: "DEMO-AICTE-001",
    institution_name: "National Institute of Technology Demo",
    institution_type: "Engineering College",
    state: "Delhi",
    district: "New Delhi",
  },
  {
    permanent_id: "DEMO-AICTE-002",
    institution_name: "Western Technical University Demo",
    institution_type: "Technical University",
    state: "Maharashtra",
    district: "Pune",
  },
  {
    permanent_id: "DEMO-AICTE-003",
    institution_name: "Eastern Engineering College Demo",
    institution_type: "Engineering College",
    state: "Odisha",
    district: "Bhubaneswar",
  },
  {
    permanent_id: "DEMO-AICTE-004",
    institution_name: "Central Technical Institute Demo",
    institution_type: "Engineering College",
    state: "Madhya Pradesh",
    district: "Bhopal",
  },
  {
    permanent_id: "DEMO-AICTE-005",
    institution_name: "Southern Polytechnic University Demo",
    institution_type: "Technical University",
    state: "Kerala",
    district: "Thiruvananthapuram",
  },
  {
    permanent_id: "DEMO-AICTE-006",
    institution_name: "Northern School of Engineering Demo",
    institution_type: "Engineering College",
    state: "Uttar Pradesh",
    district: "Lucknow",
  },
  {
    permanent_id: "SAMPLE-VIT-VELLORE",
    institution_name: "Vellore Institute of Technology",
    institution_type: "Sample (not official) - Engineering",
    state: "Tamil Nadu",
    district: "Vellore",
  },
  {
    permanent_id: "SAMPLE-SRM-KTR",
    institution_name: "SRM Institute of Science and Technology",
    institution_type: "Sample (not official) - Engineering",
    state: "Tamil Nadu",
    district: "Chengalpattu",
  },
  {
    permanent_id: "SAMPLE-KIIT-BBSR",
    institution_name: "Kalinga Institute of Industrial Technology",
    institution_type: "Sample (not official) - Engineering",
    state: "Odisha",
    district: "Khordha",
  },
  {
    permanent_id: "SAMPLE-AMRITA-COIMBATORE",
    institution_name: "Amrita Vishwa Vidyapeetham",
    institution_type: "Sample (not official) - Engineering",
    state: "Tamil Nadu",
    district: "Coimbatore",
  },
  {
    permanent_id: "SAMPLE-MIT-MANIPAL",
    institution_name: "Manipal Institute of Technology",
    institution_type: "Sample (not official) - Engineering",
    state: "Karnataka",
    district: "Udupi",
  },
  {
    permanent_id: "SAMPLE-BMS-BENGALURU",
    institution_name: "B.M.S. College of Engineering",
    institution_type: "Sample (not official) - Engineering",
    state: "Karnataka",
    district: "Bengaluru Urban",
  },
  {
    permanent_id: "SAMPLE-RVCE-BENGALURU",
    institution_name: "R.V. College of Engineering",
    institution_type: "Sample (not official) - Engineering",
    state: "Karnataka",
    district: "Bengaluru Urban",
  },
  {
    permanent_id: "SAMPLE-PSG-COIMBATORE",
    institution_name: "PSG College of Technology",
    institution_type: "Sample (not official) - Engineering",
    state: "Tamil Nadu",
    district: "Coimbatore",
  },
  {
    permanent_id: "SAMPLE-THAPAR-PATIALA",
    institution_name: "Thapar Institute of Engineering and Technology",
    institution_type: "Sample (not official) - Engineering",
    state: "Punjab",
    district: "Patiala",
  },
  {
    permanent_id: "SAMPLE-KLE-DHARWAD",
    institution_name: "KLE Technological University",
    institution_type: "Sample (not official) - Engineering",
    state: "Karnataka",
    district: "Dharwad",
  },
  {
    permanent_id: "SAMPLE-NIRMA-AHMEDABAD",
    institution_name: "Nirma University",
    institution_type: "Sample (not official) - Engineering",
    state: "Gujarat",
    district: "Ahmedabad",
  },
  {
    permanent_id: "SAMPLE-SATHYABAMA-CHENNAI",
    institution_name: "Sathyabama Institute of Science and Technology",
    institution_type: "Sample (not official) - Engineering",
    state: "Tamil Nadu",
    district: "Chennai",
  },
  {
    permanent_id: "SAMPLE-LPU-PHAGWARA",
    institution_name: "Lovely Professional University",
    institution_type: "Sample (not official) - Engineering",
    state: "Punjab",
    district: "Kapurthala",
  },
  {
    permanent_id: "SAMPLE-CHANDIGARH-UNIVERSITY",
    institution_name: "Chandigarh University",
    institution_type: "Sample (not official) - Engineering",
    state: "Punjab",
    district: "SAS Nagar",
  },
  {
    permanent_id: "SAMPLE-JADAVPUR-KOLKATA",
    institution_name: "Jadavpur University",
    institution_type: "Sample (not official) - Engineering",
    state: "West Bengal",
    district: "Kolkata",
  },
  {
    permanent_id: "SAMPLE-HERITAGE-KOLKATA",
    institution_name: "Heritage Institute of Technology",
    institution_type: "Sample (not official) - Engineering",
    state: "West Bengal",
    district: "Kolkata",
  },
  {
    permanent_id: "SAMPLE-PES-BENGALURU",
    institution_name: "PES University",
    institution_type: "Sample (not official) - Engineering",
    state: "Karnataka",
    district: "Bengaluru Urban",
  },
  {
    permanent_id: "SAMPLE-ANNA-CHENNAI",
    institution_name: "Anna University",
    institution_type: "Sample (not official) - Engineering",
    state: "Tamil Nadu",
    district: "Chennai",
  },
  {
    permanent_id: "SAMPLE-VJTI-MUMBAI",
    institution_name: "Veermata Jijabai Technological Institute",
    institution_type: "Sample (not official) - Engineering",
    state: "Maharashtra",
    district: "Mumbai City",
  },
  {
    permanent_id: "SAMPLE-COEP-PUNE",
    institution_name: "COEP Technological University",
    institution_type: "Sample (not official) - Engineering",
    state: "Maharashtra",
    district: "Pune",
  },
  {
    permanent_id: "SAMPLE-TECHNO-KOLKATA",
    institution_name: "Techno India University",
    institution_type: "Sample (not official) - Engineering",
    state: "West Bengal",
    district: "Kolkata",
  },
];

const cases = [
  {
    case_number: "DEMO-CASE-001",
    permanent_id: "DEMO-AICTE-001",
    subject: "Delay in examination results",
    description:
      "Students report that examination results have not been published on time.",
    bureau_name: "PGRC",
    complaint_type: "Student Grievance",
    priority: "HIGH",
    status: "IN_PROGRESS",
    due_date: "2026-11-05",
    received_days_ago: 3,
  },
  {
    case_number: "DEMO-CASE-002",
    permanent_id: "DEMO-AICTE-001",
    subject: "Examination result publication delay",
    description:
      "Students are waiting for delayed examination results at the institution.",
    bureau_name: "Regulation Bureau",
    complaint_type: "Regulatory Complaint",
    priority: "HIGH",
    status: "UNDER_REVIEW",
    due_date: "2026-11-03",
    received_days_ago: 2,
  },
  {
    case_number: "DEMO-CASE-003",
    permanent_id: "DEMO-AICTE-002",
    subject: "Faculty shortage",
    description:
      "Complaint regarding insufficient faculty members in technical departments.",
    bureau_name: "Regulation Bureau",
    complaint_type: "Compliance",
    priority: "URGENT",
    status: "RECEIVED",
    due_date: "2026-10-25",
    received_days_ago: 10,
  },
  {
    case_number: "DEMO-CASE-004",
    permanent_id: "DEMO-AICTE-003",
    subject: "Student grievance portal access",
    description:
      "Students report difficulty accessing the institutional grievance portal.",
    bureau_name: "PGRC",
    complaint_type: "Student Grievance",
    priority: "MEDIUM",
    status: "RESOLVED",
    due_date: "2026-10-20",
    received_days_ago: 20,
    resolved_days_ago: 8,
  },
  {
    case_number: "DEMO-CASE-005",
    permanent_id: "DEMO-AICTE-004",
    subject: "Delay in publishing semester examination results",
    description:
      "Students report that final semester examination results have not been published after the examination period ended.",
    bureau_name: "Examination Bureau",
    complaint_type: "Examination Results",
    priority: "HIGH",
    status: "AWAITING_RESPONSE",
    due_date: "2026-10-29",
    received_days_ago: 4,
  },
  {
    case_number: "DEMO-CASE-006",
    permanent_id: "DEMO-AICTE-005",
    subject: "Semester examination result publication is delayed",
    description:
      "Students are waiting for final examination results that remain unpublished after the semester examinations.",
    bureau_name: "PGRC",
    complaint_type: "Examination Results",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    due_date: "2026-11-02",
    received_days_ago: 5,
  },
  {
    case_number: "DEMO-CASE-007",
    permanent_id: "DEMO-AICTE-006",
    subject: "Final examination results have not been released on time",
    description:
      "Students report delayed publication of final semester examination results after exams concluded.",
    bureau_name: "Regulation Bureau",
    complaint_type: "Examination Results",
    priority: "HIGH",
    status: "UNDER_REVIEW",
    due_date: "2026-10-30",
    received_days_ago: 6,
  },
  {
    case_number: "DEMO-CASE-008",
    permanent_id: "DEMO-AICTE-004",
    subject: "Incorrect marks in published examination result",
    description:
      "The examination result lists marks that do not match the student's verified mark sheet.",
    bureau_name: "Examination Bureau",
    complaint_type: "Examination Results",
    priority: "URGENT",
    status: "RECEIVED",
    due_date: "2026-10-26",
    received_days_ago: 12,
  },
  {
    case_number: "DEMO-CASE-009",
    permanent_id: "DEMO-AICTE-005",
    subject: "Missing faculty members in engineering department",
    description:
      "Students report that several technical department courses are running without the required faculty members.",
    bureau_name: "Regulation Bureau",
    complaint_type: "Faculty Availability",
    priority: "HIGH",
    status: "IN_PROGRESS",
    due_date: null,
    received_days_ago: 40,
  },
  {
    case_number: "DEMO-CASE-010",
    permanent_id: "DEMO-AICTE-006",
    subject: "Engineering department faculty shortage",
    description:
      "The technical department has not appointed sufficient faculty for scheduled courses.",
    bureau_name: "Regulation Bureau",
    complaint_type: "Faculty Availability",
    priority: "MEDIUM",
    status: "AWAITING_RESPONSE",
    due_date: "2026-11-12",
    received_days_ago: 45,
  },
  {
    case_number: "DEMO-CASE-011",
    permanent_id: "DEMO-AICTE-004",
    subject: "Resolved result correction with review evidence",
    description:
      "The student reports an incorrect examination result that requires mark verification and correction.",
    bureau_name: "Examination Bureau",
    complaint_type: "Examination Results",
    priority: "MEDIUM",
    status: "RESOLVED",
    due_date: "2026-10-20",
    received_days_ago: 18,
    resolved_days_ago: 2,
    resolution: {
      response:
        "The examination result was checked against the verified mark sheet and corrected.",
      completed_actions: [
        "Verified the original mark sheet",
        "Issued a corrected examination result",
      ],
      evidence: [
        {
          label: "Synthetic demonstration correction record",
          reference: "DEMO-EVIDENCE-011",
          evidence_type: "Examination",
        },
      ],
    },
    actions: [
      {
        action_type: "CASE_CREATED",
        new_status: "RECEIVED",
        notes: "Synthetic demonstration case",
      },
      {
        action_type: "STATUS_CHANGED",
        previous_status: "IN_PROGRESS",
        new_status: "RESOLVED",
        notes: "Synthetic demonstration resolution record",
      },
    ],
  },
  {
    case_number: "DEMO-CASE-012",
    permanent_id: "DEMO-AICTE-006",
    subject: "Student cannot access grievance portal",
    description:
      "The institutional grievance portal is unavailable to students attempting to submit a complaint.",
    bureau_name: "PGRC",
    complaint_type: "Student Grievance",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    due_date: "2026-11-08",
    received_days_ago: 8,
  },
];

try {
  await connectDatabase();

  const institutionIds = new Map();
  for (const institution of institutions) {
    const saved = await Institution.findOneAndUpdate(
      { permanent_id: institution.permanent_id },
      { $setOnInsert: institution },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
    institutionIds.set(institution.permanent_id, saved._id);
  }

  console.log(`Seeded ${institutions.length} institution records.`);

  for (const item of cases) {
    const now = new Date();
    const caseRecord = { ...item };
    delete caseRecord.permanent_id;
    delete caseRecord.received_days_ago;
    delete caseRecord.resolved_days_ago;
    const receivedAt = new Date(
      now.getTime() - (item.received_days_ago || 1) * 24 * 60 * 60 * 1000
    );
    const actions = item.actions || [
      {
        action_type: "CASE_CREATED",
        new_status: item.status,
        notes: "Synthetic demonstration case",
        created_at: receivedAt,
      },
    ];
    if (item.resolved_days_ago !== undefined) {
      caseRecord.resolved_at = new Date(
        now.getTime() - item.resolved_days_ago * 24 * 60 * 60 * 1000
      );
    }

    await ComplaintCase.findOneAndUpdate(
      { case_number: item.case_number },
      {
        $setOnInsert: {
          ...caseRecord,
          institution_id: institutionIds.get(item.permanent_id),
          due_date: item.due_date
            ? new Date(`${item.due_date}T00:00:00.000Z`)
            : null,
          received_at: receivedAt,
          actions,
        },
      },
      { upsert: true, runValidators: true }
    );
  }

  console.log(
    `Demo data is ready. Added or verified ${cases.length} synthetic cases; existing records were left unchanged.`
  );
} catch (error) {
  console.error("Could not seed MongoDB:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
