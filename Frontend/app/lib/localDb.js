"use client";

export const STORAGE_KEYS = {
  students: "edumanage-students",
  admissions: "edumanage-admissions",
  teachers: "edumanage-teachers",
  staff: "edumanage-staff",
  academicClasses: "edumanage-academic-classes",
  academicSubjects: "edumanage-academic-subjects",
  academicYears: "edumanage-academic-years",
  academicSettings: "edumanage-academic-settings",
  academicAssignments: "edumanage-academic-assignments",
  academicMarks: "edumanage-academic-marks",
  applicationDraft: "edumanage-application-draft",
};

export const seedStudents = [
  { id: "STU-4001", roll: "001", name: "Ali Hassan", gender: "Male", className: "Class 9-A", parentContact: "03XX-1234567", dateOfBirth: "2005-01-01", status: "Inactive" },
  { id: "STU-4002", roll: "002", name: "Fatima Malik", gender: "Female", className: "Class 10-B", parentContact: "03XX-2345678", dateOfBirth: "2006-02-02", status: "Active" },
  { id: "STU-4003", roll: "003", name: "Ahmed Khan", gender: "Male", className: "Class 8-A", parentContact: "03XX-3456789", dateOfBirth: "2007-03-03", status: "Active" },
  { id: "STU-4004", roll: "004", name: "Zainab Noor", gender: "Female", className: "Class 11-C", parentContact: "03XX-4567890", dateOfBirth: "2008-04-04", status: "Active" },
  { id: "STU-4005", roll: "005", name: "Omar Farooq", gender: "Male", className: "Class 7-B", parentContact: "03XX-5678901", dateOfBirth: "2009-05-05", status: "Active" },
  { id: "STU-4006", roll: "006", name: "Ayesha Siddiqui", gender: "Female", className: "Class 12-A", parentContact: "03XX-6789012", dateOfBirth: "2005-06-06", status: "Active" },
  { id: "STU-4007", roll: "007", name: "Bilal Ahmad", gender: "Male", className: "Class 6-A", parentContact: "03XX-7890123", dateOfBirth: "2006-07-07", status: "Active" },
  { id: "STU-4008", roll: "008", name: "Mariam Hussain", gender: "Female", className: "Class 9-B", parentContact: "03XX-8901234", dateOfBirth: "2007-08-08", status: "Inactive" },
  { id: "STU-4009", roll: "009", name: "Hammad Raza", gender: "Male", className: "Class 8-C", parentContact: "03XX-9012345", dateOfBirth: "2008-09-09", status: "Active" },
  { id: "STU-4010", roll: "010", name: "Sana Javed", gender: "Female", className: "Class 10-A", parentContact: "03XX-0123456", dateOfBirth: "2006-10-10", status: "Active" },
  { id: "STU-4011", roll: "011", name: "Usman Tariq", gender: "Male", className: "Class 11-B", parentContact: "03XX-1122334", dateOfBirth: "2005-11-11", status: "Inactive" },
  { id: "STU-4012", roll: "012", name: "Hira Shah", gender: "Female", className: "Class 7-A", parentContact: "03XX-2233445", dateOfBirth: "2009-12-12", status: "Active" },
  { id: "STU-4013", roll: "013", name: "Danish Iqbal", gender: "Male", className: "Class 6-B", parentContact: "03XX-3344556", dateOfBirth: "2010-01-13", status: "Active" },
  { id: "STU-4014", roll: "014", name: "Noor Ul Ain", gender: "Female", className: "Class 12-C", parentContact: "03XX-4455667", dateOfBirth: "2005-02-14", status: "Active" },
  { id: "STU-4015", roll: "015", name: "Saad Karim", gender: "Male", className: "Class 9-C", parentContact: "03XX-5566778", dateOfBirth: "2007-03-15", status: "Inactive" },
  { id: "STU-4016", roll: "016", name: "Iqra Bashir", gender: "Female", className: "Class 8-B", parentContact: "03XX-6677889", dateOfBirth: "2008-04-16", status: "Active" },
  { id: "STU-4017", roll: "017", name: "Rehan Aslam", gender: "Male", className: "Class 10-C", parentContact: "03XX-7788990", dateOfBirth: "2006-05-17", status: "Active" },
  { id: "STU-4018", roll: "018", name: "Mahnoor Ali", gender: "Female", className: "Class 7-C", parentContact: "03XX-8899001", dateOfBirth: "2009-06-18", status: "Active" },
  { id: "STU-4019", roll: "019", name: "Farhan Qureshi", gender: "Male", className: "Class 11-A", parentContact: "03XX-9900112", dateOfBirth: "2005-07-19", status: "Inactive" },
  { id: "STU-4020", roll: "020", name: "Laiba Ahmed", gender: "Female", className: "Class 6-C", parentContact: "03XX-1011121", dateOfBirth: "2010-08-20", status: "Active" },
];

