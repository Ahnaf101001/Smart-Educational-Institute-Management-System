import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../providers/family_provider.dart';
import '../../widgets/async_view.dart';
import '../../widgets/child_selector.dart';
import '../../widgets/common.dart';
import '../academics/academics_screen.dart';
import '../attendance/attendance_screen.dart';
import '../exams/exams_screen.dart';
import '../fees/fees_screen.dart';
import '../notifications/notifications_screen.dart';
import '../support/complaint_screen.dart';
import '../support/documents_screen.dart';
import '../support/leave_screen.dart';
import '../support/teachers_screen.dart';
import '../transport/transport_screen.dart';
import 'student_profile_screen.dart';

/// Part B – Individual Student Dashboard. Everything here belongs to the
/// child picked in the Child Selector; switching child switches all data.
class ChildDashboardScreen extends StatelessWidget {
  const ChildDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final family = context.watch<FamilyProvider>();
    final child = family.selectedChild;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Student Dashboard'),
        bottom: child == null
            ? null
            : const PreferredSize(
                preferredSize: Size.fromHeight(70),
                child: Padding(padding: EdgeInsets.fromLTRB(16, 0, 16, 12), child: ChildSelector(dark: true)),
              ),
      ),
      body: Builder(builder: (context) {
        if (family.overview == null && family.loading) return const LoadingView();
        if (family.overview == null) return ErrorView(message: family.error ?? 'Could not load your children.', onRetry: family.load);
        if (child == null) {
          return const EmptyView(title: 'No linked students', subtitle: 'Ask the school office to link your children to this account.', icon: Icons.link_off);
        }
        return RefreshIndicator(
          onRefresh: family.load,
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 32), children: [
            Text('${child.name} — Selected Student Dashboard', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.navy)),
            const SizedBox(height: 12),
            StatGrid(children: [
              StatTile(
                label: 'Attendance',
                value: Fmt.percent(child.monthAttendancePercentage),
                caption: 'Monthly attendance',
                icon: Icons.fact_check_outlined,
                color: AppColors.success,
                onTap: () => _open(context, AttendanceScreen(child: child)),
              ),
              StatTile(
                label: 'Fee Due',
                value: child.canViewFees ? Fmt.money(child.feeDue) : '—',
                caption: 'Outstanding amount',
                icon: Icons.account_balance_wallet_outlined,
                color: child.feeDue > 0 ? AppColors.danger : AppColors.navy,
                onTap: () => _open(context, FeesScreen(child: child)),
              ),
              StatTile(
                label: 'Homework',
                value: '${child.homeworkCount}',
                caption: 'Pending assignments',
                icon: Icons.menu_book_rounded,
                color: AppColors.warning,
                onTap: () => _open(context, AcademicsScreen(child: child, initialTab: 1)),
              ),
              StatTile(
                label: 'Latest Result',
                value: child.canViewResults ? (child.latestResultGrade ?? '—') : '—',
                caption: child.latestResultExam ?? 'Last published result',
                icon: Icons.emoji_events_outlined,
                color: AppColors.blue,
                onTap: () => _open(context, ExamsScreen(child: child, initialTab: 1)),
              ),
            ]),
            const SizedBox(height: 12),
            _TodayCard(child: child),
            const SectionTitle('Modules'),
            _ModuleGrid(items: [
              _Module('Profile', Icons.badge_outlined, () => _open(context, StudentProfileScreen(child: child))),
              _Module('Attendance', Icons.fact_check_outlined, () => _open(context, AttendanceScreen(child: child))),
              _Module('Fees', Icons.payments_outlined, () => _open(context, FeesScreen(child: child))),
              _Module('Exam & Results', Icons.emoji_events_outlined, () => _open(context, ExamsScreen(child: child))),
              _Module('Homework', Icons.menu_book_rounded, () => _open(context, AcademicsScreen(child: child, initialTab: 1))),
              _Module('Routine', Icons.schedule_rounded, () => _open(context, AcademicsScreen(child: child))),
              _Module('Calendar', Icons.event_note_outlined, () => _open(context, AcademicsScreen(child: child, initialTab: 2))),
              _Module('Notices', Icons.campaign_outlined, () => _open(context, NotificationsScreen(studentId: child.id, studentName: child.name))),
              _Module('Transport', Icons.directions_bus_outlined, () => _open(context, TransportScreen(child: child))),
              _Module('Leave', Icons.event_busy_outlined, () => _open(context, LeaveScreen(child: child))),
              _Module('Progress Report', Icons.insights_outlined, () => _open(context, ExamsScreen(child: child, initialTab: 2))),
              _Module('Teachers', Icons.co_present_outlined, () => _open(context, TeachersScreen(child: child))),
              _Module('Documents', Icons.folder_outlined, () => _open(context, DocumentsScreen(child: child))),
              _Module('Feedback', Icons.forum_outlined, () => _open(context, ComplaintScreen(initialStudentId: child.id))),
            ]),
          ]),
        );
      }),
    );
  }

  static void _open(BuildContext context, Widget screen) => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => screen));
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) => SectionCard(
        title: 'Today',
        icon: Icons.today_outlined,
        child: Column(children: [
          Row(children: [
            const Text('Attendance', style: TextStyle(color: AppColors.muted)),
            const Spacer(),
            StatusChip(child.todayAttendance ?? 'Not marked yet', color: child.todayAttendance == null ? AppColors.muted : null),
          ]),
          if (child.todayInTime != null || child.todayOutTime != null) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.login_rounded, size: 16, color: AppColors.success),
              const SizedBox(width: 4),
              Text('Entry ${Fmt.time(child.todayInTime)}'),
              const SizedBox(width: 16),
              const Icon(Icons.logout_rounded, size: 16, color: AppColors.warning),
              const SizedBox(width: 4),
              Text('Exit ${child.todayOutTime == null ? '—' : Fmt.time(child.todayOutTime)}'),
            ]),
          ],
          if (child.nextExamName != null) ...[
            const Divider(height: 20),
            Row(children: [
              const Icon(Icons.event, size: 18, color: AppColors.navy),
              const SizedBox(width: 8),
              Expanded(child: Text('Next exam: ${child.nextExamSubject ?? ''} – ${child.nextExamName}')),
              Text(Fmt.date(child.nextExamDate), style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
          ],
          if (child.classTeacher != null) ...[
            const Divider(height: 20),
            Row(children: [
              const Icon(Icons.person_pin_outlined, size: 18, color: AppColors.navy),
              const SizedBox(width: 8),
              Expanded(child: Text('Class teacher: ${child.classTeacher}')),
            ]),
          ],
        ]),
      );
}

class _Module {
  const _Module(this.label, this.icon, this.onTap);

  final String label;
  final IconData icon;
  final VoidCallback onTap;
}

class _ModuleGrid extends StatelessWidget {
  const _ModuleGrid({required this.items});

  final List<_Module> items;

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, c) {
        final columns = c.maxWidth > 700 ? 6 : (c.maxWidth > 420 ? 4 : 3);
        final width = (c.maxWidth - (columns - 1) * 10) / columns;
        return Wrap(spacing: 10, runSpacing: 10, children: [
          for (final m in items)
            SizedBox(
              width: width,
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: m.onTap,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
                    child: Column(children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: AppColors.surfaceTint, borderRadius: BorderRadius.circular(12)),
                        child: Icon(m.icon, color: AppColors.navy),
                      ),
                      const SizedBox(height: 8),
                      Text(m.label, textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ]),
                  ),
                ),
              ),
            ),
        ]);
      });
}
