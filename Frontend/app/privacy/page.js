"use client";

// NF-48: privacy policy for the website and the guardian app, in Bangla (default) and English.
// Linked from the app's store listing and from the app's Settings screen.
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import PublicShell, { usePublicInstitute } from "../components/public/PublicShell";
import { Card } from "../components/ui/kit";

const SECTIONS = {
  bn: [
    ["আমরা কোন তথ্য সংগ্রহ করি", [
      "অভিভাবকের নাম, মোবাইল নম্বর, ই-মেইল, ঠিকানা ও পেশা (প্রতিষ্ঠানের অফিস থেকে বা ভর্তি আবেদনে দেওয়া)।",
      "শিক্ষার্থীর প্রোফাইল, উপস্থিতি, ফলাফল, ফি, রুটিন, হোমওয়ার্ক, পরিবহন ও অন্যান্য শিক্ষাসংক্রান্ত রেকর্ড।",
      "অ্যাপে সাইন-ইন করা ডিভাইসের তথ্য (ব্রাউজার / ডিভাইসের ধরন, IP ঠিকানা, শেষ ব্যবহারের সময়) এবং পুশ নোটিফিকেশনের টোকেন।",
      "অনলাইন ভর্তি আবেদনের সাথে জমা দেওয়া ছবি ও কাগজপত্র (জন্মনিবন্ধন, পূর্বের ফলাফল ইত্যাদি)।",
    ]],
    ["তথ্য কীভাবে ব্যবহার করা হয়", [
      "শুধু আপনার সাথে যুক্ত সন্তানের তথ্য আপনাকে দেখানোর জন্য, এবং উপস্থিতি, ফলাফল, ফি ও নোটিশ সম্পর্কে জানানোর জন্য।",
      "ভর্তি আবেদন যাচাই, ফি গ্রহণ ও রসিদ প্রদান, এবং প্রতিষ্ঠানের সাথে যোগাযোগের জন্য।",
      "অ্যাকাউন্টের নিরাপত্তার জন্য (সাইন-ইন ইতিহাস, সন্দেহজনক প্রবেশ শনাক্তকরণ, অডিট লগ)।",
    ]],
    ["তথ্য শেয়ার করা", [
      "আমরা আপনার তথ্য বিক্রি করি না এবং বিজ্ঞাপনের জন্য ব্যবহার করি না।",
      "শুধু প্রয়োজনীয় সেবাদাতার সাথে শেয়ার করা হয়: SMS পাঠানো, অনলাইন পেমেন্ট (bKash, Nagad, SSLCommerz ইত্যাদি) এবং পুশ নোটিফিকেশন – কেবল সেবাটি দেওয়ার জন্য যতটুকু দরকার।",
      "আইন অনুযায়ী সরকারি কর্তৃপক্ষ (যেমন শিক্ষা বোর্ড) চাইলে নির্ধারিত তথ্য দেওয়া হতে পারে।",
    ]],
    ["নিরাপত্তা", [
      "সব যোগাযোগ এনক্রিপ্টেড সংযোগে (HTTPS) হয়; পাসওয়ার্ড এনক্রিপ্ট করে সংরক্ষণ করা হয়।",
      "অ্যাপে সাইন-ইন টোকেন ফোনের সুরক্ষিত স্টোরেজে (Android Keystore / iOS Keychain) রাখা হয়; চাইলে অ্যাপ লক (PIN) চালু করতে পারেন।",
      "প্রতিষ্ঠানের কর্মীরা শুধু তাদের দায়িত্ব অনুযায়ী অনুমতিপ্রাপ্ত তথ্য দেখতে পারেন, এবং প্রতিটি পরিবর্তন অডিট লগে থাকে।",
    ]],
    ["সংরক্ষণের মেয়াদ ও আপনার অধিকার", [
      "শিক্ষার্থী প্রতিষ্ঠানে থাকাকালীন এবং আইনগত প্রয়োজনে এরপর নির্দিষ্ট সময় পর্যন্ত রেকর্ড রাখা হয়।",
      "আপনি অ্যাপের প্রোফাইল থেকে নিজের তথ্য দেখতে ও কিছু তথ্য সংশোধন করতে পারেন; অন্য সংশোধন বা অ্যাকাউন্ট বন্ধের জন্য প্রতিষ্ঠানের অফিসে যোগাযোগ করুন।",
      "অ্যাপের সেটিংস থেকে অন্য ডিভাইসের সাইন-ইন বন্ধ করতে এবং নোটিফিকেশন পছন্দ বদলাতে পারেন।",
    ]],
  ],
  en: [
    ["What we collect", [
      "Guardian name, mobile number, e-mail, address and occupation (given to the school office or in an admission application).",
      "Student profile, attendance, results, fees, routine, homework, transport and other school records.",
      "Information about signed-in devices (browser / device type, IP address, last used) and the push-notification token.",
      "Photos and documents uploaded with an online admission application (birth certificate, previous result, etc.).",
    ]],
    ["How we use it", [
      "To show you the records of the children linked to your account only, and to notify you about attendance, results, fees and notices.",
      "To process admission applications, collect fees and issue receipts, and to communicate with you.",
      "To keep accounts secure (sign-in history, detecting unusual access, audit logs).",
    ]],
    ["Sharing", [
      "We do not sell your data and do not use it for advertising.",
      "Data is shared only with the service providers needed to run the service – SMS delivery, online payment (bKash, Nagad, SSLCommerz, etc.) and push notifications – and only what each one needs.",
      "Records may be provided to government authorities (e.g. the education board) where the law requires it.",
    ]],
    ["Security", [
      "All traffic uses encrypted connections (HTTPS); passwords are stored hashed.",
      "In the app, the sign-in token is kept in the phone's secure storage (Android Keystore / iOS Keychain); you can also turn on an app lock (PIN).",
      "School staff see only what their role allows, and every change is recorded in an audit log.",
    ]],
    ["Retention and your rights", [
      "Records are kept while the student is enrolled and afterwards for as long as the law requires.",
      "You can view your details and correct some of them from the app's profile; for other corrections or to close the account, contact the school office.",
      "From the app's settings you can sign out other devices and change notification preferences.",
    ]],
  ],
};