export const seedAdmissions = [
  { id: "APP-4101", initials: "KM", name: "Khalid Mehmood", gender: "Male", className: "Class 6", date: "2024-12-10", status: "Pending" },
  { id: "APP-4102", initials: "AF", name: "Amina Farooq", gender: "Female", className: "Class 9", date: "2024-12-11", status: "Approved" },
  { id: "APP-4103", initials: "ZA", name: "Zubair Ahmad", gender: "Male", className: "Class 7", date: "2024-12-12", status: "Pending" },
  { id: "APP-4104", initials: "SR", name: "Sobia Raza", gender: "Female", className: "Class 11", date: "2024-12-13", status: "Under Review" },
  { id: "APP-4105", initials: "HS", name: "Hamza Sheikh", gender: "Male", className: "Class 8", date: "2024-12-14", status: "Approved" },
  { id: "APP-4106", initials: "NF", name: "Noor Fatima", gender: "Female", className: "Class 10", date: "2024-12-15", status: "Pending" },
  { id: "APP-4107", initials: "BA", name: "Babar Ali", gender: "Male", className: "Class 6", date: "2024-12-16", status: "Under Review" },
  { id: "APP-4108", initials: "SK", name: "Saira Khan", gender: "Female", className: "Class 9", date: "2024-12-17", status: "Approved" },
  { id: "APP-4109", initials: "FJ", name: "Faisal Javed", gender: "Male", className: "Class 7", date: "2024-12-18", status: "Pending" },
  { id: "APP-4110", initials: "MI", name: "Madiha Iqbal", gender: "Female", className: "Class 12", date: "2024-12-19", status: "Rejected" },
  { id: "APP-4111", initials: "AQ", name: "Arslan Qureshi", gender: "Male", className: "Class 8", date: "2024-12-20", status: "Pending" },
  { id: "APP-4112", initials: "YN", name: "Yasmin Nawaz", gender: "Female", className: "Class 11", date: "2024-12-21", status: "Approved" },
];

