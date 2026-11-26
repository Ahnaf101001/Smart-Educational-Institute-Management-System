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
                          for (final l in d.history)
                            ListTile(
                              title: Text(
                                '${l.leaveType} • ${l.days} day${l.days == 1 ? '' : 's'}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              subtitle: Text(
                                [
                                  '${Fmt.date(l.fromDate)} – ${Fmt.date(l.toDate)}',
                                  ?l.reason,
                                  if (l.decisionNote != null)
                                    context.l10n.schoolNote(
                                      l.decisionNote ?? '',
                                    ),
                                ].join('\n'),
                              ),
                              isThreeLine:
                                  l.reason != null || l.decisionNote != null,
                              trailing: StatusChip(l.status),
                            ),
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
