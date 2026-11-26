import 'package:material_ui/material_ui.dart';

import '../../core/motion.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/support.dart';
import '../../services/api_exception.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

typedef _LeaveData = ({List<LeaveType> types, List<LeaveRecord> history});

/// Leave application on behalf of the student; decisions go through the
/// school's approval workflow (class teacher / admin).
class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key, required this.child});

  final ChildSummary child;

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  int _version = 0;

  Future<_LeaveData> _load(GuardianService s) async {
    final types = await s.leaveTypes();
    final extras = await s.extras(widget.child.id);
    return (types: types, history: extras.leaves);
  }

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    return Scaffold(
      appBar: AppBar(
        title: Text(
          context.l10n.titleForChild(context.l10n.modLeave, widget.child.name),
        ),
      ),
      body: AsyncView<_LeaveData>(
        key: ValueKey(_version),
        load: () => _load(service),
        builder: (context, d, reload) => RefreshIndicator(
          onRefresh: reload,
          child: StaggeredListView(
            padding: const EdgeInsets.all(16),
            children: [
              _LeaveForm(
                child: widget.child,
                types: d.types,
                onSubmitted: () => setState(() => _version++),
              ),
              SectionTitle(context.l10n.leaveHistory),
              Card(
                child: d.history.isEmpty
                    ? EmptyView(
                        title: context.l10n.noLeaveApplicationsYet,
                        icon: Icons.event_available_outlined,
                      )
                    : Column(
                        children: [
                          for (final (i, l) in d.history.indexed) ...[
                            if (i > 0) const Divider(height: 1),
                            _LeaveCard(
                              leave: l,
                              onChanged: () => setState(() => _version++),
                            ),
                          ],
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One leave application with its status and the actions open to the guardian: reply to a
/// clarification request, withdraw a pending application, and view the approval history.
class _LeaveCard extends StatefulWidget {
  const _LeaveCard({required this.leave, required this.onChanged});

  final LeaveRecord leave;
  final VoidCallback onChanged;

  @override
  State<_LeaveCard> createState() => _LeaveCardState();
}

class _LeaveCardState extends State<_LeaveCard> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, String done) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      showSnack(context, done);
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _withdraw() async {
    final l10n = context.l10n;
    final service = context.read<GuardianService>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.withdrawLeaveTitle),
        content: Text(l10n.withdrawLeaveBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.withdraw),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _run(
      () => service.withdrawLeave(widget.leave.id),
      l10n.leaveWithdrawn,
    );
  }

  Future<void> _respond() async {
    final l10n = context.l10n;
    final service = context.read<GuardianService>();
    final note = await showDialog<String>(
      context: context,
      builder: (_) => const _ReplyDialog(),
    );
    if (note == null || note.isEmpty || !mounted) return;
    await _run(
      () => service.respondToLeave(widget.leave.id, note),
      l10n.responseSent,
    );
  }

  void _showHistory() {
    final steps = widget.leave.history;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            SectionTitle(ctx.l10n.history),
            if (steps.isEmpty)
              EmptyView(title: ctx.l10n.noHistoryYet, icon: Icons.history)
            else
              for (final h in steps)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  minLeadingWidth: 12,
                  leading: Icon(
                    Icons.circle,
                    size: 12,
                    color: StatusChip.colorFor(h.action),
                  ),
                  title: Text(
                    h.action,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    [
                      [h.by, if (h.at != null) Fmt.dateTime(h.at)].join(' · '),
                      if (h.note != null) '“${h.note}”',
                    ].join('\n'),
                  ),
                ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.leave;
    final l10n = context.l10n;
    final note = l.decisionNote;
    final asking = l.status == 'Clarification';
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  '${l.leaveType} • ${l.days} day${l.days == 1 ? '' : 's'}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
              StatusChip(l.status),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              '${Fmt.date(l.fromDate)} – ${Fmt.date(l.toDate)}',
              ?l.reason,
            ].join('\n'),
            style: const TextStyle(color: AppColors.muted),
          ),
          if (note != null) ...[
            const SizedBox(height: 6),
            Text(
              asking ? l10n.clarificationNeeded(note) : l10n.schoolNote(note),
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: asking ? AppColors.info : null,
              ),
            ),
          ],
          Wrap(
            spacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (l.needsReply)
                FilledButton.tonalIcon(
                  onPressed: _busy ? null : _respond,
                  icon: const Icon(Icons.reply_rounded, size: 18),
                  label: Text(l10n.respond),
                ),
              if (l.canWithdraw)
                OutlinedButton.icon(
                  onPressed: _busy ? null : _withdraw,
                  icon: const Icon(Icons.undo_rounded, size: 18),
                  label: Text(l10n.withdraw),
                ),
              TextButton.icon(
                onPressed: _showHistory,
                icon: const Icon(Icons.history_rounded, size: 18),
                label: Text(l10n.history),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Asks for the guardian's reply to a clarification request; returns the trimmed text.
class _ReplyDialog extends StatefulWidget {
  const _ReplyDialog();

  @override
  State<_ReplyDialog> createState() => _ReplyDialogState();
}

class _ReplyDialogState extends State<_ReplyDialog> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final value = _text.text.trim();
    return AlertDialog(
      title: Text(l10n.respondTitle),
      content: TextField(
        controller: _text,
        autofocus: true,
        maxLines: 3,
        decoration: InputDecoration(hintText: l10n.respondHint),
        onChanged: (_) => setState(() {}),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          onPressed: value.isEmpty ? null : () => Navigator.pop(context, value),
          child: Text(l10n.sendReply),
        ),
      ],
    );
  }
}

class _LeaveForm extends StatefulWidget {
  const _LeaveForm({
    required this.child,
    required this.types,
    required this.onSubmitted,
  });

  final ChildSummary child;
  final List<LeaveType> types;
  final VoidCallback onSubmitted;

  @override
  State<_LeaveForm> createState() => _LeaveFormState();
}

class _LeaveFormState extends State<_LeaveForm> {
  final _form = GlobalKey<FormState>();
  // Errors stay hidden until the first submit; after that each field re-checks as it is edited,
  // so a corrected field clears its message straight away.
  bool _showErrors = false;
  final _reason = TextEditingController();
  late String? _typeId = widget.types.isEmpty ? null : widget.types.first.id;
  DateTime _from = DateTime.now();
  DateTime _to = DateTime.now();
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pick(bool from) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: from ? _from : _to,
      firstDate: DateTime(
        now.year,
        now.month,
        now.day,
      ).subtract(const Duration(days: 7)),
      lastDate: DateTime(now.year + 1),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (from) {
        _from = picked;
        if (_to.isBefore(_from)) _to = _from;
      } else {
        _to = picked.isBefore(_from) ? _from : picked;
      }
    });
  }

  static DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  bool _isSingleDay(int offset) {
    final d = _dateOnly(DateTime.now()).add(Duration(days: offset));
    return _dateOnly(_from) == d && _dateOnly(_to) == d;
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) {
      setState(() => _showErrors = true);
      return;
    }
    setState(() => _busy = true);
    try {
      await context.read<GuardianService>().applyLeave(
        studentId: widget.child.id,
        leaveTypeId: _typeId,
        from: _from,
        to: _to,
        reason: _reason.text.trim(),
      );
      if (!mounted) return;
      showSnack(context, context.l10n.leaveSent);
      _reason.clear();
      widget.onSubmitted();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final days = _to.difference(_from).inDays + 1;
    return SectionCard(
      title: context.l10n.newLeaveApplication,
      icon: Icons.edit_note_rounded,
      child: Form(
        key: _form,
        autovalidateMode: _showErrors
            ? AutovalidateMode.onUserInteraction
            : AutovalidateMode.disabled,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              context.l10n.forChild(widget.child.name, widget.child.classLine),
              style: const TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 12),
            if (widget.types.isNotEmpty)
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _typeId,
                decoration: InputDecoration(labelText: context.l10n.leaveType),
                items: [
                  for (final t in widget.types)
                    DropdownMenuItem(value: t.id, child: Text(t.name)),
                ],
                onChanged: (v) => setState(() => _typeId = v),
              ),
            const SizedBox(height: 12),
            // Most requests are for today or tomorrow: one tap instead of two date pickers.
            Wrap(
              spacing: 8,
              children: [
                for (final (label, offset) in [
                  (context.l10n.today, 0),
                  (context.l10n.tomorrow, 1),
                ])
                  ChoiceChip(
                    label: Text(label),
                    selected: _isSingleDay(offset),
                    onSelected: (_) => setState(() {
                      final d = _dateOnly(DateTime.now())
                          .add(Duration(days: offset));
                      _from = d;
                      _to = d;
                    }),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(true),
                    icon: const Icon(Icons.event),
                    label: Text(context.l10n.dateFrom(Fmt.shortDate(_from))),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(false),
                    icon: const Icon(Icons.event),
                    label: Text(context.l10n.dateTo(Fmt.shortDate(_to))),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                context.l10n.daysCount(days),
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
            TextFormField(
              controller: _reason,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: context.l10n.reason,
                alignLabelWithHint: true,
              ),
              validator: (v) => (v ?? '').trim().length < 5
                  ? context.l10n.describeReason
                  : null,
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        color: Colors.white,
                      ),
                    )
                  : Text(context.l10n.submitApplication),
            ),
          ],
        ),
      ),
    );
  }
}