export const seedTeachers = [
  { id: "TCH-1001", firstName: "Rahim", lastName: "Ahmed", name: "Dr. Rahim Ahmed", department: "Mathematics", qualification: "Ph.D Mathematics", phone: "03XX-1001001", email: "rahim@school.edu", joinDate: "2012-01-15", experience: 12, subjects: ["Math", "Calculus"], salary: "95000", classes: 3, rating: 4.8, status: "Active" },
  { id: "TCH-1002", firstName: "Nadia", lastName: "Khan", name: "Ms. Nadia Khan", department: "Science", qualification: "M.Sc Physics", phone: "03XX-1001002", email: "nadia@school.edu", joinDate: "2016-03-10", experience: 8, subjects: ["Physics", "Chemistry"], salary: "78000", classes: 3, rating: 4.6, status: "Active" },
  { id: "TCH-1003", firstName: "Tariq", lastName: "Hassan", name: "Mr. Tariq Hassan", department: "English", qualification: "M.A English", phone: "03XX-1001003", email: "tariq@school.edu", joinDate: "2009-08-20", experience: 15, subjects: ["English", "Literature"], salary: "88000", classes: 3, rating: 4.9, status: "On Leave" },
  { id: "TCH-1004", firstName: "Sara", lastName: "Malik", name: "Mrs. Sara Malik", department: "Urdu", qualification: "M.A Urdu", phone: "03XX-1001004", email: "sara@school.edu", joinDate: "2018-07-05", experience: 6, subjects: ["Urdu", "Grammar"], salary: "62000", classes: 3, rating: 4.5, status: "Active" },
  { id: "TCH-1005", firstName: "Bilal", lastName: "Qadir", name: "Mr. Bilal Qadir", department: "Arabic", qualification: "M.A Arabic", phone: "03XX-1001005", email: "bilal@school.edu", joinDate: "2014-11-12", experience: 10, subjects: ["Arabic", "Quran"], salary: "72000", classes: 3, rating: 4.7, status: "Active" },
  { id: "TCH-1006", firstName: "Amna", lastName: "Sheikh", name: "Ms. Amna Sheikh", department: "Computer Science", qualification: "BS Computer Science", phone: "03XX-1001006", email: "amna@school.edu", joinDate: "2020-02-01", experience: 4, subjects: ["CS", "Programming"], salary: "70000", classes: 3, rating: 4.3, status: "Active" },
  { id: "TCH-1007", firstName: "Omar", lastName: "Lodhi", name: "Mr. Omar Lodhi", department: "Mathematics", qualification: "M.Sc Mathematics", phone: "03XX-1001007", email: "omar@school.edu", joinDate: "2004-04-18", experience: 20, subjects: ["Math", "Geometry"], salary: "105000", classes: 2, rating: 4.9, status: "Active" },
  { id: "TCH-1008", firstName: "Zara", lastName: "Hussain", name: "Mrs. Zara Hussain", department: "Science", qualification: "M.Sc Biology", phone: "03XX-1001008", email: "zara@school.edu", joinDate: "2015-09-09", experience: 9, subjects: ["Biology", "Chemistry"], salary: "76000", classes: 3, rating: 4.6, status: "Active" },
  { id: "TCH-1009", firstName: "Imran", lastName: "Ali", name: "Mr. Imran Ali", department: "Social Studies", qualification: "M.A History", phone: "03XX-1001009", email: "imran@school.edu", joinDate: "2017-06-14", experience: 7, subjects: ["History", "Geography"], salary: "68000", classes: 3, rating: 4.4, status: "Active" },
  { id: "TCH-1010", firstName: "Hina", lastName: "Baig", name: "Ms. Hina Baig", department: "English", qualification: "M.A English", phone: "03XX-1001010", email: "hina@school.edu", joinDate: "2013-10-22", experience: 11, subjects: ["English", "Writing"], salary: "81000", classes: 3, rating: 4.7, status: "Active" },
  { id: "TCH-1011", firstName: "Asif", lastName: "Raza", name: "Mr. Asif Raza", department: "Islamic Studies", qualification: "M.A Islamic Studies", phone: "03XX-1001011", email: "asif@school.edu", joinDate: "2010-12-01", experience: 14, subjects: ["Islamic Studies", "Quran"], salary: "84000", classes: 3, rating: 4.8, status: "Active" },
  { id: "TCH-1012", firstName: "Farah", lastName: "Nawaz", name: "Mrs. Farah Nawaz", department: "Physical Education", qualification: "B.P.Ed", phone: "03XX-1001012", email: "farah@school.edu", joinDate: "2021-01-25", experience: 3, subjects: ["PE", "Sports"], salary: "58000", classes: 3, rating: 4.2, status: "Active" },
];

