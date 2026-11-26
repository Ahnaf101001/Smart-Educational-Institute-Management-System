import 'package:material_ui/material_ui.dart';

import 'app_localizations.dart';

/// Short access to the app strings: `context.l10n.payNow`.
extension L10nContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}

/// Display-only translation of values that also travel as data (statuses,
/// weekdays, categories, validator messages). Code keeps comparing the
/// English value; only the text shown on screen changes. Unknown values are
/// returned unchanged.
extension DataWords on AppLocalizations {
  String word(String value) {
    if (!localeName.startsWith('bn')) return value;
    return _bn[value] ?? _bn[value.toLowerCase()] ?? value;
  }

  /// Three-letter weekday chip label ("Mon"), or the Bangla day name.
  String dayShort(String day) =>
      localeName.startsWith('bn') ? word(day) : day.substring(0, 3);
}

const _bn = <String, String>{
  // Weekdays
  'Saturday': 'শনিবার',
  'Sunday': 'রবিবার',
  'Monday': 'সোমবার',
  'Tuesday': 'মঙ্গলবার',
  'Wednesday': 'বুধবার',
  'Thursday': 'বৃহস্পতিবার',
  'Friday': 'শুক্রবার',
  // Attendance / status values
  'present': 'উপস্থিত',
  'absent': 'অনুপস্থিত',
  'late': 'দেরিতে',
  'leave': 'ছুটি',
  'early leave': 'আগে ছুটি',
  'school days': 'স্কুল দিবস',
  'holiday': 'ছুটির দিন',
  'pending': 'অপেক্ষমাণ',
  'submitted': 'জমা দেওয়া হয়েছে',
  'not submitted': 'জমা দেওয়া হয়নি',
  'overdue': 'মেয়াদোত্তীর্ণ',
  'reviewed': 'পর্যালোচিত',
  'all': 'সব',
  'paid': 'পরিশোধিত',
  'unpaid': 'অপরিশোধিত',
  'partial': 'আংশিক',
  'partially paid': 'আংশিক পরিশোধিত',
  'due': 'বকেয়া',
  'approved': 'অনুমোদিত',
  'rejected': 'প্রত্যাখ্যাত',
  'cancelled': 'বাতিল',
  'open': 'খোলা',
  'in progress': 'প্রক্রিয়াধীন',
  'resolved': 'সমাধান হয়েছে',
  'closed': 'বন্ধ',
  'pass': 'পাস',
  'fail': 'ফেল',
  'valid': 'বৈধ',
  'success': 'সফল',
  'failed': 'ব্যর্থ',
  'active': 'সক্রিয়',
  'inactive': 'নিষ্ক্রিয়',
  'issued': 'ইস্যু করা হয়েছে',
  'published': 'প্রকাশিত',
  'scheduled': 'নির্ধারিত',
  // Notification / complaint categories
  'Attendance': 'উপস্থিতি',
  'Exam': 'পরীক্ষা',
  'Result': 'ফলাফল',
  'Fee': 'ফি',
  'Fees': 'ফি',
  'Homework': 'হোমওয়ার্ক',
  'Transport': 'পরিবহন',
  'Notice': 'নোটিশ',
  'Emergency': 'জরুরি',
  'Event': 'অনুষ্ঠান',
  'Teacher': 'শিক্ষক',
  'Academic': 'শিক্ষা সংক্রান্ত',
  'Facilities': 'সুযোগ-সুবিধা',
  'Safety': 'নিরাপত্তা',
  'Other': 'অন্যান্য',
  'Complaint': 'অভিযোগ',
  'Feedback': 'মতামত',
  // Relations
  'Guardian': 'অভিভাবক',
  'Parent': 'অভিভাবক',
  'Father': 'পিতা',
  'Mother': 'মাতা',
  'Brother': 'ভাই',
  'Sister': 'বোন',
  'Uncle': 'চাচা/মামা',
  'Aunt': 'চাচি/খালা',
  'Grandfather': 'দাদা/নানা',
  'Grandmother': 'দাদি/নানি',
  // Notification preferences
  'Attendance alerts': 'উপস্থিতির সতর্কবার্তা',
  'Exam notifications': 'পরীক্ষার বিজ্ঞপ্তি',
  'Result notifications': 'ফলাফলের বিজ্ঞপ্তি',
  'Fee payment reminders': 'ফি পরিশোধের রিমাইন্ডার',
  'Homework notifications': 'হোমওয়ার্কের বিজ্ঞপ্তি',
  'Transport alerts': 'পরিবহনের সতর্কবার্তা',
  'School notices & events': 'স্কুলের নোটিশ ও অনুষ্ঠান',
  'Also send by SMS (if enabled)': 'এসএমএসেও পাঠান (চালু থাকলে)',
  'Also send by email (if enabled)': 'ইমেইলেও পাঠান (চালু থাকলে)',
  // Messages the app itself raises (network, sign-in); server messages stay as sent.
  'The server is taking too long to respond. Please try again.':
      'সার্ভার সাড়া দিতে দেরি করছে। আবার চেষ্টা করুন।',
  'Cannot reach the school server. Check your internet connection and try again.': 'স্কুলের সার্ভারে সংযোগ করা যাচ্ছে না। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।',
  'Sign-in failed. Please try again.': 'লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।',
  'Enter your current password.': 'আপনার বর্তমান পাসওয়ার্ড লিখুন।',
  'Two-step verification is enabled for this account. Please contact the school to use the guardian app.': 'এই অ্যাকাউন্টে দুই-ধাপের যাচাই চালু আছে। অভিভাবক অ্যাপ ব্যবহারের জন্য স্কুলে যোগাযোগ করুন।',
  'This app is for guardians only. Please use the school web portal for staff accounts.': 'এই অ্যাপ শুধু অভিভাবকদের জন্য। স্টাফ অ্যাকাউন্টের জন্য স্কুলের ওয়েব পোর্টাল ব্যবহার করুন।',
  // Madrasa (Hifz / Salah), library, clubs, pre-school log, meetings, online classes
  'Fajr': 'ফজর',
  'Dhuhr': 'যোহর',
  'Asr': 'আসর',
  'Maghrib': 'মাগরিব',
  'Isha': 'ইশা',
  'Jamaat': 'জামাতে',
  'Alone': 'একাকী',
  'Missed': 'কাযা',
  'Excused': 'অব্যাহতি',
  'Hifz': 'হিফজ',
  'Nazera': 'নাজেরা',
  'returned': 'ফেরত দেওয়া হয়েছে',
  'lost': 'হারানো',
  'House': 'হাউস',
  'Club': 'ক্লাব',
  'ECA': 'সহশিক্ষা',
  'Happy': 'খুশি',
  'Calm': 'শান্ত',
  'Tired': 'ক্লান্ত',
  'Upset': 'মন খারাপ',
  'Unwell': 'অসুস্থ',
  'booked': 'বুক করা',
  'available': 'খালি',
  'completed': 'সম্পন্ন',
  'live': 'লাইভ',
  // Payment gateways and validator messages
  'Card / Mobile banking (SSLCommerz)': 'কার্ড / মোবাইল ব্যাংকিং (SSLCommerz)',
  'Use at least 8 characters.': 'কমপক্ষে ৮টি অক্ষর ব্যবহার করুন।',
  'Use both letters and numbers.': 'অক্ষর ও সংখ্যা দুটোই ব্যবহার করুন।',
};
