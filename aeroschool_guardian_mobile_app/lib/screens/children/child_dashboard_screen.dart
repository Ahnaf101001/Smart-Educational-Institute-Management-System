import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../l10n/app_localizations.dart';

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
        title: Text(AppLocalizations.of(context).studentDashboard),
        bottom: child == null
            ? null
            : const PreferredSize(
                preferredSize: Size.fromHeight(70),
                child: Padding(
                  padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: ChildSelector(dark: true),
                ),
              ),
      ),
      body: Builder(
        builder: (context) {
          if (family.overview == null && family.loading) {
            return const LoadingView();
          }
          if (family.overview == null) {
            return ErrorView(
              message: family.error ?? context.l10n.couldNotLoadChildren,
              onRetry: family.load,
            );
          }
          if (child == null) {
            return EmptyView(
              title: context.l10n.noLinkedStudents,
              subtitle: context.l10n.askTheSchoolOfficeTo,
              icon: Icons.link_off,
            );
          }
          return RefreshIndicator(
            onRefresh: family.load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Text(
                  AppLocalizations.of(context)
                      .selectedStudentDashboard(child.name),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 12),
                StatGrid(
                  children: [
                    StatTile(
                      label: AppLocalizations.of(context).attendance,
                      value: Fmt.percent(child.monthAttendancePercentage),
                      caption: AppLocalizations.of(context).monthlyAttendance,
                      icon: Icons.fact_check_outlined,
                      color: AppColors.success,
                      onTap: () =>
                          _open(context, AttendanceScreen(child: child)),
                    ),
                    StatTile(
                      label: AppLocalizations.of(context).feeDue,
                      value: child.canViewFees ? Fmt.money(child.feeDue) : '—',
                      caption: AppLocalizations.of(context).outstandingAmount,
                      icon: Icons.account_balance_wallet_outlined,
                      color: child.feeDue > 0
                          ? AppColors.danger
                          : AppColors.navy,
                      onTap: () => _open(context, FeesScreen(child: child)),
                    ),
                    StatTile(
                      label: AppLocalizations.of(context).homework,
                      value: '${child.homeworkCount}',
                      caption: AppLocalizations.of(context).pendingAssignments,
                      icon: Icons.menu_book_rounded,
                      color: AppColors.warning,
                      onTap: () => _open(
                        context,
                        AcademicsScreen(child: child, initialTab: 1),
                      ),
                    ),
                    StatTile(
                      label: AppLocalizations.of(context).latestResult,
                      value: child.canViewResults
                          ? (child.latestResultGrade ?? '—')
                          : '—',
                      caption:
                          child.latestResultExam ??
                          AppLocalizations.of(context).lastPublishedResult,
                      icon: Icons.emoji_events_outlined,
                      color: AppColors.blue,
                      onTap: () => _open(
                        context,
                        ExamsScreen(child: child, initialTab: 1),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _TodayCard(child: child),
                // Everyday tasks first; everything else stays one tap away under "More".
                SectionTitle(context.l10n.everyday),
                _ModuleGrid(
                  items: [
                    _Module(
                      AppLocalizations.of(context).modAttendance,
                      Icons.fact_check_outlined,
                      () => _open(context, AttendanceScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modFees,
                      Icons.payments_outlined,
                      () => _open(context, FeesScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modExams,
                      Icons.emoji_events_outlined,
                      () => _open(context, ExamsScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modHomework,
                      Icons.menu_book_rounded,
                      () => _open(
                        context,
                        AcademicsScreen(child: child, initialTab: 1),
                      ),
                    ),
                    _Module(
                      AppLocalizations.of(context).modRoutine,
                      Icons.schedule_rounded,
                      () => _open(context, AcademicsScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modNotices,
                      Icons.campaign_outlined,
                      () => _open(
                        context,
                        NotificationsScreen(
                          studentId: child.id,
                          studentName: child.name,
                        ),
                      ),
                    ),
                  ],
                ),
                SectionTitle(context.l10n.more),
                _ModuleGrid(
                  items: [
                    _Module(
                      AppLocalizations.of(context).modProfile,
                      Icons.badge_outlined,
                      () => _open(context, StudentProfileScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modCalendar,
                      Icons.event_note_outlined,
                      () => _open(
                        context,
                        AcademicsScreen(child: child, initialTab: 2),
                      ),
                    ),
                    _Module(
                      AppLocalizations.of(context).modTransport,
                      Icons.directions_bus_outlined,
                      () => _open(context, TransportScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modLeave,
                      Icons.event_busy_outlined,
                      () => _open(context, LeaveScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modProgress,
                      Icons.insights_outlined,
                      () => _open(
                        context,
                        ExamsScreen(child: child, initialTab: 2),
                      ),
                    ),
                    _Module(
                      AppLocalizations.of(context).modTeachers,
                      Icons.co_present_outlined,
                      () => _open(context, TeachersScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modDocuments,
                      Icons.folder_outlined,
                      () => _open(context, DocumentsScreen(child: child)),
                    ),
                    _Module(
                      AppLocalizations.of(context).modFeedback,
                      Icons.forum_outlined,
                      () => _open(
                        context,
                        ComplaintScreen(initialStudentId: child.id),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  static void _open(BuildContext context, Widget screen) =>
      Navigator.push(context, MaterialPageRoute<void>(builder: (_) => screen));
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) => SectionCard(
    title: AppLocalizations.of(context).today,
    icon: Icons.today_outlined,
    child: Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                AppLocalizations.of(context).attendance,
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
            Flexible(
              child: StatusChip(
                child.todayAttendance ??
                    AppLocalizations.of(context).notMarkedYet,
                color: child.todayAttendance == null ? AppColors.muted : null,
              ),
            ),
          ],
        ),
        if (child.todayInTime != null || child.todayOutTime != null) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 6,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.login_rounded,
                    size: 16,
                    color: AppColors.success,
                  ),
                  const SizedBox(width: 4),
                  Text(context.l10n.entryAt(Fmt.time(child.todayInTime))),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.logout_rounded,
                    size: 16,
                    color: AppColors.warning,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    context.l10n.exitAt(
                      child.todayOutTime == null
                          ? '—'
                          : Fmt.time(child.todayOutTime),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
        if (child.nextExamName != null) ...[
          const Divider(height: 20),
          Row(
            children: [
              const Icon(Icons.event, size: 18, color: AppColors.navy),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  context.l10n.nextExam(
                    child.nextExamSubject ?? '',
                    child.nextExamName ?? '',
                  ),
                ),
              ),
              Text(
                Fmt.date(child.nextExamDate),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ],
        if (child.classTeacher != null) ...[
          const Divider(height: 20),
          Row(
            children: [
              const Icon(
                Icons.person_pin_outlined,
                size: 18,
                color: AppColors.navy,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  context.l10n.classTeacherName(child.classTeacher ?? ''),
                ),
              ),
            ],
          ),
        ],
      ],
    ),
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
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final columns = c.maxWidth > 700 ? 6 : (c.maxWidth > 420 ? 4 : 3);
      final width = (c.maxWidth - (columns - 1) * 10) / columns;
      return Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final m in items)
            SizedBox(
              width: width,
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: m.onTap,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: 14,
                      horizontal: 6,
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceTint,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(m.icon, color: AppColors.navy),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          m.label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );
}
