import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/motion.dart';
import '../../core/theme.dart';
import '../../l10n/l10n_ext.dart';
import '../../models/campus.dart';
import '../../models/child.dart';
import '../../providers/family_provider.dart';
import '../../services/api_exception.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Parent–teacher meetings (SB-09): the guardian's bookings and the free
/// slots teachers have published; book for a child or release a booking.
class PtmScreen extends StatefulWidget {
  const PtmScreen({super.key, this.initialStudentId});

  final String? initialStudentId;

  @override
  State<PtmScreen> createState() => _PtmScreenState();
}

class _PtmScreenState extends State<PtmScreen> {
  int _version = 0;
  bool _busy = false;

  void _reload() => setState(() => _version++);

  Future<void> _book(PtmSlot slot) async {
    final l = context.l10n;
    final children = context.read<FamilyProvider>().children;
    if (children.isEmpty) return;
    final child = await showDialog<ChildSummary>(
      context: context,
      builder: (ctx) => _BookDialog(
        slot: slot,
        children: children,
        initialId: widget.initialStudentId,
      ),
    );
    if (child == null || !mounted) return;
    await _run(
      () => context.read<GuardianService>().bookPtm(slot.id, child.id),
      l.meetingBooked,
    );
  }

  Future<void> _cancel(PtmSlot slot) async {
    final l = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.cancelMeetingTitle),
        content: Text(l.cancelMeetingBody(slot.teacherName)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l.keepBooking),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l.cancelBooking),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _run(
      () => context.read<GuardianService>().cancelPtm(slot.id),
      l.meetingCancelled,
    );
  }

  Future<void> _run(Future<void> Function() action, String done) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(done)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        _reload();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final service = context.read<GuardianService>();
    final names = {
      for (final c in context.watch<FamilyProvider>().children) c.id: c.name,
    };
    return Scaffold(
      appBar: AppBar(title: Text(l.parentTeacherMeeting)),
      body: AsyncView<List<PtmSlot>>(
        key: ValueKey(_version),
        load: service.ptmSlots,
        builder: (context, slots, reload) {
          final mine = slots.where((s) => s.mine).toList();
          final free = slots.where((s) => s.available).toList();
          final byDate = <DateTime?, List<PtmSlot>>{};
          for (final s in free) {
            byDate.putIfAbsent(s.date, () => []).add(s);
          }
          return RefreshIndicator(
            onRefresh: reload,
            child: StaggeredListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (_busy) const LinearProgressIndicator(),
                SectionTitle(l.myBookings),
                if (mine.isEmpty)
                  Card(
                    child: EmptyView(
                      title: l.noBookings,
                      icon: Icons.event_available_outlined,
                    ),
                  )
                else
                  for (final s in mine)
                    Card(
                      child: ListTile(
                        leading: const Icon(
                          Icons.event_available_rounded,
                          color: AppColors.success,
                        ),
                        title: Text(
                          s.teacherName,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: Text(
                          [
                            '${Fmt.date(s.date)} • ${Fmt.clock(s.startTime)} – ${Fmt.clock(s.endTime)}',
                            if (names[s.studentId] != null)
                              l.bookedFor(names[s.studentId]!),
                          ].join('\n'),
                        ),
                        isThreeLine: names[s.studentId] != null,
                        trailing: s.status == 'Booked'
                            ? TextButton(
                                onPressed: _busy ? null : () => _cancel(s),
                                child: Text(l.cancel),
                              )
                            : StatusChip(l.word(s.status)),
                      ),
                    ),
                SectionTitle(l.availableSlots),
                if (free.isEmpty)
                  Card(
                    child: EmptyView(
                      title: l.noFreeSlots,
                      subtitle: l.noFreeSlotsHint,
                      icon: Icons.event_busy_outlined,
                    ),
                  )
                else
                  for (final entry in byDate.entries)
                    SectionCard(
                      title: Fmt.date(entry.key),
                      icon: Icons.calendar_today_outlined,
                      padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
                      child: Column(
                        children: [
                          for (final s in entry.value)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(s.teacherName),
                              subtitle: Text(
                                '${Fmt.clock(s.startTime)} – ${Fmt.clock(s.endTime)}',
                              ),
                              trailing: FilledButton.tonal(
                                onPressed: _busy ? null : () => _book(s),
                                child: Text(l.book),
                              ),
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

class _BookDialog extends StatefulWidget {
  const _BookDialog({
    required this.slot,
    required this.children,
    this.initialId,
  });

  final PtmSlot slot;
  final List<ChildSummary> children;
  final String? initialId;

  @override
  State<_BookDialog> createState() => _BookDialogState();
}

class _BookDialogState extends State<_BookDialog> {
  late String _id = widget.children
      .firstWhere(
        (c) => c.id == widget.initialId,
        orElse: () => widget.children.first,
      )
      .id;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final s = widget.slot;
    return AlertDialog(
      title: Text(l.bookMeetingTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${s.teacherName}\n${Fmt.date(s.date)} • ${Fmt.clock(s.startTime)} – ${Fmt.clock(s.endTime)}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          if (widget.children.length > 1) ...[
            const SizedBox(height: 12),
            Text(
              l.meetingAbout,
              style: const TextStyle(color: AppColors.muted),
            ),
            RadioGroup<String>(
              groupValue: _id,
              onChanged: (v) => setState(() => _id = v ?? _id),
              child: Column(
                children: [
                  for (final c in widget.children)
                    RadioListTile<String>(
                      contentPadding: EdgeInsets.zero,
                      value: c.id,
                      title: Text(c.name),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l.cancel),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(
            context,
            widget.children.firstWhere((c) => c.id == _id),
          ),
          child: Text(l.book),
        ),
      ],
    );
  }
}
