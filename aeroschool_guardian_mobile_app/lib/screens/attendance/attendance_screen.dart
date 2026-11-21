import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/student.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Attendance (spec §D): daily status, monthly report, late arrival, early
/// leave, school entry/exit times, history and percentage.
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key, required this.child});

  final ChildSummary child;

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  void _shift(int delta) {
    final next = DateTime(_month.year, _month.month + delta);
    final now = DateTime.now();
    if (next.isAfter(DateTime(now.year, now.month))) return;
    setState(() => _month = next);
  }

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final monthKey = Fmt.month(_month);
    final isCurrent = monthKey == Fmt.month(DateTime.now());
    return Scaffold(
      appBar: AppBar(title: Text('Attendance – ${widget.child.name}')),
      body: Column(children: [
        Material(
          color: Colors.white,
          child: Row(children: [
            IconButton(onPressed: () => _shift(-1), icon: const Icon(Icons.chevron_left)),
            Expanded(child: Text(Fmt.monthLabel(monthKey), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800))),
            IconButton(onPressed: isCurrent ? null : () => _shift(1), icon: const Icon(Icons.chevron_right)),
          ]),
        ),
        Expanded(
          child: AsyncView<AttendanceReport>(
            key: ValueKey(monthKey),
            load: () => service.attendance(widget.child.id, monthKey),
            builder: (context, r, reload) => RefreshIndicator(
              onRefresh: reload,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                _Summary(report: r),
                const SizedBox(height: 12),
                SectionCard(title: 'Monthly Calendar', icon: Icons.calendar_month_outlined, child: _MonthGrid(month: _month, records: r.records)),
                const SectionTitle('Daily Attendance'),
                Card(
                  child: r.records.isEmpty
                      ? const EmptyView(title: 'No attendance recorded this month', icon: Icons.event_busy_outlined)
                      : Column(children: [
                          for (final rec in r.records.reversed)
                            ListTile(
                              leading: CircleAvatar(
                                backgroundColor: StatusChip.colorFor(rec.status).withValues(alpha: 0.12),
                                child: Text('${rec.date.day}', style: TextStyle(color: StatusChip.colorFor(rec.status), fontWeight: FontWeight.w800)),
                              ),
                              title: Text(Fmt.date(rec.date), style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: rec.inTime == null && rec.outTime == null
                                  ? null
                                  : Text('Entry ${Fmt.time(rec.inTime)} • Exit ${rec.outTime == null ? '—' : Fmt.time(rec.outTime)}'),
                              trailing: StatusChip(rec.status),
                            ),
                        ]),
                ),
                const SectionTitle('Attendance History'),
                Card(
                  child: r.history.isEmpty
                      ? const EmptyView(title: 'No history yet')
                      : Column(children: [
                          for (final h in r.history)
                            ListTile(
                              title: Text(Fmt.monthLabel(h.month), style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text('${h.present} present • ${h.absent} absent • ${h.late} late'),
                              trailing: Text(Fmt.percent(h.percentage),
                                  style: TextStyle(fontWeight: FontWeight.w800, color: _pctColor(h.percentage))),
                            ),
                        ]),
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }

  static Color _pctColor(num? p) => p == null ? AppColors.muted : (p >= 90 ? AppColors.success : p >= 80 ? AppColors.blue : AppColors.danger);
}

class _Summary extends StatelessWidget {
  const _Summary({required this.report});

  final AttendanceReport report;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Row(children: [
              const Text('Attendance percentage', style: TextStyle(color: AppColors.muted)),
              const Spacer(),
              Text(Fmt.percent(report.percentage), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.navy)),
            ]),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: report.percentage == null ? 0 : (report.percentage! / 100).clamp(0, 1).toDouble(),
                minHeight: 10,
                backgroundColor: AppColors.surfaceTint,
                color: AppColors.success,
              ),
            ),
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _pill('Present', report.present, AppColors.success),
              _pill('Absent', report.absent, AppColors.danger),
              _pill('Late', report.late, AppColors.warning),
              _pill('Leave', report.leave, const Color(0xFF7C3AED)),
              _pill('Early leave', report.earlyLeave, AppColors.info),
              _pill('School days', report.total, AppColors.navy),
            ]),
          ]),
        ),
      );

  Widget _pill(String label, int value, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
        child: Text('$label: $value', style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13)),
      );
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({required this.month, required this.records});

  final DateTime month;
  final List<AttendanceRecord> records;

  @override
  Widget build(BuildContext context) {
    final byDay = {for (final r in records) r.date.day: r.status};
    final days = DateTime(month.year, month.month + 1, 0).day;
    final leading = DateTime(month.year, month.month, 1).weekday % 7; // Sunday-first
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return Column(children: [
      Row(children: [for (final l in labels) Expanded(child: Center(child: Text(l, style: const TextStyle(color: AppColors.muted, fontWeight: FontWeight.w700))))]),
      const SizedBox(height: 6),
      GridView.count(
        crossAxisCount: 7,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 4,
        crossAxisSpacing: 4,
        children: [
          for (var i = 0; i < leading; i++) const SizedBox.shrink(),
          for (var d = 1; d <= days; d++)
            Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: byDay[d] == null ? AppColors.background : StatusChip.colorFor(byDay[d]!).withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('$d', style: TextStyle(color: byDay[d] == null ? AppColors.muted : Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
            ),
        ],
      ),
      const SizedBox(height: 10),
      Wrap(spacing: 12, runSpacing: 4, children: [
        for (final s in const ['Present', 'Absent', 'Late', 'Leave'])
          Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 10, height: 10, decoration: BoxDecoration(color: StatusChip.colorFor(s), shape: BoxShape.circle)),
            const SizedBox(width: 4),
            Text(s, style: const TextStyle(fontSize: 12)),
          ]),
      ]),
    ]);
  }
}
