import 'package:material_ui/material_ui.dart';

import '../../core/motion.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/family.dart';
import '../../providers/family_provider.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../fees/fees_screen.dart';
import '../gallery/gallery_screen.dart';
import '../support/ptm_screen.dart';
import 'family_calendar_screen.dart';
import '../notices/notice_detail_screen.dart';

/// Part A – Family Overview: guardian profile, total children, child-wise
/// attendance, today's routine, upcoming exams, pending homework, monthly
/// fee summary with per-student breakdown, notices and notifications.
class FamilyDashboardScreen extends StatelessWidget {
  const FamilyDashboardScreen({
    super.key,
    required this.onOpenChild,
    required this.onOpenNotifications,
  });

  final void Function(String childId) onOpenChild;
  final VoidCallback onOpenNotifications;

  String _greeting(BuildContext context) {
    final h = DateTime.now().hour;
    if (h < 12) return context.l10n.greetMorning;
    if (h < 17) return context.l10n.greetAfternoon;
    return context.l10n.greetEvening;
  }

  @override
  Widget build(BuildContext context) {
    final family = context.watch<FamilyProvider>();
    final o = family.overview;
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.dashTitle),
        bottom: const PreferredSize(
          preferredSize: Size.zero,
          child: LiveSyncBanner(),
        ),
      ),
      body: Builder(
        builder: (context) {
          if (o == null && family.loading) {
            return LoadingView(message: context.l10n.loadingFamilyOverview);
          }
          if (o == null) {
            return ErrorView(
              message: family.error ?? context.l10n.couldNotLoadDashboard,
              onRetry: family.load,
            );
          }
          return RefreshIndicator(
            onRefresh: family.load,
            child: StaggeredListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                _GuardianHeader(overview: o, greeting: _greeting(context)),
                const SizedBox(height: 14),
                StatGrid(
                  children: [
                    StatTile(
                      label: context.l10n.statTotalChildren,
                      value: '${o.children.length}',
                      icon: Icons.family_restroom_rounded,
                    ),
                    StatTile(
                      label: context.l10n.statPresentToday,
                      value: '${o.presentToday}/${o.children.length}',
                      icon: Icons.how_to_reg_rounded,
                      color: AppColors.success,
                      caption: o.absentToday > 0
                          ? context.l10n.absentCount(o.absentToday)
                          : null,
                    ),
                    StatTile(
                      label: context.l10n.statTotalDue,
                      value: Fmt.money(o.totalDue),
                      icon: Icons.account_balance_wallet_outlined,
                      color: o.totalDue > 0
                          ? AppColors.danger
                          : AppColors.success,
                    ),
                    StatTile(
                      label: context.l10n.statPendingHomework,
                      value: '${o.pendingHomework}',
                      icon: Icons.menu_book_rounded,
                      color: AppColors.warning,
                    ),
                  ],
                ),
                if (o.notices.any((n) => n.isUrgent)) ...[
                  const SizedBox(height: 14),
                  for (final n in o.notices.where((n) => n.isUrgent).take(2))
                    _UrgentBanner(notice: n),
                ],
                if (o.children.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const _QuickActions(),
                ],
                SectionTitle(context.l10n.myChildren(o.children.length)),
                if (o.children.isEmpty)
                  Card(
                    child: EmptyView(
                      title: context.l10n.noLinkedStudents,
                      subtitle: context.l10n.noLinkedStudentsHint,
                      icon: Icons.link_off,
                    ),
                  )
                else
                  for (final c in o.children) ...[
                    Pressable(
                      child: _ChildCard(
                        child: c,
                        onTap: () => onOpenChild(c.id),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                if (o.children.isNotEmpty) ...[
                  SectionTitle(context.l10n.childWiseAttendance),
                  SectionCard(
                    title: context.l10n.thisMonth,
                    icon: Icons.fact_check_outlined,
                    child: Column(
                      children: [
                        for (final c in o.children) _AttendanceLine(child: c),
                      ],
                    ),
                  ),
                  SectionTitle(context.l10n.todaysRoutine),
                  for (final c in o.children) ...[
                    _TodayRoutine(child: c),
                    const SizedBox(height: 10),
                  ],
                  SectionTitle(context.l10n.monthlyFeeSummary),
                  _FeeSummary(overview: o),
                ],
                SectionTitle(context.l10n.upcomingExams),
                Card(
                  child: o.upcomingExams.isEmpty
                      ? EmptyView(
                          title: context.l10n.noUpcomingExams,
                          icon: Icons.event_available_outlined,
                        )
                      : Column(
                          children: [
                            for (final e in o.upcomingExams.take(6))
                              ListTile(
                                leading: _DateBadge(date: e.date),
                                title: Text(
                                  '${e.subjectName} – ${e.examName}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text(
                                  [
                                    e.studentName,
                                    if (e.startTime != null)
                                      Fmt.clock(e.startTime),
                                    if (e.room != null)
                                      context.l10n.roomNo(e.room ?? ''),
                                  ].join(' • '),
                                ),
                                onTap: () => onOpenChild(e.studentId),
                              ),
                          ],
                        ),
                ),
                SectionTitle(
                  context.l10n.recentNotices,
                  trailing: o.notices.isEmpty
                      ? null
                      : Text(
                          '${o.notices.length}',
                          style: const TextStyle(color: AppColors.muted),
                        ),
                ),
                Card(
                  child: o.notices.isEmpty
                      ? EmptyView(
                          title: context.l10n.noNotices,
                          icon: Icons.campaign_outlined,
                        )
                      : StaggeredColumn(
                          children: [
                            for (final n in o.notices.take(5))
                              ListTile(
                                leading: Icon(
                                  n.isUrgent
                                      ? Icons.priority_high_rounded
                                      : Icons.campaign_outlined,
                                  color: n.isUrgent
                                      ? AppColors.danger
                                      : AppColors.navy,
                                ),
                                title: Text(
                                  n.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text(
                                  n.message,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: Text(
                                  Fmt.shortDate(n.createdAt),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.muted,
                                  ),
                                ),
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute<void>(
                                    builder: (_) =>
                                        NoticeDetailScreen(notice: n),
                                  ),
                                ),
                              ),
                          ],
                        ),
                ),
                SectionTitle(
                  context.l10n.importantNotifications,
                  trailing: TextButton(
                    onPressed: onOpenNotifications,
                    child: Text(context.l10n.viewAll),
                  ),
                ),
                Card(
                  child: o.recentNotifications.isEmpty
                      ? EmptyView(
                          title: context.l10n.noNotifications,
                          icon: Icons.notifications_none_rounded,
                        )
                      : Column(
                          children: [
                            for (final n in o.recentNotifications)
                              ListTile(
                                leading: Icon(
                                  Icons.circle,
                                  size: 10,
                                  color: n.isUnread
                                      ? AppColors.blue
                                      : AppColors.border,
                                ),
                                title: Text(
                                  n.studentName != null
                                      ? '${n.studentName}: ${n.title}'
                                      : n.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                subtitle: Text(
                                  n.body,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: Text(
                                  Fmt.relative(n.createdAt),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.muted,
                                  ),
                                ),
                                onTap: onOpenNotifications,
                              ),
                          ],
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _GuardianHeader extends StatelessWidget {
  const _GuardianHeader({required this.overview, required this.greeting});

  final FamilyOverview overview;
  final String greeting;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppColors.navy, Color(0xFF1B5A96)],
      ),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      children: [
        PersonAvatar(name: overview.guardianName, radius: 26),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${greeting.toUpperCase()}, ${context.l10n.word(overview.relation ?? 'Parent').toUpperCase()}',
                style: const TextStyle(
                  color: Color(0xFFBFD3EA),
                  fontSize: 11,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                overview.guardianName,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (overview.guardianMobile != null)
                Text(
                  overview.guardianMobile!,
                  style: const TextStyle(color: Color(0xFFDCE7F5)),
                ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _UrgentBanner extends StatelessWidget {
  const _UrgentBanner({required this.notice});

  final Notice notice;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Material(
      color: const Color(0xFFFEF2F2),
      borderRadius: BorderRadius.circular(12),
      child: ListTile(
        leading: const Icon(
          Icons.warning_amber_rounded,
          color: AppColors.danger,
        ),
        title: Text(
          notice.title,
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            color: AppColors.danger,
          ),
        ),
        subtitle: Text(
          notice.message,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute<void>(
            builder: (_) => NoticeDetailScreen(notice: notice),
          ),
        ),
      ),
    ),
  );
}

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.child, required this.onTap});

  final ChildSummary child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                PersonAvatar(
                  name: child.name,
                  photoUrl: child.photoUrl,
                  radius: 24,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        child.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        child.classLine,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 4),
                      _LinkedBadge(child: child),
                    ],
                  ),
                ),
                StatusChip(
                  child.todayAttendance ?? context.l10n.notMarked,
                  color: child.todayAttendance == null ? AppColors.muted : null,
                ),
              ],
            ),
            const Divider(height: 22),
            Row(
              children: [
                _Mini(
                  label: context.l10n.attendance,
                  value: Fmt.percent(child.monthAttendancePercentage),
                ),
                _Mini(
                  label: context.l10n.feeDue,
                  value: child.canViewFees ? Fmt.money(child.feeDue) : '—',
                  danger: child.feeDue > 0,
                ),
                _Mini(
                  label: context.l10n.homework,
                  value: '${child.homeworkCount}',
                ),
                _Mini(
                  label: context.l10n.latestResult,
                  value: child.canViewResults
                      ? (child.latestResultGrade ?? '—')
                      : '—',
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

/// UI-04: shows that the child is linked to this guardian account, with the relation.
class _LinkedBadge extends StatelessWidget {
  const _LinkedBadge({required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final parts = [
      l.linked,
      if (child.relation != null) l.word(child.relation!),
      if (child.isPrimary) l.primaryGuardian,
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.link_rounded, size: 14, color: AppColors.success),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              parts.join(' • '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.success,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Family-wide shortcuts: merged calendar, gallery and parent–teacher meetings.
class _QuickActions extends StatelessWidget {
  const _QuickActions();

  void _open(BuildContext context, Widget screen) =>
      Navigator.push(context, MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final items = [
      (
        l.familyCalendar,
        Icons.calendar_month_outlined,
        () => _open(context, const FamilyCalendarScreen()),
      ),
      (
        l.photoGallery,
        Icons.photo_library_outlined,
        () => _open(context, const GalleryScreen()),
      ),
      (
        l.meetings,
        Icons.handshake_outlined,
        () => _open(context, const PtmScreen()),
      ),
    ];
    return Row(
      children: [
        for (final (i, item) in items.indexed) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: item.$3,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: 12,
                    horizontal: 6,
                  ),
                  child: Column(
                    children: [
                      Icon(item.$2, color: AppColors.navy),
                      const SizedBox(height: 6),
                      Text(
                        item.$1,
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
      ],
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini({required this.label, required this.value, this.danger = false});

  final String label;
  final String value;
  final bool danger;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: danger ? AppColors.danger : AppColors.navy,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.muted),
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}

class _AttendanceLine extends StatelessWidget {
  const _AttendanceLine({required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) {
    final pct = child.monthAttendancePercentage;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  child.name,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                child.monthTotal == 0
                    ? context.l10n.noRecords
                    : context.l10n.daysPresentOf(
                        '${child.monthPresent}',
                        '${child.monthTotal}',
                        Fmt.percent(pct),
                      ),
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: AnimatedProgressBar(
              value: pct == null ? 0 : (pct / 100).clamp(0, 1).toDouble(),
              minHeight: 8,
              backgroundColor: AppColors.surfaceTint,
              color: pct == null
                  ? AppColors.border
                  : (pct >= 90
                        ? AppColors.success
                        : pct >= 80
                        ? AppColors.blue
                        : AppColors.danger),
            ),
          ),
        ],
      ),
    );
  }
}

class _TodayRoutine extends StatelessWidget {
  const _TodayRoutine({required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) => Card(
    child: ExpansionTile(
      shape: const Border(),
      title: Text(
        child.name,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        child.todayRoutine.isEmpty
            ? context.l10n.noClassesToday
            : '${child.todayRoutine.where((r) => !r.isBreak).length} classes today',
      ),
      children: [
        for (final r in child.todayRoutine)
          ListTile(
            dense: true,
            leading: Text(
              r.start == null ? (r.period ?? '') : Fmt.clock(r.start),
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
            ),
            title: Text(
              r.subject,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: r.isBreak ? AppColors.muted : null,
              ),
            ),
            subtitle: r.isBreak
                ? null
                : Text(
                    [
                      r.teacher,
                      if (r.room != null) context.l10n.roomNo(r.room ?? ''),
                    ].whereType<String>().join(' • '),
                  ),
          ),
      ],
    ),
  );
}

class _FeeSummary extends StatelessWidget {
  const _FeeSummary({required this.overview});

  final FamilyOverview overview;

  /// Children whose dues this guardian may see and pay (per-child, never merged).
  List<ChildSummary> get _payable =>
      overview.children.where((c) => c.canViewFees && c.feeDue > 0).toList();

  static void _pay(BuildContext context, ChildSummary c) => Navigator.push(
    context,
    MaterialPageRoute<void>(builder: (_) => FeesScreen(child: c)),
  );

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              // _Mini is already an Expanded.
              _Mini(
                label: context.l10n.thisMonthBilled,
                value: Fmt.money(overview.monthFeeTotal),
              ),
              _Mini(
                label: context.l10n.totalOutstanding,
                value: Fmt.money(overview.totalDue),
                danger: overview.totalDue > 0,
              ),
            ],
          ),
          const Divider(height: 24),
          // Per-student breakdown: one child's dues are never merged with another's.
          for (final c in overview.children) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(child: Text(c.name)),
                  if (!c.canViewFees)
                    Text(
                      context.l10n.notShared,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    )
                  else
                    Text(
                      c.feeDue > 0
                          ? context.l10n.amountDue(Fmt.money(c.feeDue))
                          : context.l10n.noDues,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: c.feeDue > 0
                            ? AppColors.danger
                            : AppColors.success,
                      ),
                    ),
                ],
              ),
            ),
            // With several children owing, each pays from their own line.
            if (_payable.length > 1 && _payable.contains(c))
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
                  onPressed: () => _pay(context, c),
                  icon: const Icon(Icons.payments_outlined, size: 18),
                  label: Text(context.l10n.payNow2),
                ),
              ),
          ],
          if (_payable.length == 1) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () => _pay(context, _payable.first),
                icon: const Icon(Icons.payments_outlined),
                label: Text(
                  context.l10n.payNow(Fmt.money(_payable.first.feeDue)),
                ),
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

class _DateBadge extends StatelessWidget {
  const _DateBadge({required this.date});

  final DateTime? date;

  @override
  Widget build(BuildContext context) => Container(
    width: 46,
    padding: const EdgeInsets.symmetric(vertical: 6),
    decoration: BoxDecoration(
      color: AppColors.surfaceTint,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          date == null ? '--' : '${date!.day}',
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            color: AppColors.navy,
          ),
        ),
        Text(
          date == null ? '' : Fmt.shortDate(date).split(' ').last.toUpperCase(),
          style: const TextStyle(fontSize: 10, color: AppColors.muted),
        ),
      ],
    ),
  );
}
