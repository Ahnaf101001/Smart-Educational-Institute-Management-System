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
  "Leave": "ছুটি", "Academic": "একাডেমিক", "Setup": "সেটআপ", "Calendar": "একাডেমিক ক্যালেন্ডার", "Homework": "হোমওয়ার্ক",
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
