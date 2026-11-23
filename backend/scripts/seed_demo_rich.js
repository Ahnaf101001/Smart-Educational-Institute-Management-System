// Rich demo data for the whole system, centred on guardian Mizanur Rahman (01711000301) and his children
// Tanvir Ahmed (Class 7-A, roll 001) and Tasnim Ahmed (Class 6-A, roll 003).
//
// Business flows go through the running API so the system's own rules run (notifications, receipts, result
// calculation, maker–checker approvals); bulk history (attendance, staff attendance, GPS) is written with SQL.
// Idempotent: every section checks for its own data first, so the script can be run again safely.
//
// Usage (API must be running):  npm run db:seed:demo      (or: node scripts/seed_demo_rich.js)
// Demo logins created: principal@example.com / Principal@2026, kamrul.hasan@example.com / Teacher@2026
require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") });
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const env = require("../src/config/env");
const { pool, query } = require("../src/db/pool");
const { localDate } = require("../src/utils/dates");

const BASE = process.env.SEED_API_URL || "http://127.0.0.1:4001/api/v1";
const TZ = "+06:00";
const TODAY = localDate(); // institution time zone (Asia/Dhaka)
const YEAR = "YEAR-001";
const log = (...a) => console.log(...a);

async function api(method, url, body, token) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${json.message || text}`.slice(0, 400));
  return json.data;
}
const login = async (identifier, password) => (await api("POST", "/auth/login", { identifier, password })).token;
const one = async (sql, params) => (await query(sql, params)).rows[0];
const exists = async (sql, params) => (await query(sql, params)).rowCount > 0;

// Deterministic pseudo-random numbers (same data on every run).
function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const weekday = (s) => new Date(`${s}T00:00:00Z`).getUTCDay(); // 0 Sunday … 6 Saturday
const HOLIDAYS = new Set(["2026-10-19", "2026-10-20", "2026-10-21", "2026-08-05", "2026-08-15"]); // Durga Puja, others
const isSchoolDay = (s) => ![5, 6].includes(weekday(s)) && !HOLIDAYS.has(s); // Friday & Saturday weekend
function schoolDays(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) if (isSchoolDay(d)) out.push(d); return out; }

const TANVIR = "STU-4003", TASNIM = "STU-4008", MIZANUR = "GDN-00005";
const C6 = "CLS-006", C7 = "CLS-007";
const SUB = { ban1: "SUB-001", ban2: "SUB-002", eng1: "SUB-003", eng2: "SUB-004", math: "SUB-005", sci: "SUB-006", bgs: "SUB-007", isl: "SUB-008", ict: "SUB-010", agri: "SUB-021" };
const CORE = ["ban1", "eng1", "math", "sci", "bgs", "isl", "ict", "agri"]; // one teacher per subject (no routine clashes)

async function main() {
  const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const students = (await query("SELECT id, name, class_id, class_name, section, roll FROM students WHERE status = 'Active' ORDER BY id")).rows;
  const inClass = (cid) => students.filter((s) => s.class_id === cid);

  // ------------------------------------------------------------------ 1. Teachers, class teachers, logins
  const TEACHERS = [
    ["Md. Kamrul Hasan", "Mathematics", "Senior Teacher", "math", "01711-402311", "Male"],
    ["Shahana Parvin", "Bangla", "Assistant Teacher", "ban1", "01712-518840", "Female"],
    ["Rezaul Karim", "English", "Senior Teacher", "eng1", "01713-224567", "Male"],
    ["Farhana Yasmin", "Science", "Assistant Teacher", "sci", "01714-663201", "Female"],
    ["Nasrin Sultana", "Social Science", "Assistant Teacher", "bgs", "01715-930412", "Female"],
    ["Maulana Abdul Mannan", "Religion", "Assistant Teacher", "isl", "01716-118790", "Male"],
    ["Sumon Chandra Das", "ICT", "Assistant Teacher", "ict", "01717-445210", "Male"],
    ["Jahanara Begum", "Agriculture", "Assistant Teacher", "agri", "01718-602398", "Female"],
  ];
  const teacherBySubject = {};
  for (const [name, dept, desig, subj, phone, gender] of TEACHERS) {
    const email = `${name.replace(/^(Md\.|Maulana)\s+/, "").toLowerCase().replace(/[^a-z]+/g, ".").replace(/\.$/, "")}@example.com`;
    let t = await one("SELECT id FROM teachers WHERE email = $1", [email]);
    if (!t) {
      const [first, ...rest] = name.split(" ");
      t = await api("POST", "/teachers", {
        firstName: first, lastName: rest.join(" "), name, department: dept, designation: desig, qualification: "B.Ed, M.A.",
        phone, email, joinDate: "2019-01-10", experience: 7, subjects: [dept], salary: 32000, status: "Active", gender,
        employeeType: "Permanent", address: "Dhaka",
      }, admin);
    }
    teacherBySubject[subj] = t.id;
  }
  // Class teachers: Class 7 Md. Kamrul Hasan, Class 6 Shahana Parvin; every other class gets one of the
  // remaining six teachers (so the two demo class teachers have exactly one class each).
  const allClasses = (await query("SELECT id FROM classes ORDER BY sort_order")).rows.map((r) => r.id);
  const others = Object.entries(teacherBySubject).filter(([s]) => !["math", "ban1"].includes(s)).map(([, id]) => id);
  let k = 0;
  for (const cid of allClasses) {
    const tid = cid === C7 ? teacherBySubject.math : cid === C6 ? teacherBySubject.ban1 : others[k++ % others.length];
    await api("PATCH", `/classes/${cid}`, { teacherId: tid }, admin);
  }
  // Subject–teacher assignments for 6-A and 7-A (drives "My classes", marks scope and teacher shortcuts).
  for (const cid of [C6, C7]) {
    for (const subj of CORE) {
      if (await exists("SELECT 1 FROM class_assignments WHERE class_id = $1 AND section = 'A' AND subject_id = $2", [cid, SUB[subj]])) continue;
      await api("POST", "/assignments", { classId: cid, section: "A", subjectId: SUB[subj], teacherId: teacherBySubject[subj], roomNo: cid === C7 ? "207" : "106" }, admin);
    }
  }
  const ensureUser = async (email, body) => {
    if (await exists("SELECT 1 FROM users WHERE lower(email) = lower($1)", [email])) return;
    await api("POST", "/users", { email, status: "Active", ...body }, admin);
  };
  await ensureUser("principal@example.com", { name: "Prof. Mahmudul Haque", role: "Principal", roles: ["Principal"], phone: "01711-900100", passwordHash: "Principal@2026" });
  await ensureUser("kamrul.hasan@example.com", { name: "Md. Kamrul Hasan", role: "Teacher", roles: ["Teacher", "Class Teacher"], phone: "01711-402311", linkedType: "Teacher", linkedId: teacherBySubject.math, passwordHash: "Teacher@2026" });
  await query("UPDATE users SET must_change_password = false WHERE lower(email) IN ('principal@example.com','kamrul.hasan@example.com')");
  log(`teachers: ${Object.keys(teacherBySubject).length}, class teachers set, principal + teacher logins ready`);

  // ------------------------------------------------------------------ 2. Weekly routine (Sun–Thu) for Class 6-A and 7-A
  const SLOTS = [["P1", "08:00", "08:45"], ["P2", "08:45", "09:30"], ["P3", "09:30", "10:15"], ["BRK", "10:15", "10:35"], ["P4", "10:35", "11:20"], ["P5", "11:20", "12:05"], ["P6", "12:05", "12:50"]];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  await query("UPDATE routine_entries SET room_no = regexp_replace(room_no, '^Room\\s+', '') WHERE room_no ~ '^Room\\s'");
  for (const [cid, offset, room] of [[C7, 0, "207"], [C6, 3, "106"]]) {
    if (await exists("SELECT 1 FROM routine_entries WHERE class_id = $1 AND section = 'A'", [cid])) continue;
    for (const [d, day] of DAYS.entries()) {
      let p = 0;
      for (const [code, start, end] of SLOTS) {
        if (code === "BRK") {
          await api("POST", "/routine", { classId: cid, section: "A", dayOfWeek: day, periodCode: code, startTime: start, endTime: end, isBreak: true, label: "Tiffin Break" }, admin);
          continue;
        }
        const subj = CORE[(d * 6 + p + offset) % CORE.length];
        p += 1;
        await api("POST", "/routine", { classId: cid, section: "A", dayOfWeek: day, periodCode: code, startTime: start, endTime: end, subjectId: SUB[subj], teacherId: teacherBySubject[subj], roomNo: room }, admin);
      }
    }
  }
  log("routine: Class 6-A and 7-A, Sunday–Thursday, 6 periods + tiffin break");

  // ------------------------------------------------------------------ 3. Attendance history (Jun → today) for all students
  const days = schoolDays("2026-06-01", TODAY);
  const SPECIAL = { // [student, date] -> status
    [`${TANVIR}|2026-11-05`]: "Late", [`${TANVIR}|2026-11-12`]: "Absent", [`${TANVIR}|2026-11-16`]: "Early Leave", [`${TANVIR}|2026-11-18`]: "Late",
    [`${TASNIM}|2026-11-03`]: "Leave", [`${TASNIM}|2026-11-04`]: "Leave", [`${TASNIM}|2026-11-10`]: "Late",
  };
  const markerId = (await one("SELECT id FROM users WHERE lower(email) = 'kamrul.hasan@example.com'"))?.id
    || (await one("SELECT id FROM users WHERE lower(email) = lower($1)", [process.env.ADMIN_EMAIL])).id;
  let att = 0;
  for (const s of students) {
    const r = rng(`att-${s.id}`);
    const good = [TANVIR, TASNIM].includes(s.id);
    for (const d of days) {
      let status = SPECIAL[`${s.id}|${d}`];
      if (!status) {
        const x = r();
        status = good ? (d >= "2026-11-01" ? "Present" : x < 0.03 ? "Absent" : x < 0.07 ? "Late" : "Present")
          : x < 0.06 ? "Absent" : x < 0.12 ? "Late" : x < 0.14 ? "Early Leave" : "Present";
      }
      const mins = Math.floor(r() * 12);
      const inT = status === "Absent" || status === "Leave" ? null : status === "Late" ? `${d} 08:${String(10 + mins).padStart(2, "0")}:00${TZ}` : `${d} 07:${String(45 + mins).padStart(2, "0")}:00${TZ}`;
      const outT = !inT ? null : status === "Early Leave" ? `${d} 11:${String(20 + mins).padStart(2, "0")}:00${TZ}` : d === TODAY ? null : `${d} 13:${String(30 + mins).padStart(2, "0")}:00${TZ}`;
      const note = status === "Leave" ? "Sick leave (approved)" : status === "Early Leave" ? "Picked up early by guardian – doctor's appointment" : null;
      const res = await query(
        `INSERT INTO attendance (student_id, class_name, section, attendance_date, status, note, source, in_time, out_time, marked_by, locked)
         SELECT $1, $2, $3, $4, $5, $6, CASE WHEN $7::timestamptz IS NULL THEN 'Manual' ELSE 'Device' END, $7, $8, $10, $4 < $9::date
         WHERE NOT EXISTS (SELECT 1 FROM attendance WHERE student_id = $1 AND attendance_date = $4)`,
        [s.id, s.class_name, s.section, d, status, note, inT, outT, TODAY, markerId],
      );
      att += res.rowCount;
    }
  }
  log(`attendance: ${att} new records (${days.length} school days × ${students.length} students)`);

  // Staff attendance (teachers) for November.
  let satt = 0;
  for (const tid of Object.values(teacherBySubject)) {
    const t = await one("SELECT name FROM teachers WHERE id = $1", [tid]);
    const r = rng(`satt-${tid}`);
    for (const d of schoolDays("2026-11-01", TODAY)) {
      const late = r() < 0.08;
      const res = await query(
        `INSERT INTO staff_attendance (employee_type, employee_id, employee_name, attendance_date, status, in_time, out_time, source)
         SELECT 'Teacher', $1, $2, $3, $4, $5, $6, 'Device' WHERE NOT EXISTS (SELECT 1 FROM staff_attendance WHERE employee_id = $1 AND attendance_date = $3)`,
        [tid, t.name, d, late ? "Late" : "Present", `${d} ${late ? "08:05" : "07:3" + Math.floor(r() * 9)}:00${TZ}`, d === TODAY ? null : `${d} 14:1${Math.floor(r() * 9)}:00${TZ}`],
      );
      satt += res.rowCount;
    }
  }
  log(`staff attendance: ${satt} new records`);

  // ------------------------------------------------------------------ 4. Academic calendar
  const EVENTS = [
    ["Durga Puja Holidays", "Holiday", "2026-10-19", "2026-10-21", "School closed for Durga Puja."],
    ["Parent–Teacher Meeting (Half-Yearly results)", "Meeting", "2026-11-27", null, "Meet class and subject teachers to discuss half-yearly results."],
    ["Annual Sports Day 2026", "Event", "2026-12-03", null, "Track events, march-past and prize giving on the school field from 9:00 AM."],
    ["Annual Examination 2026", "Exam", "2026-12-06", "2026-12-15", "Annual examination for Classes 1–10."],
    ["Victory Day", "Holiday", "2026-12-16", null, "National holiday – school closed. Cultural programme on 15 December."],
    ["Winter Vacation", "Holiday", "2026-12-20", "2026-12-31", "Winter vacation. New session classes start on 1 January 2027."],
    ["Admission Test for Session 2027", "Admission", "2026-12-18", null, "Admission test for new students (Classes 1–9)."],
  ];
  for (const [title, type, start, end, description] of EVENTS) {
    if (await exists("SELECT 1 FROM academic_events WHERE title = $1", [title])) continue;
    await api("POST", "/academic-events", { title, type, startDate: start, endDate: end, description, audience: "All", isPublic: true }, admin);
  }
  log(`academic calendar: ${EVENTS.length} events`);

  // ------------------------------------------------------------------ 5. Homework, assignments, class tests (+ submissions)
  const HW = {
    [C7]: [
      ["math", "Homework", "Exercise 5.2 – Algebraic expressions", "Solve questions 1–12 of Exercise 5.2 in your homework copy. Show every step.", -2, 3, null],
      ["eng1", "Homework", "Paragraph writing: A Rainy Day", "Write a paragraph of about 150 words on 'A Rainy Day'. Use at least five new words from Unit 6.", -1, 2, null],
      ["sci", "Class Test", "Class Test – Chapter 4: The Cell", "Short class test on Chapter 4 (cell structure, plant vs animal cell). 20 marks, 30 minutes.", -3, 4, null],
      ["bgs", "Assignment", "Map work: Major rivers of Bangladesh", "Draw a map of Bangladesh and mark the Padma, Meghna, Jamuna, Brahmaputra and Teesta.", -12, -5, "Not Submitted"],
      ["ban1", "Assignment", "Essay: My Favourite Teacher (আমার প্রিয় শিক্ষক)", "Write an essay of 300 words in Bangla.", -16, -9, "Reviewed"],
      ["ict", "Project", "Project: Parts of a computer", "Make a chart of input, output and storage devices with pictures.", -20, -11, "Reviewed"],
    ],
    [C6]: [
      ["math", "Homework", "Exercise 3.1 – Fractions and decimals", "Solve questions 1–10. Write fractions in their simplest form.", -1, 3, null],
      ["ban1", "Homework", "Poem memorisation: Kazi Nazrul Islam", "Learn the first two stanzas of 'Lichu Chor' by heart for recitation.", -2, 2, null],
      ["sci", "Class Test", "Class Test – Chapter 3: Plants", "Class test on parts of a plant and photosynthesis. 20 marks.", -2, 5, null],
      ["eng1", "Assignment", "Letter to a friend about your village", "Write an informal letter (120–150 words).", -14, -7, "Reviewed"],
      ["agri", "Project", "Seed germination observation", "Germinate bean seeds and record growth for 7 days with drawings.", -18, -6, "Late"],
    ],
  };
  let hwCount = 0;
  for (const [cid, items] of Object.entries(HW)) {
    const cname = cid === C7 ? "Class 7" : "Class 6";
    for (const [subj, kind, title, description, assignedOff, dueOff, mizanurStatus] of items) {
      let hw = await one("SELECT id, total_marks FROM homework WHERE title = $1 AND class_id = $2", [title, cid]);
      if (!hw) {
        hw = await api("POST", "/homework", {
          kind, classId: cid, className: cname, section: "A", subjectId: SUB[subj], teacherId: teacherBySubject[subj], title, description,
          assignedDate: addDays(TODAY, assignedOff), dueDate: addDays(TODAY, dueOff), totalMarks: kind === "Class Test" ? 20 : 10, status: "Published",
        }, admin);
        hwCount += 1;
      }
      if (!mizanurStatus) continue;
      // Past items: everyone in the class has a submission record; the Ahmed child follows mizanurStatus.
      for (const s of inClass(cid)) {
        if (await exists("SELECT 1 FROM homework_submissions WHERE homework_id::text = $1 AND student_id = $2", [String(hw.id), s.id])) continue;
        const mine = [TANVIR, TASNIM].includes(s.id);
        const r = rng(`hw-${hw.id}-${s.id}`)();
        const status = mine ? (mizanurStatus === "Reviewed" ? "Submitted" : mizanurStatus) : r < 0.15 ? "Not Submitted" : "Submitted";
        const marks = status === "Not Submitted" ? null : mine && mizanurStatus === "Reviewed" ? 9 : Math.round(5 + r * 5);
        const remarks = status === "Not Submitted" ? "Not submitted – please complete it." : mine && mizanurStatus === "Reviewed"
          ? (cid === C7 ? "Very well written – good use of examples. Keep it up!" : "Neat handwriting and correct format. Well done.") : status === "Late" ? "Submitted two days late." : "Good effort.";
        await api("POST", "/homework-submissions", {
          homeworkId: String(hw.id), studentId: s.id, status, marks, remarks,
          submittedAt: status === "Not Submitted" ? null : `${addDays(TODAY, dueOff + (status === "Late" ? 2 : -1))}T09:00:00${TZ}`, markedBy: teacherBySubject[subj],
        }, admin);
      }
    }
  }
  log(`homework: ${hwCount} new items (homework, assignments, projects, class tests) with submissions and teacher remarks`);

  // ------------------------------------------------------------------ 6. Exams, marks, published results, upcoming routine
  const principal = await login("principal@example.com", "Principal@2026");
  const subjectsFor = [SUB.ban1, SUB.ban2, SUB.eng1, SUB.eng2, SUB.math, SUB.sci, SUB.bgs, SUB.isl, SUB.ict, SUB.agri];
  const STRENGTH = { [TANVIR]: [80, 96], [TASNIM]: [72, 92] };
  const PAST = [
    { name: "Half-Yearly Examination 2026", type: "Half-Yearly", start: "2026-06-21", end: "2026-07-02", full: 100, pass: 33, seed: "hy" },
    { name: "Monthly Test – October 2026", type: "Monthly", start: "2026-10-25", end: "2026-10-29", full: 50, pass: 17, seed: "mt" },
  ];
  for (const ex of PAST) {
    let exam = await one("SELECT id, result_status FROM exams WHERE name = $1", [ex.name]);
    if (!exam) {
      exam = await api("POST", "/exams", {
        name: ex.name, academicYearId: YEAR, startDate: ex.start, endDate: ex.end, status: "Completed", examType: ex.type,
        classIds: [C6, C7], marksEntryStart: ex.start, marksEntryEnd: "2026-12-31",
      }, admin);
    }
    if (exam.result_status === "Published" || (await one("SELECT result_status FROM exams WHERE id = $1", [exam.id])).result_status === "Published") continue;
    for (const cid of [C6, C7]) {
      for (const [i, sid] of subjectsFor.entries()) {
        await query(
          `INSERT INTO exam_schedules (exam_id, class_id, subject_id, exam_date, start_time, end_time, full_marks, pass_marks, room)
           SELECT $1, $2, $3, $4, '10:00', '13:00', $5, $6, $7 WHERE NOT EXISTS (SELECT 1 FROM exam_schedules WHERE exam_id = $1 AND class_id = $2 AND subject_id = $3)`,
          [exam.id, cid, sid, schoolDays(ex.start, ex.end)[i % schoolDays(ex.start, ex.end).length], ex.full, ex.pass, cid === C7 ? "Room 207" : "Room 106"],
        );
        const records = inClass(cid).map((s) => {
          const r = rng(`${ex.seed}-${s.id}-${sid}`)();
          const [lo, hi] = STRENGTH[s.id] || [40, 90];
          let pct = lo + r * (hi - lo);
          if (s.id === "STU-4001" && sid === SUB.math && ex.seed === "hy") pct = 28; // one realistic fail
          return { studentId: s.id, marksObtained: Math.round((pct / 100) * ex.full) };
        });
        await api("PUT", "/marks/entry", { examId: exam.id, classId: cid, subjectId: sid, records, submit: true }, admin);
      }
    }
    await api("POST", `/exams/${exam.id}/process`, {}, admin);
    await api("POST", `/exams/${exam.id}/review`, { note: "Checked by exam controller" }, admin);
    const approval = await api("POST", `/exams/${exam.id}/request-publish`, {}, admin);
    await api("POST", `/approvals/${approval.id}/decide`, { decision: "Approved", note: "Approved for publication" }, principal);
    await query("UPDATE results SET teacher_comment = $2 WHERE exam_id = $1 AND student_id = $3", [exam.id, "Excellent in Mathematics and Science. Keep practising English writing.", TANVIR]);
    await query("UPDATE results SET teacher_comment = $2 WHERE exam_id = $1 AND student_id = $3", [exam.id, "Steady progress. Very good in Bangla; needs more practice in Mathematics.", TASNIM]);
  }
  // Upcoming annual exam with a published routine (sends one "routine published" alert per class).
  let annual = await one("SELECT id FROM exams WHERE name = 'Annual Examination 2026'");
  if (!annual) {
    annual = await api("POST", "/exams", {
      name: "Annual Examination 2026", academicYearId: YEAR, startDate: "2026-12-06", endDate: "2026-12-15", status: "Scheduled",
      examType: "Annual", classIds: [C6, C7], marksEntryStart: "2026-12-06", marksEntryEnd: "2026-12-24",
    }, admin);
    const examDays = schoolDays("2026-12-06", "2026-12-15");
    for (const cid of [C6, C7]) {
      for (const [i, sid] of subjectsFor.slice(0, examDays.length).entries()) {
        await api("POST", "/exam-schedules", {
          examId: annual.id, classId: cid, subjectId: sid, examDate: examDays[i], startTime: "10:00", endTime: "13:00",
          fullMarks: 100, passMarks: 33, room: cid === C7 ? "Hall A" : "Hall B",
        }, admin);
      }
    }
  }
  log("exams: Half-Yearly + Monthly results published (principal approval), Annual 2026 routine scheduled");

  // ------------------------------------------------------------------ 7. Fees, discounts, payments, receipts
  const FEES = { [C6]: 1500, [C7]: 1600 };
  const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
  const due = (m) => `${m}-10`;
  const inv = async (sid, head, month, amount, notes) => {
    const ex = await one("SELECT id, status FROM fee_invoices WHERE student_id = $1 AND fee_head = $2 AND billing_month = $3::date", [sid, head, `${month}-01`]);
    if (ex) return ex;
    return api("POST", "/fee-invoices", { studentId: sid, feeHead: head, billingMonth: `${month}-01`, dueDate: due(month), amount, status: "Due", notes, guardianId: sid === TANVIR || sid === TASNIM ? MIZANUR : null }, admin);
  };
  const plan = []; // [student, invoice, paid?, method, paidOn]
  for (const s of students) {
    const fee = FEES[s.class_id] || 1700;
    const r = rng(`fee-${s.id}`);
    for (const m of MONTHS) {
      const i = await inv(s.id, "Tuition Fee", m, fee, `Monthly tuition – ${m}`);
      const paid = s.id === TANVIR ? m <= "2026-09" : s.id === TASNIM ? m <= "2026-10" : m <= "2026-09" || (m === "2026-10" && r() < 0.6);
      plan.push([s, i, paid, m === "2026-08" ? "bKash" : "Cash", `${m}-0${3 + Math.floor(r() * 6)}`]);
    }
    plan.push([s, await inv(s.id, "Exam Fee", "2026-06", 500, "Half-Yearly Examination fee"), true, "Cash", "2026-06-15"]);
    plan.push([s, await inv(s.id, "Exam Fee", "2026-11", 600, "Annual Examination fee"), false]);
    plan.push([s, await inv(s.id, "Library Fee", "2026-07", 300, "Annual library fee"), true, "Cash", "2026-07-08"]);
  }
  for (const sid of [TANVIR, TASNIM]) {
    const s = students.find((x) => x.id === sid);
    for (const m of ["2026-09", "2026-10", "2026-11"]) plan.push([s, await inv(sid, "Transport Fee", m, 1000, `School bus (Route 3) – ${m}`), m === "2026-09", "bKash", "2026-09-06"]);
  }
  let collected = 0;
  for (const [s, invoice, paid, method, paidOn] of plan) {
    if (!paid) continue;
    const cur = await one("SELECT status, amount FROM fee_invoices WHERE id = $1", [invoice.id]);
    if (cur.status === "Paid") continue;
    const ref = method === "Cash" ? null : `${method.toUpperCase()}${crypto.randomInt(10000000, 99999999)}`;
    await api("POST", "/fees/collect", { studentId: s.id, invoiceIds: [invoice.id], amount: Number(cur.amount), paymentMethod: method, referenceNo: ref, notes: "Demo collection" }, admin);
    await query("UPDATE fee_payments SET paid_at = $2::date + time '10:30' AT TIME ZONE 'Asia/Dhaka', created_at = $2::date + time '10:30' AT TIME ZONE 'Asia/Dhaka' WHERE invoice_id = $1", [invoice.id, paidOn]);
    collected += 1;
  }
  await query("UPDATE fee_invoices SET status = 'Overdue' WHERE status = 'Due' AND due_date < $1::date", [TODAY]);
  if (!(await exists("SELECT 1 FROM fee_discounts WHERE student_id = $1", [TASNIM]))) {
    await api("POST", "/fee-discounts", { studentId: TASNIM, feeHeadId: "FH-003", discountType: "Sibling", mode: "Percent", value: 10, reason: "Sibling discount (2nd child of Mizanur Rahman)", validFrom: "2026-01-01", validTo: "2026-12-31" }, admin);
  }
  await api("PATCH", "/system-settings", { paymentGateways: { cash: true, bkash: true, nagad: true, rocket: false, sslcommerz: false } }, admin);
  log(`fees: ${plan.length} invoices, ${collected} payments collected with receipts; sibling discount; bKash + Nagad enabled (sandbox)`);

  // ------------------------------------------------------------------ 8. Transport + live GPS position
  let vehicle = await one("SELECT id FROM transport_vehicles WHERE registration_no = 'DHAKA METRO-JA 11-2345'");
  if (!vehicle) vehicle = await api("POST", "/vehicles", { registrationNo: "DHAKA METRO-JA 11-2345", vehicleType: "Bus", capacity: 40, driverName: "Md. Shahidul Islam", driverPhone: "01712-345678", helperName: "Rafiq Mia", gpsDeviceId: "GPS-BUS-03", status: "Active" }, admin);
  let route = await one("SELECT id FROM transport_routes WHERE name = 'Route 3 – Rampura ↔ School'");
  if (!route) {
    route = await api("POST", "/transport-routes", {
      name: "Route 3 – Rampura ↔ School", vehicleId: vehicle.id, monthlyFare: 1000, morningDeparture: "06:50", eveningDeparture: "13:45", status: "Active",
      stops: [
        { name: "Banasree Block C", time: "06:50", lat: 23.7640, lng: 90.4350 },
        { name: "Rampura Bridge", time: "07:00", lat: 23.7610, lng: 90.4210 },
        { name: "Malibagh Rail Gate", time: "07:15", lat: 23.7480, lng: 90.4120 },
        { name: "School Gate", time: "07:35", lat: 23.7509, lng: 90.3935 },
      ],
    }, admin);
  }
  for (const [sid, pickup, drop] of [[TANVIR, "Rampura Bridge", "Banasree Block C"], [TASNIM, "Rampura Bridge", "Banasree Block C"], ["STU-4004", "Malibagh Rail Gate", "Malibagh Rail Gate"]]) {
    if (await exists("SELECT 1 FROM transport_assignments WHERE student_id = $1", [sid])) continue;
    await api("POST", "/transport-assignments", { studentId: sid, routeId: route.id, stopName: pickup, dropoffStop: drop, monthlyFee: 1000, startDate: "2026-09-01", status: "Active" }, admin);
  }
  await query("INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, speed, heading, recorded_at) VALUES ($1, 23.7552, 90.4168, 22, 210, NOW())", [vehicle.id]);
  log("transport: bus, Route 3 with 4 stops, 3 students assigned, live GPS position");

  // ------------------------------------------------------------------ 9. Notices (incl. one urgent)
  const NOTICES = [
    ["Annual Sports Day 2026", "The Annual Sports Day will be held on 3 December 2026 on the school field from 9:00 AM. Students must wear house T-shirts. Guardians are cordially invited.", "Normal", "Event", null],
    ["Annual Examination 2026 – routine published", "The routine for the Annual Examination (6–15 December) is now available in the app under Exam & Results → Schedule. Exams start at 10:00 AM.", "High", "Exam", null],
    ["Parent–Teacher Meeting on 27 November", "Guardians of Class 6 and Class 7 are requested to attend the parent–teacher meeting on Friday, 27 November, 10:00 AM – 1:00 PM, to discuss half-yearly results.", "Normal", "Meeting", null],
    ["Emergency: Early dismissal on 25 November", "Due to road repair work near the school gate, classes will end at 11:00 AM on Wednesday, 25 November. School buses will leave at 11:15 AM. Please arrange early pick-up.", "Urgent", "Emergency", null],
    ["Winter vacation 20–31 December", "The school will remain closed for winter vacation from 20 to 31 December 2026. Classes for session 2027 begin on 1 January 2027.", "Normal", "Holiday", null],
  ];
  for (const [title, message, priority, category, targetClass] of NOTICES) {
    if (await exists("SELECT 1 FROM notices WHERE title = $1", [title])) continue;
    await api("POST", "/notices", { title, message, channel: "Portal", audience: "All guardians and students", status: "Published", priority, category, targetClass, showOnBoard: true, language: "en" }, admin);
  }
  log(`notices: ${NOTICES.length} (one urgent)`);

  // ------------------------------------------------------------------ 10. Teacher message, leave, complaint, PTM, documents, certificates, library
  const teacherTok = await login("kamrul.hasan@example.com", "Teacher@2026");
  if (!(await exists("SELECT 1 FROM messages WHERE recipient_id = $1 AND sender_id = $2", [MIZANUR, teacherBySubject.math]))) {
    await api("POST", "/conversations", { recipientType: "Guardian", recipientId: MIZANUR, studentId: TANVIR, body: "Assalamu alaikum. Tanvir did very well in the half-yearly Mathematics exam. Please make sure he completes Exercise 5.2 before Wednesday. – Kamrul Hasan, Class Teacher 7-A" }, teacherTok);
  }
  const ensureLeave = async (sid, typeId, from, to, reason, decide) => {
    const find = () => one("SELECT id FROM leave_requests WHERE applicant_id = $1 AND from_date = $2 AND reason = $3", [sid, from, reason]);
    if (!(await find())) await api("POST", "/leave/apply", { applicantType: "Student", applicantId: sid, leaveTypeId: typeId, fromDate: from, toDate: to, reason }, admin);
    if (!decide) return;
    const leave = await find();
    const appr = await one("SELECT id FROM approval_requests WHERE reference_table = 'leave_requests' AND reference_id = $1 AND status IN ('Pending','Clarification')", [leave.id]);
    if (appr) await api("POST", `/approvals/${appr.id}/decide`, { decision: "Approved", note: "Get well soon." }, principal);
  };
  await ensureLeave(TASNIM, "LT-006", "2026-11-03", "2026-11-04", "Fever and cold – doctor advised two days of rest.", true);
  await ensureLeave(TANVIR, "LT-007", "2026-11-30", "2026-11-30", "Family wedding in Cumilla.", false);
  if (!(await exists("SELECT 1 FROM complaints WHERE guardian_id = $1", [MIZANUR]))) {
    await api("POST", "/complaints", { guardianId: MIZANUR, studentId: TANVIR, category: "Feedback", subject: "School bus arrives late in the morning", description: "The Route 3 bus has reached Rampura Bridge 10–15 minutes late on several days this month.", status: "Resolved", response: "Thank you. The pick-up time has been moved to 6:50 AM from Banasree so the bus reaches Rampura Bridge on time.", resolvedAt: `${addDays(TODAY, -6)}T12:00:00${TZ}` }, admin);
  }
  if (!(await exists("SELECT 1 FROM ptm_slots WHERE slot_date = '2026-11-27'"))) {
    for (const [i, t] of ["10:00", "10:15", "10:30", "10:45", "11:00"].entries()) {
      await api("POST", "/ptm-slots", { teacherId: teacherBySubject.math, slotDate: "2026-11-27", startTime: t, endTime: ["10:15", "10:30", "10:45", "11:00", "11:15"][i], status: i === 1 ? "Booked" : "Available", guardianId: i === 1 ? MIZANUR : null, studentId: i === 1 ? TANVIR : null, note: "Class 7-A half-yearly results" }, admin);
    }
  }
  // Documents: small real PDF files stored privately, plus issued certificates.
  const privDir = path.resolve(env.uploadDir, "private");
  fs.mkdirSync(privDir, { recursive: true });
  const makePdf = (text) => {
    const body = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
    const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${body.length} >>\nstream\n${body}\nendstream`];
    let pdf = "%PDF-1.4\n"; const offs = [];
    objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const x = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
    const name = `${crypto.randomUUID()}.pdf`;
    fs.writeFileSync(path.join(privDir, name), pdf);
    return { url: `/api/backend/uploads/private/${name}`, size: Buffer.byteLength(pdf) };
  };
  for (const [sid, nm] of [[TANVIR, "Tanvir Ahmed"], [TASNIM, "Tasnim Ahmed"]]) {
    for (const docType of ["Birth Certificate", "Previous Result"]) {
      if (await exists("SELECT 1 FROM student_documents WHERE owner_id = $1 AND document_type = $2", [sid, docType])) continue;
      const f = makePdf(`${docType} - ${nm}`);
      await api("POST", "/student-documents", { ownerType: "Student", ownerId: sid, documentType: docType, fileName: `${docType} - ${nm}.pdf`, fileUrl: f.url, mimeType: "application/pdf", sizeBytes: f.size, uploadedBy: "Office" }, admin);
    }
    if (!(await exists("SELECT 1 FROM certificates WHERE holder_id = $1", [sid]))) {
      await api("POST", "/certificates", { certificateType: "Study Certificate", holderType: "Student", holderId: sid, holderName: nm, content: { purpose: "Bank account opening", session: "2026", text: `This is to certify that ${nm} is a regular student of this school in session 2026.` }, status: "Issued", issuedAt: `${addDays(TODAY, -20)}T11:00:00${TZ}` }, admin);
    }
  }
  const BOOKS = [["978-984-8810-11-1", "Thakurmar Jhuli", "Dakshinaranjan Mitra Majumdar", "Bangla Literature"], ["978-984-8810-22-7", "Amar Bondhu Rashed", "Muhammed Zafar Iqbal", "Children's Fiction"],
    ["978-0-19-273522-4", "Oxford Junior English Dictionary", "Oxford", "Reference"], ["978-984-8810-35-7", "Science Fun Experiments", "Ahmed Kabir", "Science"], ["978-984-8810-48-7", "History of the Liberation War", "Muntassir Mamoon", "History"]];
  for (const [isbn, title, author, category] of BOOKS) {
    if (await exists("SELECT 1 FROM library_books WHERE isbn = $1", [isbn])) continue;
    await api("POST", "/library-books", { isbn, title, author, category, language: /Thakurmar|Amar/.test(title) ? "Bangla" : "English", shelf: "A-2", totalCopies: 4, availableCopies: 4, price: 350, status: "Active" }, admin);
  }
  log("messages, leave (approved + pending), complaint (resolved), PTM slots, documents, certificates, library books");

  // ------------------------------------------------------------------ 10b. Discount approval, library loans, study material, school profile
  await query("UPDATE fee_discounts SET status = 'Approved', approved_by = 'Prof. Mahmudul Haque' WHERE student_id = $1 AND status = 'Pending'", [TASNIM]);
  const book = async (title) => (await one("SELECT id FROM library_books WHERE title = $1", [title])).id;
  for (const [sid, nm, title, issued, returned] of [
    [TANVIR, "Tanvir Ahmed", "Amar Bondhu Rashed", addDays(TODAY, -9), null],
    [TANVIR, "Tanvir Ahmed", "History of the Liberation War", "2026-10-04", "2026-10-15"],
    [TASNIM, "Tasnim Ahmed", "Thakurmar Jhuli", addDays(TODAY, -5), null],
    [TASNIM, "Tasnim Ahmed", "Science Fun Experiments", "2026-09-20", "2026-10-01"],
  ]) {
    const bookId = await book(title);
    if (await exists("SELECT 1 FROM library_issues WHERE borrower_id = $1 AND book_id = $2", [sid, bookId])) continue;
    // The library workflow (stock count, audit), then back-dated to the story's dates.
    const issue = await api("POST", "/ops/library/issue", { bookId, borrowerType: "Student", borrowerId: sid, dueDate: addDays(issued, 14), note: `Issued to ${nm}` }, admin);
    if (returned) await api("POST", `/ops/library/return/${issue.id}`, { finePaid: false }, admin);
    await query("UPDATE library_issues SET issue_date = $2, return_date = $3, fine = 0 WHERE id = $1", [issue.id, issued, returned]);
  }
  const RESOURCES = [
    [C7, "math", "Algebra – Chapter 5 notes (PDF)", "Note", "Worked examples for Exercise 5.1 and 5.2."],
    [C7, "sci", "Video: Structure of a cell", "Video", "Ten-minute video lesson on plant and animal cells."],
    [C7, "eng1", "Unit 6 vocabulary list", "Note", "New words with meanings and example sentences."],
    [C6, "math", "Fractions practice sheet", "Worksheet", "Extra practice for Exercise 3.1 with answers."],
    [C6, "sci", "Video: How plants make food", "Video", "Photosynthesis explained in simple Bangla."],
  ];
  for (const [cid, subj, title, type, description] of RESOURCES) {
    if (await exists("SELECT 1 FROM learning_resources WHERE title = $1 AND class_id = $2", [title, cid])) continue;
    await api("POST", "/learning-resources", { classId: cid, subjectId: SUB[subj], title, type, url: "https://www.teachers.gov.bd/", description, uploadedBy: "Class teacher" }, admin);
  }
  for (const [cid, subj, title, when, status] of [
    [C7, "math", "Revision class: Algebra for Annual Exam", `${addDays(TODAY, 2)}T19:30:00${TZ}`, "Scheduled"],
    [C6, "eng1", "Spoken English practice", `${addDays(TODAY, 3)}T19:00:00${TZ}`, "Scheduled"],
    [C7, "sci", "Doubt-clearing session: The Cell", `${addDays(TODAY, -4)}T19:30:00${TZ}`, "Completed"],
  ]) {
    if (await exists("SELECT 1 FROM online_classes WHERE title = $1 AND class_id = $2", [title, cid])) continue;
    await api("POST", "/online-classes", { classId: cid, section: "A", subjectId: SUB[subj], teacherId: teacherBySubject[subj], title, provider: "Google Meet", meetingUrl: "https://meet.google.com/", scheduledAt: when, durationMinutes: 45, status }, admin);
  }
  // School profile: only fills fields that are empty or still the template placeholder.
  await query(
    `UPDATE institute_profile SET
       phone = CASE WHEN phone IS NULL OR phone LIKE '%XX%' THEN '01711-900100' ELSE phone END,
       principal_name = COALESCE(NULLIF(principal_name, ''), 'Prof. Mahmudul Haque'),
       emergency_contact = COALESCE(NULLIF(emergency_contact, ''), '01711-900199 (Office, 7 AM – 5 PM)'),
       motto = COALESCE(NULLIF(motto, ''), 'Knowledge, Discipline, Character'),
       name_bn = COALESCE(NULLIF(name_bn, ''), 'এডুম্যানেজ স্কুল অ্যান্ড কলেজ')
     WHERE id = 1`,
  );
  log("discount approved, library loans, study resources, online classes, school profile completed");

  // ------------------------------------------------------------------ 11. Alerts for the guardian (attendance + fees), child-tagged
  const { notifyStudentGuardians } = require("../src/services/notifications");
  const ALERTS = [
    [TANVIR, "Absent", "Tanvir Ahmed was absent", "তানভীর আহমেদ ১২ নভেম্বর স্কুলে অনুপস্থিত ছিল।"],
    [TANVIR, "Late", "Tanvir Ahmed arrived late", "তানভীর আহমেদ ১৮ নভেম্বর সকাল ৮:১৫-তে স্কুলে পৌঁছেছে (দেরি)।"],
    [TASNIM, "Late", "Tasnim Ahmed arrived late", "তাসনিম আহমেদ ১০ নভেম্বর সকাল ৮:১২-তে স্কুলে পৌঁছেছে (দেরি)।"],
    [TANVIR, "FeeReminder", "Fee due for Tanvir Ahmed", "তানভীর আহমেদের অক্টোবর ও নভেম্বর মাসের বেতন এবং পরিবহন ফি বকেয়া রয়েছে। অনুগ্রহ করে পরিশোধ করুন।"],
    [TASNIM, "FeeReminder", "Fee due for Tasnim Ahmed", "তাসনিম আহমেদের নভেম্বর মাসের বেতন ও বার্ষিক পরীক্ষার ফি বকেয়া রয়েছে।"],
    [TANVIR, "Entry", "Tanvir Ahmed entered school", "তানভীর আহমেদ আজ সকাল ৭:৫২-তে স্কুলে প্রবেশ করেছে।"],
    [TASNIM, "Entry", "Tasnim Ahmed entered school", "তাসনিম আহমেদ আজ সকাল ৭:৪৯-তে স্কুলে প্রবেশ করেছে।"],
  ];
  if (!(await exists("SELECT 1 FROM message_logs WHERE recipient_id = $1 AND subject = 'Tanvir Ahmed was absent'", [MIZANUR]))) {
    for (const [sid, eventType, subject, body] of ALERTS) {
      await notifyStudentGuardians(sid, { eventType, subject, body, channels: ["Portal"], primaryOnly: false, relatedType: "attendance" });
    }
  }
  // Keep the latest demo alerts unread so the badge on the Alerts tab shows activity.
  await query(
    `UPDATE message_logs SET read_at = NULL, status = 'Sent' WHERE id IN (
       SELECT id FROM message_logs WHERE recipient_type = 'Guardian' AND recipient_id = $1 AND channel = 'Portal' ORDER BY created_at DESC LIMIT 6)
     AND read_at IS NOT NULL`, [MIZANUR],
  );
  log(`alerts: ${ALERTS.length} attendance / fee alerts queued for both guardians (latest 6 unread)`);

  // ------------------------------------------------------------------ summary for the demo family
  const sum = await one(
    `SELECT (SELECT COUNT(*) FROM attendance WHERE student_id IN ($1,$2)) AS attendance,
            (SELECT COUNT(*) FROM results WHERE student_id IN ($1,$2) AND published) AS results,
            (SELECT COALESCE(SUM(amount - paid_amount),0) FROM fee_invoices WHERE student_id IN ($1,$2) AND status <> 'Paid') AS due,
            (SELECT COUNT(*) FROM message_logs WHERE recipient_type = 'Guardian' AND recipient_id = $3 AND channel = 'Portal') AS alerts`,
    [TANVIR, TASNIM, MIZANUR],
  );
  log(`\nDemo family now has: ${sum.attendance} attendance days, ${sum.results} published results, ৳${Number(sum.due).toLocaleString("en-IN")} due, ${sum.alerts} alerts.`);
  log("Logins: guardian mizanur.rahman@example.com / Guardian@2026 · principal@example.com / Principal@2026 · kamrul.hasan@example.com / Teacher@2026");
}

main()
  .catch((e) => { console.error("SEED FAILED:", e.message, e.cause || "", e.stack); process.exitCode = 1; })
  .finally(() => setTimeout(() => pool.end(), 1500)); // let queued notification jobs finish