export const seedStaff = [
  { id: "STF-001", firstName: "Kabir", lastName: "Hossain", name: "Mr. Kabir Hossain", designation: "Office Manager", department: "Administration", phone: "01711-234567", email: "kabir@school.edu", joinDate: "2018-01-10", shift: "Morning", salary: 32000, gender: "Male", address: "House 12, Dhaka", status: "Active" },
  { id: "STF-002", firstName: "Rashida", lastName: "Begum", name: "Ms. Rashida Begum", designation: "Accountant", department: "Accounts", phone: "01812-345678", email: "rashida@school.edu", joinDate: "2017-03-18", shift: "Morning", salary: 30000, gender: "Female", address: "Mirpur, Dhaka", status: "Active" },
  { id: "STF-003", firstName: "Jahangir", lastName: "Alam", name: "Mr. Jahangir Alam", designation: "IT Technician", department: "IT & Library", phone: "01913-456789", email: "jahangir@school.edu", joinDate: "2019-05-20", shift: "Morning", salary: 26000, gender: "Male", address: "Uttara, Dhaka", status: "Active" },
  { id: "STF-004", firstName: "Rafiqul", lastName: "Islam", name: "Mr. Rafiqul Islam", designation: "Security Guard", department: "Security", phone: "01611-567890", email: "rafiqul@school.edu", joinDate: "2016-08-11", shift: "Night", salary: 18000, gender: "Male", address: "Savar, Dhaka", status: "Active" },
  { id: "STF-005", firstName: "Selina", lastName: "Akter", name: "Ms. Selina Akter", designation: "Cleaner", department: "Cleaning & Maintenance", phone: "01514-678901", email: "selina@school.edu", joinDate: "2020-02-14", shift: "Day", salary: 15000, gender: "Female", address: "Badda, Dhaka", status: "Active" },
  { id: "STF-006", firstName: "Abul", lastName: "Hasan", name: "Mr. Abul Hasan", designation: "Data Entry Operator", department: "Administration", phone: "01715-789012", email: "abul@school.edu", joinDate: "2021-01-08", shift: "Morning", salary: 22000, gender: "Male", address: "Farmgate, Dhaka", status: "Active" },
  { id: "STF-007", firstName: "Fatema", lastName: "Khatun", name: "Ms. Fatema Khatun", designation: "Librarian", department: "IT & Library", phone: "01816-890123", email: "fatema@school.edu", joinDate: "2018-10-25", shift: "Morning", salary: 24000, gender: "Female", address: "Dhanmondi, Dhaka", status: "On Leave" },
  { id: "STF-008", firstName: "Sumon", lastName: "Mia", name: "Mr. Sumon Mia", designation: "Maintenance Technician", department: "Cleaning & Maintenance", phone: "01917-901234", email: "sumon@school.edu", joinDate: "2015-04-02", shift: "Morning", salary: 21000, gender: "Male", address: "Mohakhali, Dhaka", status: "Active" },
  { id: "STF-009", firstName: "Akter", lastName: "Hossain", name: "Mr. Akter Hossain", designation: "Security Guard", department: "Security", phone: "01618-012345", email: "akter@school.edu", joinDate: "2019-09-19", shift: "Day", salary: 18000, gender: "Male", address: "Gazipur", status: "Active" },
  { id: "STF-010", firstName: "Nasrin", lastName: "Sultana", name: "Ms. Nasrin Sultana", designation: "Receptionist", department: "Administration", phone: "01519-123456", email: "nasrin@school.edu", joinDate: "2022-07-07", shift: "Morning", salary: 23000, gender: "Female", address: "Banani, Dhaka", status: "Active" },
  { id: "STF-011", firstName: "Belal", lastName: "Ahmed", name: "Mr. Belal Ahmed", designation: "Canteen Manager", department: "Canteen", phone: "01720-234567", email: "belal@school.edu", joinDate: "2016-12-12", shift: "Morning", salary: 28000, gender: "Male", address: "Khilgaon, Dhaka", status: "Active" },
  { id: "STF-012", firstName: "Ranu", lastName: "Begum", name: "Ms. Ranu Begum", designation: "Canteen Staff", department: "Canteen", phone: "01821-345678", email: "ranu@school.edu", joinDate: "2020-11-21", shift: "Morning", salary: 19000, gender: "Female", address: "Rampura, Dhaka", status: "Inactive" },
];

