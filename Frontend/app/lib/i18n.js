"use client";

import { createContext, useContext } from "react";

// Bangla-first UI with English option (SRS §2.3, NFR-08, NFX-08).
const BN = {
  "Dashboard": "ড্যাশবোর্ড", "Overview": "সারসংক্ষেপ", "My Day": "আমার দিন", "Analytics": "বিশ্লেষণ",
  "Admission": "ভর্তি", "Circulars": "ভর্তি বিজ্ঞপ্তি", "New Application": "নতুন আবেদন", "Applications": "আবেদনসমূহ", "Merit & Test": "মেধা ও পরীক্ষা",
  "Students": "শিক্ষার্থী", "Student List": "শিক্ষার্থী তালিকা", "Add Student": "শিক্ষার্থী যোগ", "Student 360": "শিক্ষার্থী প্রোফাইল",
  "Promotion & Import": "প্রমোশন ও ইমপোর্ট", "Certificates": "সনদপত্র", "Guardians": "অভিভাবক",
  "ID Card Center": "আইডি কার্ড সেন্টার", "Template Gallery": "টেমপ্লেট গ্যালারি", "Generate & Print": "কার্ড তৈরি ও প্রিন্ট",
  "Print History": "প্রিন্ট ইতিহাস", "Issued Cards": "ইস্যুকৃত কার্ড",
  "Teachers": "শিক্ষক", "Staff": "কর্মচারী", "HR & Payroll": "এইচআর ও বেতন", "Payroll": "বেতন", "Salary Structure": "বেতন কাঠামো",
  "Photo Gallery": "ফটো গ্যালারি", "Leave": "ছুটি", "Academic": "একাডেমিক", "Setup": "সেটআপ", "Calendar": "একাডেমিক ক্যালেন্ডার", "Homework": "হোমওয়ার্ক",
  "Resources & Syllabus": "রিসোর্স ও সিলেবাস", "Online Classes": "অনলাইন ক্লাস", "Routine": "রুটিন",
  "Attendance": "উপস্থিতি", "Student Attendance": "শিক্ষার্থী উপস্থিতি", "Staff Attendance": "স্টাফ উপস্থিতি",
  "Leave Requests": "ছুটির আবেদন", "Devices & RFID": "ডিভাইস ও আরএফআইডি", "Attendance Reports": "উপস্থিতি রিপোর্ট",
  "Exams & Results": "পরীক্ষা ও ফলাফল", "Exam Setup": "পরীক্ষা সেটআপ", "Marks Entry": "নম্বর প্রদান", "Result Processing": "ফলাফল প্রক্রিয়া",
  "Result Workflow": "ফলাফল প্রকাশ", "Marksheet": "মার্কশিট", "Grading": "গ্রেডিং",
  "Fees": "ফি", "Add Fee": "ফি কাঠামো", "Collect Fee": "ফি আদায়", "Receipts": "রসিদ", "Fee Operations": "ফি কার্যক্রম",
  "Accounts": "হিসাব", "Income Entry": "আয়", "Expense Entry": "ব্যয়", "Ledger": "লেজার", "Books & Reports": "হিসাব বই ও রিপোর্ট",
  "Chart & Vouchers": "হিসাব খাত ও ভাউচার", "Communication": "যোগাযোগ", "Notice & SMS": "নোটিশ ও এসএমএস", "Message Log": "বার্তা লগ",
  "Messages": "বার্তা", "Complaints & PTM": "অভিযোগ ও অভিভাবক সভা",
  "Library": "লাইব্রেরি", "Inventory & Assets": "ইনভেন্টরি ও সম্পদ", "Transport": "পরিবহন",
  "Madrasa": "মাদ্রাসা", "Hifz & Halaqa": "হিফজ ও হালাকা", "Salah": "সালাত", "Hostel & Meals": "হোস্টেল ও খাবার", "Donations": "দান ও তহবিল",
  "Approvals": "অনুমোদন", "Reports": "রিপোর্ট", "Settings": "সেটিংস", "Institution Setup": "প্রতিষ্ঠান সেটআপ",
  "Roles & Permissions": "রোল ও অনুমতি", "Audit Log": "অডিট লগ", "Branches": "শাখা",
  "Search": "অনুসন্ধান", "Save": "সংরক্ষণ", "Cancel": "বাতিল", "Delete": "মুছুন", "Edit": "সম্পাদনা", "Add": "যোগ করুন",
  "Export": "এক্সপোর্ট", "Print": "প্রিন্ট", "Loading": "লোড হচ্ছে", "Sign Out": "সাইন আউট", "My Profile": "আমার প্রোফাইল",
  "Help & Support": "সহায়তা", "Status": "অবস্থা", "Actions": "কার্যক্রম", "Approve": "অনুমোদন", "Reject": "প্রত্যাখ্যান",
  "No records found.": "কোনো তথ্য পাওয়া যায়নি।", "Guardian Portal": "অভিভাবক পোর্টাল", "Teacher Portal": "শিক্ষক পোর্টাল",
  // Navigation groups, quick actions and search (UI simplification, Nov 2026).
  "Daily work": "দৈনন্দিন কাজ", "People": "মানুষ", "Academics & exams": "একাডেমিক ও পরীক্ষা", "Finance & HR": "হিসাব ও এইচআর",
  "Operations & settings": "পরিচালনা ও সেটিংস", "Quick actions": "দ্রুত কাজ", "Take attendance": "উপস্থিতি নিন",
  "Collect a fee": "ফি আদায় করুন", "Send a notice": "নোটিশ পাঠান", "Find a student": "শিক্ষার্থী খুঁজুন", "Enter marks": "নম্বর দিন",
  "Add a student": "শিক্ষার্থী যোগ করুন", "Search pages and students…": "পেজ বা শিক্ষার্থী খুঁজুন…", "Pages": "পেজ",
  "No matches.": "কিছু পাওয়া যায়নি।", "Charts": "চার্ট", "Special Schedules": "বিশেষ রুটিন", "Substitutes": "বদলি শিক্ষক",
  "Subject Mapping": "বিষয় বিন্যাস", "Quizzes & Coursework": "কুইজ ও কোর্সওয়ার্ক",
  "Seat Plan": "আসন বিন্যাস", "Textbooks & Clubs": "পাঠ্যবই ও ক্লাব", "Board & Stipend": "বোর্ড ও উপবৃত্তি",
  "Report Library": "রিপোর্ট লাইব্রেরি", "General": "সাধারণ", "Approval Rules": "অনুমোদনের নিয়ম", "Integrations & API": "ইন্টিগ্রেশন ও এপিআই",
  "My Account & Devices": "আমার অ্যাকাউন্ট ও ডিভাইস", "Exports": "এক্সপোর্ট", "Moderation": "মডারেশন", "Hifz Targets": "হিফজ লক্ষ্য",
  "Class Routine": "ক্লাস রুটিন", "Fee Collection": "ফি আদায়", "Institution overview": "প্রতিষ্ঠানের সারসংক্ষেপ",
};

