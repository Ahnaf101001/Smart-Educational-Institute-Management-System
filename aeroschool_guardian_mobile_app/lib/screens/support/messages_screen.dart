import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/support.dart';
import '../../providers/family_provider.dart';
import '../../services/api_exception.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Teacher messages inbox (Spec §1H teacher notifications): conversations with the
/// class / subject teachers of the guardian's children.
class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  int _version = 0;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final family = context.watch<FamilyProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Teacher Messages')),
      body: AsyncView<List<Conversation>>(
        key: ValueKey(_version),
        load: service.conversations,
        builder: (context, list, reload) => RefreshIndicator(
          onRefresh: reload,
          child: list.isEmpty
              ? ListView(
                  children: const [
                    EmptyView(
                      title: 'No messages yet',
                      subtitle: 'Open a child → Teachers and tap "Message" to contact a teacher.',
                      icon: Icons.forum_outlined,
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final c = list[i];
                    final child = c.studentId == null
                        ? null
                        : family.childById(c.studentId!);
                    final teacherName = c.senderType == 'Teacher'
                        ? c.senderName
                        : 'Teacher';
                    return Card(
                      child: ListTile(
                        leading: PersonAvatar(name: teacherName),
                        title: Row(
                          children: [
                            Expanded(
                              child: Text(
                                teacherName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            if (c.unread > 0)
                              StatusChip(
                                '${c.unread} new',
                                color: AppColors.blue,
                              ),
                          ],
                        ),
                        subtitle: Text(
                          '${child != null ? '${child.name} • ' : ''}${c.senderType == 'Guardian' ? 'You: ' : ''}${c.body}\n${Fmt.relative(c.createdAt)}',
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        isThreeLine: true,
                        onTap: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => ConversationScreen(
                                threadKey: c.threadKey,
                                teacherId: c.teacherId,
                                teacherName: teacherName,
                                studentId: c.studentId,
                                studentName: child?.name,
                              ),
                            ),
                          );
                          if (mounted) setState(() => _version++);
                        },
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

/// One conversation with a teacher about one child, with a reply box.
class ConversationScreen extends StatefulWidget {
  const ConversationScreen({
    super.key,
    this.threadKey,
    required this.teacherId,
    required this.teacherName,
    this.studentId,
    this.studentName,
  });

  final String? threadKey;
  final String teacherId;
  final String teacherName;
  final String? studentId;
  final String? studentName;

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _text = TextEditingController();
  List<ChatMessage> _messages = const [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final key = widget.threadKey;
    if (key == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final list = await context.read<GuardianService>().thread(key);
      if (mounted) setState(() => _messages = list);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final body = _text.text.trim();
    if (body.isEmpty || widget.studentId == null) return;
    setState(() => _sending = true);
    try {
      await context.read<GuardianService>().sendMessage(
        teacherId: widget.teacherId,
        studentId: widget.studentId!,
        body: body,
      );
      _text.clear();
      if (!mounted) return;
      setState(
        () => _messages = [
          ..._messages,
          ChatMessage(
            id: 'local-${_messages.length}',
            senderType: 'Guardian',
            senderName: 'You',
            body: body,
            createdAt: DateTime.now(),
          ),
        ],
      );
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.teacherName,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          if (widget.studentName != null)
            Text(
              'About ${widget.studentName}',
              style: const TextStyle(fontSize: 12, color: Color(0xFFBFD3EA)),
            ),
        ],
      ),
    ),
    body: Column(
      children: [
        Expanded(
          child: _loading
              ? const LoadingView()
              : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _messages.isEmpty
              ? const EmptyView(
                  title: 'Start the conversation',
                  subtitle: 'Messages are delivered to the teacher during school hours.',
                  icon: Icons.chat_bubble_outline,
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _messages.length,
                  itemBuilder: (context, i) {
                    final m = _messages[i];
                    final mine = m.fromGuardian;
                    return Align(
                      alignment: mine
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.of(context).size.width * 0.78,
                        ),
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: mine ? AppColors.navy : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: mine
                              ? null
                              : Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              m.body,
                              style: TextStyle(
                                color: mine ? Colors.white : null,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              Fmt.dateTime(m.createdAt),
                              style: TextStyle(
                                fontSize: 10,
                                color: mine
                                    ? const Color(0xFFBFD3EA)
                                    : AppColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        if (widget.studentId != null)
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 2000,
                      decoration: const InputDecoration(
                        hintText: 'Write a message…',
                        counterText: '',
                        isDense: true,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _sending ? null : _send,
                    icon: _sending
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded, color: AppColors.navy),
                  ),
                ],
              ),
            ),
          ),
      ],
    ),
  );
}

/// Thread key used by the backend: sorted participants plus the student id.
String threadKeyFor(String guardianId, String teacherId, String studentId) {
  final parts = ['Guardian:$guardianId', 'Teacher:$teacherId']..sort();
  return '${parts.join('|')}|$studentId';
}