export const seedAcademicClasses = [
  { id: "CLS-001", name: "Class 6", level: "Secondary", sections: ["A", "B", "C"], students: 120, teacherId: "TCH-1006" },
  { id: "CLS-002", name: "Class 7", level: "Secondary", sections: ["A", "B", "C"], students: 115, teacherId: "TCH-1005" },
  { id: "CLS-003", name: "Class 8", level: "Secondary", sections: ["A", "B", "C"], students: 118, teacherId: "TCH-1004" },
  { id: "CLS-004", name: "Class 9", level: "Secondary", sections: ["A", "B", "C"], students: 110, teacherId: "TCH-1001" },
  { id: "CLS-005", name: "Class 10", level: "Secondary", sections: ["A", "B", "C"], students: 108, teacherId: "TCH-1003" },
  { id: "CLS-006", name: "Class 11", level: "Higher Secondary", sections: ["A", "B", "C"], students: 95, teacherId: "TCH-1002" },
  { id: "CLS-007", name: "Class 12", level: "Higher Secondary", sections: ["A", "B"], students: 80, teacherId: "TCH-1007" },
  { id: "CLS-008", name: "Madrasa Daakhil", level: "Madrasa", sections: ["A", "B"], students: 72, teacherId: "TCH-1011" },
  { id: "CLS-009", name: "Madrasa Alim", level: "Madrasa", sections: ["A"], students: 45, teacherId: "TCH-1012" },
];

export const seedAcademicSubjects = [
  { id: "SUB-001", name: "Bangla", code: "BAN-101", type: "Compulsory", classRange: "6-12", teacherId: "TCH-1004", credit: 4, status: "Active" },
  { id: "SUB-002", name: "English", code: "ENG-102", type: "Compulsory", classRange: "6-12", teacherId: "TCH-1003", credit: 4, status: "Active" },
  { id: "SUB-003", name: "Mathematics", code: "MAT-103", type: "Compulsory", classRange: "6-12", teacherId: "TCH-1001", credit: 4, status: "Active" },
  { id: "SUB-004", name: "General Science", code: "SCI-104", type: "Compulsory", classRange: "6-8", teacherId: "TCH-1002", credit: 4, status: "Active" },
  { id: "SUB-005", name: "Physics", code: "PHY-105", type: "Elective", classRange: "9-12", teacherId: "TCH-1002", credit: 4, status: "Active" },
  { id: "SUB-006", name: "Chemistry", code: "CHM-106", type: "Elective", classRange: "9-12", teacherId: "TCH-1002", credit: 4, status: "Active" },
  { id: "SUB-007", name: "Biology", code: "BIO-107", type: "Elective", classRange: "9-12", teacherId: "TCH-1008", credit: 4, status: "Active" },
  { id: "SUB-008", name: "Social Studies", code: "SOC-108", type: "Compulsory", classRange: "6-10", teacherId: "TCH-1009", credit: 3, status: "Active" },
  { id: "SUB-009", name: "Islamic Studies", code: "ISL-109", type: "Compulsory", classRange: "6-12", teacherId: "TCH-1011", credit: 3, status: "Active" },
  { id: "SUB-010", name: "Computer Science", code: "CSC-110", type: "Optional", classRange: "9-12", teacherId: "TCH-1006", credit: 3, status: "Active" },
  { id: "SUB-011", name: "Arabic", code: "ARB-111", type: "Compulsory", classRange: "Mad.", teacherId: "TCH-1005", credit: 4, status: "Active" },
  { id: "SUB-012", name: "Physical Education", code: "PE-112", type: "Optional", classRange: "6-10", teacherId: "TCH-1012", credit: 2, status: "Active" },
];

export const seedAcademicYears = [
  { id: "YEAR-001", name: "2024-25", startDate: "2024-01-01", endDate: "2024-12-31", sessions: 2, status: "Current" },
  { id: "YEAR-002", name: "2023-24", startDate: "2023-01-01", endDate: "2023-12-31", sessions: 2, status: "Completed" },
  { id: "YEAR-003", name: "2022-23", startDate: "2022-01-01", endDate: "2022-12-31", sessions: 2, status: "Completed" },
];

