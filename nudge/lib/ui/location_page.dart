import 'package:flutter/material.dart';

import '../core/geo.dart';
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';
import 'format.dart';
import 'location_alarm_editor.dart';
import 'settings_page.dart';
import 'watch.dart';

/// Location alarms: ring on arriving within a radius of saved coordinates.
class LocationPage extends StatelessWidget {
  const LocationPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Location alarms'), actions: const [SettingsButton()]),
      body: Watch<List<LocationAlarm>>(
        query: () => services.db.watchLocationAlarms(),
        builder: (context, snap) {
          final alarms = snap.data;
          if (alarms == null) return const Center(child: CircularProgressIndicator());
          if (alarms.isEmpty) {
            return const EmptyState(
              icon: Icons.location_on_outlined,
              text:
                  'No location alarms yet.\n\nIn Google Maps, long-press a spot and copy the '
                  'coordinates from the search bar. Then tap "Alarm" and paste them.',
            );
          }
          final anyOn = alarms.any((a) => a.enabled);
          return ListView(
            padding: const EdgeInsets.only(bottom: 96),
            children: [
              if (anyOn)
                Card(
                  margin: const EdgeInsets.all(12),
                  child: ListTile(
                    leading: const Icon(Icons.gps_fixed),
                    title: const Text('Watching your location'),
                    subtitle: const Text(
                      'Keep the "Location alarm on" notification. Alarms ring each time you arrive; '
                      'after you stop one it rings again only once you have left and come back.',
                    ),
                  ),
                ),
              for (final a in alarms) _AlarmTile(alarm: a),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        // Pages share one route (bottom bar), so each FAB needs its own hero tag.
        heroTag: 'places-fab',
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Alarm'),
        onPressed: () =>
            Navigator.push(context, MaterialPageRoute(builder: (_) => const LocationAlarmEditor())),
      ),
    );
  }
}

class _AlarmTile extends StatelessWidget {
  const _AlarmTile({required this.alarm});

  final LocationAlarm alarm;

  @override
  Widget build(BuildContext context) {
    final last = alarm.lastTriggeredAt;
    return ListTile(
      leading: Icon(alarm.enabled ? Icons.location_on : Icons.location_off_outlined),
      title: Text(alarm.name),
      subtitle: Text(
        [
          '${LatLng(alarm.lat, alarm.lng)} · ${alarm.radiusMeters} m · '
              'again after ${formatDistance(alarm.rearmMeters)} away',
          if (last != null) 'Last rang ${formatDateTime(last)}',
        ].join('\n'),
      ),
      isThreeLine: last != null,
      trailing: Switch(
        value: alarm.enabled,
        onChanged: (on) => setLocationAlarmEnabled(context, alarm.id, on),
      ),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => LocationAlarmEditor(existing: alarm)),
      ),
    );
  }
}


/// Full-screen view over the app while a location alarm rings.
class RingingOverlay extends StatelessWidget {
  const RingingOverlay({super.key, required this.alarms});

  final List<LocationAlarm> alarms;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.errorContainer,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.notifications_active, size: 96, color: scheme.onErrorContainer),
              const SizedBox(height: 24),
              for (final a in alarms) ...[
                Text(
                  'You\'ve arrived',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(color: scheme.onErrorContainer),
                ),
                Text(
                  a.name,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displaySmall
                      ?.copyWith(color: scheme.onErrorContainer, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 72,
                  child: FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: scheme.error),
                    onPressed: () => services.stopLocationAlarm(a.id),
                    child: const Text('Stop', style: TextStyle(fontSize: 28)),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
