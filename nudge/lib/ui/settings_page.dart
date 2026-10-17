import 'dart:convert';
import 'dart:typed_data';

import 'package:drift/drift.dart' show Value;
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../data/backup.dart' show BackupException;
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';
import 'permissions.dart';
import 'watch.dart';

/// App bar button that opens [SettingsPage].
class SettingsButton extends StatelessWidget {
  const SettingsButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Settings',
      icon: const Icon(Icons.settings_outlined),
      onPressed: () =>
          Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsPage())),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> with WidgetsBindingObserver {
  bool? _notifications;
  bool? _battery;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _check();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _check() async {
    final n = await notificationsEnabled();
    final b = await batteryExempt();
    if (mounted) {
      setState(() {
        _notifications = n;
        _battery = b;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const SectionHeader('Promises'),
          _ReviewSetting(systemKey: SystemRoutine.morningReview, label: 'Morning reminder'),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              'Reminds you to make today\'s promises until you add one. '
              'Tap 🔔 / ⏰ to switch between a notification and a ringing alarm.',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
          const SectionHeader('Backup'),
          ListTile(
            leading: const Icon(Icons.download_outlined),
            title: const Text('Export data'),
            subtitle: const Text(
              'Save everything (routines, promises, goals, alarms) to a file, e.g. in Downloads',
            ),
            onTap: () => _export(context),
          ),
          ListTile(
            leading: const Icon(Icons.upload_outlined),
            title: const Text('Import data'),
            subtitle: const Text('Restore from an exported file. Replaces what is in Nudge now'),
            onTap: () => _import(context),
          ),
          const SectionHeader('Make reminders reliable'),
          ListTile(
            leading: Icon(_notifications == true ? Icons.check_circle : Icons.error_outline),
            title: const Text('Notifications'),
            subtitle: Text(_notifications == true ? 'Allowed' : 'Needed for every reminder'),
            onTap: () async {
              await ensureNotificationPermission();
              await _check();
            },
          ),
          ListTile(
            leading: Icon(_battery == true ? Icons.check_circle : Icons.error_outline),
            title: const Text('Ignore battery optimization'),
            subtitle: Text(
              _battery == true
                  ? 'Allowed'
                  : 'Stops Android from delaying reminders and pausing the location service',
            ),
            onTap: () async {
              await ensureBatteryExemption();
              await _check();
            },
          ),
          ListTile(
            leading: const Icon(Icons.fullscreen),
            title: const Text('Full-screen alarms'),
            subtitle: const Text('Let ringing alarms show over the lock screen (Android 14+)'),
            onTap: requestFullScreenAlarms,
          ),
          ListTile(
            leading: const Icon(Icons.location_on_outlined),
            title: const Text('Location'),
            subtitle: const Text('Needed for location alarms'),
            onTap: () => ensureLocationPermission(context),
          ),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'After restarting the phone, open Nudge once so location alarms resume. '
              'Routine reminders resume on their own.',
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _export(BuildContext context) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    final json = await services.exportBackup();
    final day = DateTime.now().toIso8601String().substring(0, 10);
    final saved = await FilePicker.saveFile(
      fileName: 'nudge-backup-$day.json',
      bytes: Uint8List.fromList(utf8.encode(json)),
      mimeType: 'application/json',
    );
    if (saved != null) {
      messenger.showSnackBar(const SnackBar(content: Text('Backup saved')));
    }
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text('Could not save the backup: $e')));
  }
}

Future<void> _import(BuildContext context) async {
  final messenger = ScaffoldMessenger.of(context);
  final ok = await confirm(
    context,
    'Replace everything in Nudge with the backup? What is in the app now is lost.',
    'Choose file',
  );
  if (!ok) return;
  try {
    final picked = await FilePicker.pickFiles(dialogTitle: 'Choose a Nudge backup');
    if (picked.isEmpty) return;
    final json = utf8.decode(await picked.first.readAsBytes());
    final c = await services.importBackup(json);
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          'Restored ${c.routines} routines, ${c.promises} promises, '
          '${c.goals} goals and ${c.alarms} location alarms',
        ),
      ),
    );
  } on BackupException catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(e.message)));
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text('Could not read that file: $e')));
  }
}

class _ReviewSetting extends StatelessWidget {
  const _ReviewSetting({required this.systemKey, required this.label});

  final String systemKey;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Watch<Routine?>(
      query: () => services.db.watchRoutineBySystemKey(systemKey),
      keyValue: systemKey,
      builder: (context, snap) {
        final r = snap.data;
        if (r == null) return const SizedBox.shrink();
        final ringing = r.alertStyle == AlertStyle.alarm;
        return Row(
          children: [
            Expanded(
              child: TimeTile(
                label: label,
                minutes: r.timeMinutes,
                onChanged: (m) =>
                    services.saveRoutine(RoutinesCompanion(id: Value(r.id), timeMinutes: Value(m))),
              ),
            ),
            IconButton(
              tooltip: ringing ? 'Rings like an alarm' : 'Notification',
              icon: Icon(ringing ? Icons.alarm : Icons.notifications_outlined),
              onPressed: () => services.saveRoutine(
                RoutinesCompanion(
                  id: Value(r.id),
                  alertStyle: Value(ringing ? AlertStyle.notification : AlertStyle.alarm),
                ),
              ),
            ),
            Switch(
              value: r.active,
              onChanged: (on) =>
                  services.saveRoutine(RoutinesCompanion(id: Value(r.id), active: Value(on))),
            ),
            const SizedBox(width: 8),
          ],
        );
      },
    );
  }
}
