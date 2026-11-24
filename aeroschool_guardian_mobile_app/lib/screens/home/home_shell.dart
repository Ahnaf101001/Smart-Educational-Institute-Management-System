import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../providers/family_provider.dart';
import '../../providers/notification_provider.dart';
import '../children/child_dashboard_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import 'family_dashboard_screen.dart';

/// Main navigation: Family Overview → Individual Student Dashboard →
/// Notifications → Guardian Profile (the two dashboard layers of the spec).
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  static const int homeTab = 0;
  static const int childTab = 1;
  static const int alertsTab = 2;
  static const int profileTab = 3;

  /// Lets other parts of the app (e.g. a tapped push notification) switch tabs.
  static final ValueNotifier<int?> requestedTab = ValueNotifier<int?>(null);

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    HomeShell.requestedTab.addListener(_onTabRequest);
    WidgetsBinding.instance.addPostFrameCallback((_) => _onTabRequest());
  }

  @override
  void dispose() {
    HomeShell.requestedTab.removeListener(_onTabRequest);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _onTabRequest() {
    final tab = HomeShell.requestedTab.value;
    if (tab == null || !mounted) return;
    HomeShell.requestedTab.value = null;
    setState(() => _index = tab);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final notifications = context.read<NotificationProvider>();
    if (state == AppLifecycleState.resumed) {
      notifications.startPolling();
      context.read<FamilyProvider>().load(silent: true);
    } else if (state == AppLifecycleState.paused) {
      notifications.stopPolling();
    }
  }

  void _openChild(String childId) {
    context.read<FamilyProvider>().selectChild(childId);
    setState(() => _index = 1);
  }

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<NotificationProvider>().unread;
    final pages = [
      FamilyDashboardScreen(
        onOpenChild: _openChild,
        onOpenNotifications: () => setState(() => _index = 2),
      ),
      const ChildDashboardScreen(),
      const NotificationsScreen(),
      const ProfileScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded),
            label: context.l10n.navHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.face_outlined),
            selectedIcon: const Icon(Icons.face_rounded),
            label: context.l10n.navMyChild,
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_rounded),
            ),
            label: context.l10n.navAlerts,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            selectedIcon: const Icon(Icons.person_rounded),
            label: context.l10n.navProfile,
          ),
        ],
      ),
    );
  }
}