export const seedAcademicSettings = {
  workingDays: "6",
  startTime: "08:00 AM",
  endTime: "02:30 PM",
  periodsPerDay: "8",
  periodDuration: "45",
  gradingSystem: "GPA (0-5)",
  passMarks: "33%",
  promotionPolicy: "Annual"
};

export const seedAcademicAssignments = [
  { id: "ASN-001", classId: "CLS-001", section: "A", subjectId: "SUB-010", teacherId: "TCH-1006", roomNo: "101", students: 40 },
  { id: "ASN-002", classId: "CLS-001", section: "B", subjectId: "SUB-011", teacherId: "TCH-1005", roomNo: "102", students: 38 },
  { id: "ASN-003", classId: "CLS-002", section: "A", subjectId: "SUB-007", teacherId: "TCH-1008", roomNo: "201", students: 39 },
  { id: "ASN-004", classId: "CLS-003", section: "A", subjectId: "SUB-001", teacherId: "TCH-1004", roomNo: "301", students: 40 },
  { id: "ASN-005", classId: "CLS-004", section: "A", subjectId: "SUB-003", teacherId: "TCH-1001", roomNo: "401", students: 37 },
  { id: "ASN-006", classId: "CLS-005", section: "A", subjectId: "SUB-002", teacherId: "TCH-1003", roomNo: "402", students: 36 },
  { id: "ASN-007", classId: "CLS-006", section: "A", subjectId: "SUB-005", teacherId: "TCH-1002", roomNo: "501", students: 32 },
  { id: "ASN-008", classId: "CLS-007", section: "A", subjectId: "SUB-003", teacherId: "TCH-1007", roomNo: "502", students: 28 },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readCollection(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeCollection(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
  return rows;
}

function nextId(rows, prefix, minimum) {
  const nextNumber =
    Math.max(minimum, ...rows.map((row) => Number(String(row.id || "").replace(/\D/g, "")) || 0)) + 1;
  return `${prefix}-${nextNumber}`;
}

export const db = {
  students: {
    list() {
      return readCollection(STORAGE_KEYS.students, seedStudents);
    },
    create(student) {
      const rows = db.students.list();
      const nextStudent = {
        ...student,
        id: student.id || nextId(rows, "STU", 4000),
      };
      writeCollection(STORAGE_KEYS.students, [nextStudent, ...rows]);
      return nextStudent;
    },
    createFromAdmission(applicant) {
      const rows = db.students.list();
      const existing = rows.find((student) => student.sourceApplicantId === applicant.id);
      if (existing) return existing;

      const details = applicant.details || {};
      const className = details.section
        ? `${details.classApplied || applicant.className || "Class 1"}-${details.section}`
        : details.classApplied || applicant.className || "Class 1";
      const nextRoll = String(rows.length + 1).padStart(3, "0");

      return db.students.create({
        roll: details.rollNumber || nextRoll,
        name: applicant.name,
        gender: applicant.gender,
        className,
        parentContact: details.fatherPhone || details.emergencyContact || "",
        dateOfBirth: details.dateOfBirth || "",
        status: "Active",
        sourceApplicantId: applicant.id,
        details,
      });
    },
    update(id, changes) {
      const rows = db.students.list().map((student) =>
        student.id === id ? { ...student, ...changes } : student,
      );
      writeCollection(STORAGE_KEYS.students, rows);
      return rows.find((student) => student.id === id);
    },
    remove(id) {
      writeCollection(
        STORAGE_KEYS.students,
        db.students.list().filter((student) => student.id !== id),
      );
    },
  },
  admissions: {
    list() {
      return readCollection(STORAGE_KEYS.admissions, seedAdmissions);
    },
    create(applicant) {
      const rows = db.admissions.list();
      const nextApplicant = {
        ...applicant,
        id: applicant.id || nextId(rows, "APP", 4112),
      };
      writeCollection(STORAGE_KEYS.admissions, [nextApplicant, ...rows]);
      return nextApplicant;
    },
    update(id, changes) {
      const rows = db.admissions.list().map((applicant) =>
        applicant.id === id ? { ...applicant, ...changes } : applicant,
      );
      writeCollection(STORAGE_KEYS.admissions, rows);
      return rows.find((applicant) => applicant.id === id);
    },
    remove(id) {
      writeCollection(
        STORAGE_KEYS.admissions,
        db.admissions.list().filter((applicant) => applicant.id !== id),
      );
    },
  },
  teachers: {
    list() {
      return readCollection(STORAGE_KEYS.teachers, seedTeachers);
    },
    create(teacher) {
      const rows = db.teachers.list();
      const nextTeacher = {
        ...teacher,
        id: teacher.id || nextId(rows, "TCH", 1000),
        name: teacher.name || `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim(),
      };
      writeCollection(STORAGE_KEYS.teachers, [nextTeacher, ...rows]);
      return nextTeacher;
    },
    update(id, changes) {
      const rows = db.teachers.list().map((teacher) => {
        if (teacher.id !== id) return teacher;
        const nextTeacher = { ...teacher, ...changes };
        return {
          ...nextTeacher,
          name: `${nextTeacher.firstName || ""} ${nextTeacher.lastName || ""}`.trim() || nextTeacher.name,
        };
      });
      writeCollection(STORAGE_KEYS.teachers, rows);
      return rows.find((teacher) => teacher.id === id);
    },
    remove(id) {
      writeCollection(
        STORAGE_KEYS.teachers,
        db.teachers.list().filter((teacher) => teacher.id !== id),
      );
    },
  },
  staff: {
    list() {
      return readCollection(STORAGE_KEYS.staff, seedStaff);
    },
    create(member) {
      const rows = db.staff.list();
      const nextMember = {
        ...member,
        id: member.id || nextId(rows, "STF", 0).replace("STF-", "STF-").replace(/STF-(\d+)/, (_, number) => `STF-${String(number).padStart(3, "0")}`),
        name: member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim(),
      };
      writeCollection(STORAGE_KEYS.staff, [nextMember, ...rows]);
      return nextMember;
    },
    update(id, changes) {
      const rows = db.staff.list().map((member) => {
        if (member.id !== id) return member;
        const nextMember = { ...member, ...changes };
        return {
          ...nextMember,
          name: `${nextMember.firstName || ""} ${nextMember.lastName || ""}`.trim() || nextMember.name,
        };
      });
      writeCollection(STORAGE_KEYS.staff, rows);
      return rows.find((member) => member.id === id);
    },
    remove(id) {
      writeCollection(
        STORAGE_KEYS.staff,
        db.staff.list().filter((member) => member.id !== id),
      );
    },
  },
  academic: {
    classes: {
      list() {
        return readCollection(STORAGE_KEYS.academicClasses, seedAcademicClasses);
      },
      create(row) {
        const rows = db.academic.classes.list();
        const nextRow = {
          ...row,
          id: row.id || nextId(rows, "CLS", 0),
        };
        writeCollection(STORAGE_KEYS.academicClasses, [...rows, nextRow]);
        return nextRow;
      },
      update(id, changes) {
        const rows = db.academic.classes.list().map((row) =>
          row.id === id ? { ...row, ...changes } : row,
        );
        writeCollection(STORAGE_KEYS.academicClasses, rows);
        return rows.find((row) => row.id === id);
      },
      remove(id) {
        writeCollection(
          STORAGE_KEYS.academicClasses,
          db.academic.classes.list().filter((row) => row.id !== id),
        );
      },
    },
    subjects: {
      list() {
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem(STORAGE_KEYS.academicSubjects);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const hasOldData = parsed.some(
                (subj) => subj.code === "ARB-112" || subj.code === "CSC-108" || subj.code === "PED-111"
              );
              if (hasOldData) {
                localStorage.removeItem(STORAGE_KEYS.academicSubjects);
              }
            } catch (e) {
              // ignore
            }
          }
        }
        return readCollection(STORAGE_KEYS.academicSubjects, seedAcademicSubjects);
      },
      create(row) {
        const rows = db.academic.subjects.list();
        const nextRow = {
          ...row,
          id: row.id || nextId(rows, "SUB", 0),
        };
        writeCollection(STORAGE_KEYS.academicSubjects, [...rows, nextRow]);
        return nextRow;
      },
      update(id, changes) {
        const rows = db.academic.subjects.list().map((row) =>
          row.id === id ? { ...row, ...changes } : row,
        );
        writeCollection(STORAGE_KEYS.academicSubjects, rows);
        return rows.find((row) => row.id === id);
      },
      remove(id) {
        writeCollection(
          STORAGE_KEYS.academicSubjects,
          db.academic.subjects.list().filter((row) => row.id !== id),
        );
      },
    },
    years: {
      list() {
        return readCollection(STORAGE_KEYS.academicYears, seedAcademicYears);
      },
      create(row) {
        const rows = db.academic.years.list();
        const nextRow = {
          ...row,
          id: row.id || nextId(rows, "YEAR", 0),
        };
        writeCollection(STORAGE_KEYS.academicYears, [...rows, nextRow]);
        return nextRow;
      },
      update(id, changes) {
        const rows = db.academic.years.list().map((row) =>
          row.id === id ? { ...row, ...changes } : row,
        );
        writeCollection(STORAGE_KEYS.academicYears, rows);
        return rows.find((row) => row.id === id);
      },
      remove(id) {
        writeCollection(
          STORAGE_KEYS.academicYears,
          db.academic.years.list().filter((row) => row.id !== id),
        );
      },
    },
    assignments: {
      list() {
        return readCollection(STORAGE_KEYS.academicAssignments, seedAcademicAssignments);
      },
      create(row) {
        const rows = db.academic.assignments.list();
        const nextRow = {
          ...row,
          id: row.id || nextId(rows, "ASN", 0),
        };
        writeCollection(STORAGE_KEYS.academicAssignments, [...rows, nextRow]);
        return nextRow;
      },
      update(id, changes) {
        const rows = db.academic.assignments.list().map((row) =>
          row.id === id ? { ...row, ...changes } : row,
        );
        writeCollection(STORAGE_KEYS.academicAssignments, rows);
        return rows.find((row) => row.id === id);
      },
      remove(id) {
        writeCollection(
          STORAGE_KEYS.academicAssignments,
          db.academic.assignments.list().filter((row) => row.id !== id),
        );
      },
    },
    settings: {
      get() {
        return readCollection(STORAGE_KEYS.academicSettings, seedAcademicSettings);
      },
      update(changes) {
        const current = db.academic.settings.get();
        const updated = Array.isArray(current) ? { ...seedAcademicSettings, ...changes } : { ...current, ...changes };
        localStorage.setItem(STORAGE_KEYS.academicSettings, JSON.stringify(updated));
        return updated;
      }
    },
    marks: {
      list() {
        return readCollection(STORAGE_KEYS.academicMarks, []);
      },
      save(records) {
        const existing = db.academic.marks.list();
        const updated = [...existing];
        for (const rec of records) {
          const idx = updated.findIndex(r => r.exam === rec.exam && r.studentId === rec.studentId);
          if (idx > -1) {
            updated[idx] = { ...updated[idx], ...rec };
          } else {
            updated.push({
              ...rec,
              id: rec.id || nextId(updated, "MRK", 0),
            });
          }
        }
        writeCollection(STORAGE_KEYS.academicMarks, updated);
      }
    }
  },
  drafts: {
    getApplication() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.applicationDraft) || "null");
      } catch {
        localStorage.removeItem(STORAGE_KEYS.applicationDraft);
        return null;
      }
    },
    saveApplication(draft) {
      localStorage.setItem(STORAGE_KEYS.applicationDraft, JSON.stringify(draft));
    },
    clearApplication() {
      localStorage.removeItem(STORAGE_KEYS.applicationDraft);
    },
  },
};
