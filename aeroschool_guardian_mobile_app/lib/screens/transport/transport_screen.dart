import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/support.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';

/// Transport (spec §I): assigned bus, route, pickup/drop-off point, driver,
/// schedule and the bus's latest GPS position (when a tracker is installed).
class TransportScreen extends StatelessWidget {
  const TransportScreen({super.key, required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    return Scaffold(
      appBar: AppBar(title: Text('Transport – ${child.name}')),
      body: AsyncView<StudentExtras>(
        load: () => service.extras(child.id),
        builder: (context, x, reload) {
          final t = x.transport;
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              if (t == null)
                const Card(
                  child: EmptyView(
                    title: 'No school transport assigned',
                    subtitle: 'Contact the school office to request a bus seat.',
                    icon: Icons.directions_bus_outlined,
                  ),
                )
              else ...[
                SectionCard(
                  title: 'Assigned Bus',
                  icon: Icons.directions_bus_rounded,
                  child: Column(children: [
                    InfoRow(label: 'Bus / vehicle', value: t.registrationNo),
                    InfoRow(label: 'Route', value: t.routeName),
                    InfoRow(label: 'Pickup location', value: t.stopName),
                    InfoRow(label: 'Drop-off location', value: t.stopName),
                    InfoRow(label: 'Morning departure', value: t.morningDeparture == null ? null : Fmt.clock(t.morningDeparture)),
                  ]),
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: 'Bus Driver',
                  icon: Icons.badge_outlined,
                  child: Column(children: [
                    InfoRow(label: 'Name', value: t.driverName),
                    InfoRow(label: 'Phone', value: t.driverPhone, onTap: t.driverPhone == null ? null : () => files.call(t.driverPhone!)),
                  ]),
                ),
                const SizedBox(height: 12),
                SectionCard(
                  title: 'Live Bus Location',
                  icon: Icons.gps_fixed_rounded,
                  action: IconButton(onPressed: reload, icon: const Icon(Icons.refresh), tooltip: 'Refresh location'),
                  child: t.hasLocation
                      ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Last updated ${Fmt.relative(t.locationAt)}', style: const TextStyle(color: AppColors.muted)),
                          const SizedBox(height: 4),
                          Text('${t.latitude!.toStringAsFixed(5)}, ${t.longitude!.toStringAsFixed(5)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: () => files.map(t.latitude!, t.longitude!),
                            icon: const Icon(Icons.map_outlined),
                            label: const Text('Open in Maps'),
                          ),
                        ])
                      : const Text('GPS tracking is not available for this bus.', style: TextStyle(color: AppColors.muted)),
                ),
                const SizedBox(height: 12),
                const AccessNotice(
                  icon: Icons.notifications_active_outlined,
                  message: 'Bus arrival alerts appear in Notifications when the school enables them.',
                ),
              ],
            ]),
          );
        },
      ),
    );
  }
}
