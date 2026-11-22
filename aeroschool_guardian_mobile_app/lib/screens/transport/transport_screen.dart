import 'dart:async';
import 'dart:math' as math;

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

/// Transport (spec §I): assigned bus, route, pickup and drop-off stops, driver,
/// morning / evening schedule, a live bus map that refreshes automatically, and
/// bus-arrival alerts (delivered as notifications).
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
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (t == null)
                  const Card(
                    child: EmptyView(
                      title: 'No school transport assigned',
                      subtitle:
                          'Contact the school office to request a bus seat.',
                      icon: Icons.directions_bus_outlined,
                    ),
                  )
                else ...[
                  SectionCard(
                    title: 'Assigned Bus',
                    icon: Icons.directions_bus_rounded,
                    child: Column(
                      children: [
                        InfoRow(
                          label: 'Bus / vehicle',
                          value: t.registrationNo,
                        ),
                        InfoRow(label: 'Route', value: t.routeName),
                        InfoRow(label: 'Pickup location', value: t.stopName),
                        InfoRow(
                          label: 'Drop-off location',
                          value: t.dropoffStop ?? t.stopName,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  SectionCard(
                    title: 'Transport Schedule',
                    icon: Icons.schedule_rounded,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        InfoRow(
                          label: 'Morning departure',
                          value: t.morningDeparture == null
                              ? null
                              : Fmt.clock(t.morningDeparture),
                        ),
                        InfoRow(
                          label: 'Evening departure',
                          value: t.eveningDeparture == null
                              ? null
                              : Fmt.clock(t.eveningDeparture),
                        ),
                        if (t.stops.isNotEmpty) ...[
                          const Divider(height: 20),
                          for (final s in t.stops)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 3),
                              child: Row(
                                children: [
                                  Icon(
                                    s.name == t.stopName ||
                                            s.name == t.dropoffStop
                                        ? Icons.location_on_rounded
                                        : Icons.circle,
                                    size:
                                        s.name == t.stopName ||
                                            s.name == t.dropoffStop
                                        ? 18
                                        : 8,
                                    color:
                                        s.name == t.stopName ||
                                            s.name == t.dropoffStop
                                        ? AppColors.danger
                                        : AppColors.muted,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      s.name,
                                      style: TextStyle(
                                        fontWeight: s.name == t.stopName
                                            ? FontWeight.w700
                                            : FontWeight.w400,
                                      ),
                                    ),
                                  ),
                                  if (s.time != null)
                                    Text(
                                      Fmt.clock(s.time),
                                      style: const TextStyle(
                                        color: AppColors.muted,
                                        fontSize: 12,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  SectionCard(
                    title: 'Bus Driver',
                    icon: Icons.badge_outlined,
                    child: Column(
                      children: [
                        InfoRow(label: 'Name', value: t.driverName),
                        InfoRow(
                          label: 'Phone',
                          value: t.driverPhone,
                          onTap: t.driverPhone == null
                              ? null
                              : () => files.call(t.driverPhone!),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _LiveBusCard(studentId: child.id, initial: t),
                  const SizedBox(height: 12),
                  const AccessNotice(
                    icon: Icons.notifications_active_outlined,
                    message: 'You get a notification when the bus reaches your stop (when the bus has GPS or the transport desk confirms arrival).',
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Live bus position: refreshed every [_refreshEvery] while the screen is open and shown
/// on an OpenStreetMap tile (no map API key needed).
class _LiveBusCard extends StatefulWidget {
  const _LiveBusCard({required this.studentId, required this.initial});

  final String studentId;
  final TransportInfo initial;

  @override
  State<_LiveBusCard> createState() => _LiveBusCardState();
}

class _LiveBusCardState extends State<_LiveBusCard> {
  static const _refreshEvery = Duration(seconds: 15);

  BusLocation? _loc;
  Timer? _timer;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    final t = widget.initial;
    if (t.hasLocation) {
      _loc = BusLocation(
        latitude: t.latitude!,
        longitude: t.longitude!,
        recordedAt: t.locationAt,
      );
    }
    _refresh();
    _timer = Timer.periodic(_refreshEvery, (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    if (_refreshing) return;
    _refreshing = true;
    try {
      final loc = await context.read<GuardianService>().busLocation(
        widget.studentId,
      );
      if (mounted && loc != null) setState(() => _loc = loc);
    } catch (_) {
      // Keep the last known position; the next tick retries.
    } finally {
      _refreshing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final files = context.read<FileService>();
    final loc = _loc;
    return SectionCard(
      title: 'Live Bus Location',
      icon: Icons.gps_fixed_rounded,
      action: IconButton(
        onPressed: _refresh,
        icon: const Icon(Icons.refresh),
        tooltip: 'Refresh location',
      ),
      child: loc == null
          ? const Text(
              'GPS tracking is not available for this bus yet.',
              style: TextStyle(color: AppColors.muted),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _OsmTileMap(lat: loc.latitude, lng: loc.longitude),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.circle,
                      size: 10,
                      color: AppColors.success,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Updated ${Fmt.relative(loc.recordedAt)} • refreshes every 15 s',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
                if (loc.speed != null)
                  Text(
                    'Speed: ${loc.speed!.round()} km/h',
                    style: const TextStyle(fontSize: 12),
                  ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => files.map(loc.latitude, loc.longitude),
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('Open in Maps'),
                ),
              ],
            ),
    );
  }
}

/// Renders the OpenStreetMap tile containing the bus with a marker at its exact position.
class _OsmTileMap extends StatelessWidget {
  const _OsmTileMap({required this.lat, required this.lng});

  final double lat;
  final double lng;
  static const int _zoom = 16;

  @override
  Widget build(BuildContext context) {
    final n = math.pow(2, _zoom).toDouble();
    final xTile = (lng + 180) / 360 * n;
    final latRad = lat * math.pi / 180;
    final yTile =
        (1 - math.log(math.tan(latRad) + 1 / math.cos(latRad)) / math.pi) /
        2 *
        n;
    final fx = xTile - xTile.floor();
    final fy = yTile - yTile.floor();
    final url =
        'https://tile.openstreetmap.org/$_zoom/${xTile.floor()}/${yTile.floor()}.png';
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: 1.6,
        child: LayoutBuilder(
          builder: (context, c) {
            // The square tile is scaled to the card width; the marker sits at the bus's
            // fractional position inside the tile, vertically centred where possible.
            final size = c.maxWidth;
            final top = (c.maxHeight / 2 - fy * size).clamp(
              c.maxHeight - size,
              0.0,
            );
            return Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                Positioned(
                  left: 0,
                  top: top,
                  width: size,
                  height: size,
                  child: Image.network(
                    url,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      color: AppColors.surfaceTint,
                      alignment: Alignment.center,
                      child: const Text('Map unavailable'),
                    ),
                  ),
                ),
                Positioned(
                  left: fx * size - 16,
                  top: top + fy * size - 32,
                  child: const Icon(
                    Icons.directions_bus_filled_rounded,
                    size: 32,
                    color: AppColors.danger,
                  ),
                ),
                Positioned(
                  right: 4,
                  bottom: 2,
                  child: Container(
                    color: Colors.white70,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: const Text(
                      '© OpenStreetMap contributors',
                      style: TextStyle(fontSize: 9),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
