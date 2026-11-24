import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/support.dart';
import '../../providers/family_provider.dart';
import '../../services/api_exception.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Submit complaint / submit feedback, with the school's responses.
class ComplaintScreen extends StatefulWidget {
  const ComplaintScreen({super.key, this.initialStudentId});

  final String? initialStudentId;

  @override
  State<ComplaintScreen> createState() => _ComplaintScreenState();
}

class _ComplaintScreenState extends State<ComplaintScreen> {
  int _version = 0;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final children = context.watch<FamilyProvider>().children;
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.complaintsFeedback2)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final sent = await showModalBottomSheet<bool>(
            context: context,
            isScrollControlled: true,
            showDragHandle: true,
            builder: (_) =>
                _ComplaintForm(initialStudentId: widget.initialStudentId),
          );
          if (sent == true && mounted) setState(() => _version++);
        },
        icon: const Icon(Icons.add_comment_outlined),
        label: Text(context.l10n.newLabel),
      ),
      body: AsyncView<List<Complaint>>(
        key: ValueKey(_version),
        load: service.complaints,
        builder: (context, list, reload) => RefreshIndicator(
          onRefresh: reload,
          child: list.isEmpty
              ? ListView(
                  children: [
                    EmptyView(
                      title: context.l10n.nothingSubmittedYet,
                      subtitle: context.l10n.sendAComplaintOrFeedback,
                      icon: Icons.forum_outlined,
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final c = list[i];
                    final child = children
                        .where((x) => x.id == c.studentId)
                        .firstOrNull;
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    c.subject,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                StatusChip(c.status),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                c.category,
                                ?child?.name,
                                Fmt.date(c.createdAt),
                              ].join(' • '),
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                            if (c.description != null) ...[
                              const SizedBox(height: 8),
                              Text(c.description!),
                            ],
                            if (c.response != null) ...[
                              const SizedBox(height: 10),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceTint,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  context.l10n.schoolResponse(c.response ?? ''),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _ComplaintForm extends StatefulWidget {
  const _ComplaintForm({this.initialStudentId});

  final String? initialStudentId;

  @override
  State<_ComplaintForm> createState() => _ComplaintFormState();
}

class _ComplaintFormState extends State<_ComplaintForm> {
  final _form = GlobalKey<FormState>();
  // Errors stay hidden until the first submit; after that each field re-checks as it is edited,
  // so a corrected field clears its message straight away.
  bool _showErrors = false;
  final _subject = TextEditingController();
  final _description = TextEditingController();
  String _kind = 'Complaint';
  String _category = 'Academic';
  late String? _studentId = widget.initialStudentId;
  bool _busy = false;

  static const _categories = [
    'Academic',
    'Teacher',
    'Transport',
    'Fees',
    'Facilities',
    'Safety',
    'Other',
  ];

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) {
      setState(() => _showErrors = true);
      return;
    }
    setState(() => _busy = true);
    try {
      await context.read<GuardianService>().submitComplaint(
        studentId: _studentId,
        category: _kind == 'Feedback' ? 'Feedback' : _category,
        subject: _subject.text.trim(),
        description: _description.text.trim(),
      );
      if (!mounted) return;
      showSnack(context, '$_kind sent to the school.');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final children = context.watch<FamilyProvider>().children;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Form(
        key: _form,
        autovalidateMode: _showErrors
            ? AutovalidateMode.onUserInteraction
            : AutovalidateMode.disabled,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SegmentedButton<String>(
                segments: [
                  ButtonSegment(
                    value: 'Complaint',
                    label: Text(context.l10n.complaint),
                  ),
                  ButtonSegment(
                    value: 'Feedback',
                    label: Text(context.l10n.modFeedback),
                  ),
                ],
                showSelectedIcon: false,
                selected: {_kind},
                onSelectionChanged: (s) => setState(() => _kind = s.first),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String?>(
                isExpanded: true,
                initialValue: _studentId,
                decoration: InputDecoration(labelText: context.l10n.about),
                items: [
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(context.l10n.generalNotAboutOneChild),
                  ),
                  for (final c in children)
                    DropdownMenuItem<String?>(value: c.id, child: Text(c.name)),
                ],
                onChanged: (v) => setState(() => _studentId = v),
              ),
              if (_kind == 'Complaint') ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: _category,
                  decoration: InputDecoration(labelText: context.l10n.category),
                  items: [
                    for (final c in _categories)
                      DropdownMenuItem(
                        value: c,
                        child: Text(context.l10n.word(c)),
                      ),
                  ],
                  onChanged: (v) => setState(() => _category = v ?? 'Other'),
                ),
              ],
              const SizedBox(height: 12),
              TextFormField(
                controller: _subject,
                decoration: InputDecoration(labelText: context.l10n.subject),
                validator: (v) => (v ?? '').trim().length < 3
                    ? context.l10n.enterSubject
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _description,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: context.l10n.details,
                  alignLabelWithHint: true,
                ),
                validator: (v) => (v ?? '').trim().length < 5
                    ? context.l10n.addDetails
                    : null,
              ),
              const SizedBox(height: 16),
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
                    : Text(
                        context.l10n.sendKind(
                          _kind == 'Feedback'
                              ? context.l10n.modFeedback
                              : context.l10n.complaint,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
