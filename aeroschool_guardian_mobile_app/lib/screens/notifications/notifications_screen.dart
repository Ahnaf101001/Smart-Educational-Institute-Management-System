import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../l10n/app_localizations.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/family.dart';
import '../../providers/family_provider.dart';
import '../../providers/notification_provider.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import '../support/messages_screen.dart';

/// Communication & notifications (spec §H, workflow §5). Each notification
/// names the child it concerns; the list can be filtered child-wise and by
/// type (attendance, exam, result, fee, homework, transport, notices…).
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, this.studentId, this.studentName});

  /// When set, shows only this child's notifications (child-wise view).
  final String? studentId;
  final String? studentName;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  String? _childFilter;
  String _type = 'All';

  static const _types = [
    'All',
    'Attendance',
    'Exam',
    'Result',
    'Fee',
    'Homework',
    'Transport',
    'Notice',
    'Emergency',
    'Event',
    'Teacher',
  ];

  @override
  void initState() {
    super.initState();
    _childFilter = widget.studentId;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() => context.read<NotificationProvider>().load();

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();
    final children = context.watch<FamilyProvider>().children;
    var items = provider.items;
    if (_childFilter != null) {
      items = items.where((n) => n.studentId == _childFilter).toList();
    }
    if (_type != 'All') {
      items = items.where((n) => n.category == _type).toList();
    }
    final isChildView = widget.studentId != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          isChildView
              ? 'Notices – ${widget.studentName ?? ''}'
              : AppLocalizations.of(context).notificationsTitle,
        ),
        actions: [
          IconButton(
            tooltip: AppLocalizations.of(context).teacherMessages,
            icon: const Icon(Icons.forum_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const MessagesScreen()),
            ),
          ),
          if (provider.unread > 0)
            TextButton(
              onPressed: provider.markAllRead,
              child: Text(
                AppLocalizations.of(context).markAllRead,
                style: const TextStyle(color: Colors.white),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Material(
            color: Colors.white,
            child: Column(
              children: [
                if (!isChildView && children.length > 1)
                  SizedBox(
                    height: 48,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(
                              AppLocalizations.of(context).allChildren,
                            ),
                            selected: _childFilter == null,
                            onSelected: (_) =>
                                setState(() => _childFilter = null),
                          ),
                        ),
                        for (final c in children)
                          Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text(c.name),
                              selected: _childFilter == c.id,
                              onSelected: (_) =>
                                  setState(() => _childFilter = c.id),
                            ),
                          ),
                      ],
                    ),
                  ),
                SizedBox(
                  height: 48,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    children: [
                      for (final t in _types)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            label: Text(t),
                            selected: _type == t,
                            onSelected: (_) => setState(() => _type = t),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Builder(
              builder: (context) {
                if (provider.loading && provider.items.isEmpty) {
                  return const LoadingView();
                }
                if (provider.error != null && provider.items.isEmpty) {
                  return ErrorView(message: provider.error!, onRetry: _load);
                }
                return RefreshIndicator(
                  onRefresh: _load,
                  child: items.isEmpty
                      ? ListView(
                          children: const [
                            EmptyView(
                              title: 'No notifications',
                              subtitle: 'Attendance, exam, fee and school alerts will appear here.',
                              icon: Icons.notifications_none_rounded,
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: items.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, i) =>
                              _NotificationTile(item: items[i]),
                        ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item});

  final AppNotification item;

  static IconData _icon(String category) => switch (category) {
    'Attendance' => Icons.fact_check_outlined,
    'Exam' => Icons.edit_calendar_outlined,
    'Result' => Icons.emoji_events_outlined,
    'Fee' => Icons.payments_outlined,
    'Homework' => Icons.menu_book_rounded,
    'Transport' => Icons.directions_bus_outlined,
    'Emergency' => Icons.warning_amber_rounded,
    'Event' => Icons.event_outlined,
    'Teacher' => Icons.co_present_outlined,
    _ => Icons.campaign_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final emergency = item.category == 'Emergency';
    return Card(
      color: item.isUnread ? const Color(0xFFF0F6FF) : null,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: (emergency ? AppColors.danger : AppColors.navy)
              .withValues(alpha: 0.1),
          child: Icon(
            _icon(item.category),
            color: emergency ? AppColors.danger : AppColors.navy,
            size: 20,
          ),
        ),
        title: Row(
          children: [
            if (item.studentName != null) ...[
              Flexible(
                child: StatusChip(item.studentName!, color: AppColors.blue),
              ),
              const SizedBox(width: 6),
            ],
            Expanded(
              child: Text(
                item.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontWeight: item.isUnread ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            '${item.body}\n${Fmt.dateTime(item.createdAt)}',
            style: const TextStyle(height: 1.35),
          ),
        ),
        isThreeLine: true,
      ),
    );
  }
}