export default function PrivacyPage() {
  const inst = usePublicInstitute();
  const [lang, setLang] = useState("bn");
  const bn = lang === "bn";
  const school = (bn ? inst?.nameBn || inst?.name : inst?.name) || (bn ? "প্রতিষ্ঠান" : "the institution");
  return (
    <PublicShell title={bn ? "গোপনীয়তা নীতি" : "Privacy policy"}>
      <div lang={lang} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><ShieldCheck className="text-blue-600" /> {bn ? "গোপনীয়তা নীতি" : "Privacy policy"}</h1>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm font-semibold" role="group" aria-label="Language">
            <button type="button" aria-pressed={bn} className={`rounded-lg px-3 py-1.5 ${bn ? "bg-[#223f91] text-white" : "text-slate-600"}`} onClick={() => setLang("bn")}>বাংলা</button>
            <button type="button" aria-pressed={!bn} className={`rounded-lg px-3 py-1.5 ${!bn ? "bg-[#223f91] text-white" : "text-slate-600"}`} onClick={() => setLang("en")}>English</button>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          {bn
            ? `এই নীতি ${school}-এর ওয়েবসাইট, অভিভাবক পোর্টাল এবং AeroSchool Guardian মোবাইল অ্যাপের জন্য প্রযোজ্য।`
            : `This policy covers the website, guardian portal and AeroSchool Guardian mobile app of ${school}.`}
        </p>
        {SECTIONS[lang].map(([heading, points]) => (
          <Card key={heading} title={heading}>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">{points.map((p) => <li key={p}>{p}</li>)}</ul>
          </Card>
        ))}
        <Card title={bn ? "যোগাযোগ" : "Contact"}>
          <p className="text-sm leading-6 text-slate-700">
            {bn ? "গোপনীয়তা সংক্রান্ত প্রশ্ন বা অভিযোগের জন্য প্রতিষ্ঠানের অফিসে যোগাযোগ করুন" : "For privacy questions or complaints, contact the school office"}
            {inst?.phone ? ` · ${inst.phone}` : ""}{inst?.email ? ` · ${inst.email}` : ""}{inst?.address ? ` · ${inst.address}` : ""}
          </p>
        </Card>
      </div>
    </PublicShell>
  );
}