export const DICTIONARIES = { bn: BN, en: {} };

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export function toBnDigits(value) {
  return String(value ?? "").replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function translate(lang, key) {
  return (DICTIONARIES[lang] && DICTIONARIES[lang][key]) || key;
}

export const I18nContext = createContext({ lang: "en", t: (k) => k, digits: (v) => v, setLang: () => {} });
export function useI18n() {
  return useContext(I18nContext);
}

// Bangla (Bangabda) date per the 2019 revised Bangladesh calendar (v1 PC-26):
// 1 Boishakh = 14 April; Boishakh–Ashwin 31 days, Kartik–Magh 30, Falgun 29 (30 in a
// Gregorian leap year), Chaitra 30.
const BN_MONTHS = ["বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"];
const BN_MONTHS_EN = ["Boishakh", "Joishtho", "Asharh", "Srabon", "Bhadro", "Ashwin", "Kartik", "Ogrohayon", "Poush", "Magh", "Falgun", "Choitro"];
export function toBanglaDate(input = new Date(), lang = "bn") {
  const d = new Date(input);
  const y = d.getFullYear();
  const startYear = d >= new Date(y, 3, 14) ? y : y - 1;
  let days = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(startYear, 3, 14)) / 86400000);
  const next = startYear + 1;
  const leap = (next % 4 === 0 && next % 100 !== 0) || next % 400 === 0;
  const lengths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, leap ? 30 : 29, 30];
  let m = 0;
  while (m < 11 && days >= lengths[m]) { days -= lengths[m]; m += 1; }
  const day = days + 1;
  const year = startYear - 593;
  return lang === "bn" ? `${toBnDigits(day)} ${BN_MONTHS[m]} ${toBnDigits(year)} বঙ্গাব্দ` : `${day} ${BN_MONTHS_EN[m]} ${year} BS`;
}

export function toHijriDate(input = new Date(), lang = "bn") {
  try {
    const parts = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).formatToParts(new Date(input));
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    return `${get("day")} ${get("month")} ${get("year")} ${lang === "bn" ? "হিজরি" : "AH"}`;
  } catch {
    return "";
  }
}
