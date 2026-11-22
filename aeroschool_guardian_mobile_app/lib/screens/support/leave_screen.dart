import 'package:material_ui/material_ui.dart';
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
      appBar: AppBar(title: Text('Leave – ${widget.child.name}')),
      body: AsyncView<_LeaveData>(
        key: ValueKey(_version),
        load: () => _load(service),
        builder: (context, d, reload) => RefreshIndicator(
          onRefresh: reload,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _LeaveForm(
                child: widget.child,
                types: d.types,
                onSubmitted: () => setState(() => _version++),
              ),
              const SectionTitle('Leave History'),
              Card(
                child: d.history.isEmpty
                    ? const EmptyView(
                        title: 'No leave applications yet',
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
                                    'School: ${l.decisionNote}',
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

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
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
      showSnack(context, 'Leave application sent to the school.');
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
      title: 'New Leave Application',
      icon: Icons.edit_note_rounded,
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'For ${widget.child.name} (${widget.child.classLine})',
              style: const TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 12),
            if (widget.types.isNotEmpty)
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _typeId,
                decoration: const InputDecoration(labelText: 'Leave type'),
                items: [
                  for (final t in widget.types)
                    DropdownMenuItem(value: t.id, child: Text(t.name)),
                ],
                onChanged: (v) => setState(() => _typeId = v),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(true),
                    icon: const Icon(Icons.event),
                    label: Text('From ${Fmt.shortDate(_from)}'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(false),
                    icon: const Icon(Icons.event),
                    label: Text('To ${Fmt.shortDate(_to)}'),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                '$days day${days == 1 ? '' : 's'}',
                style: const TextStyle(color: AppColors.muted),
              ),
            ),
            TextFormField(
              controller: _reason,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason',
                alignLabelWithHint: true,
              ),
              validator: (v) => (v ?? '').trim().length < 5
                  ? 'Please describe the reason.'
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
                  : const Text('Submit application'),
            ),
          ],
        ),
      ),
    );
  }
}
