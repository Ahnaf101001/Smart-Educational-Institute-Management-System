import 'package:material_ui/material_ui.dart';
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

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
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
      FamilyDashboardScreen(onOpenChild: _openChild, onOpenNotifications: () => setState(() => _index = 2)),
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
          const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
          const NavigationDestination(icon: Icon(Icons.face_outlined), selectedIcon: Icon(Icons.face_rounded), label: 'My Child'),
          NavigationDestination(
            icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined)),
            selectedIcon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_rounded)),
            label: 'Alerts',
          ),
          const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
