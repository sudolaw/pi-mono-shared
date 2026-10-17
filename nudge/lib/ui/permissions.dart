import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';

import '../services/notifications.dart';

/// Asks for the notification permission (Android 13+). True when granted.
Future<bool> ensureNotificationPermission() async =>
    await Notifications.instance.android?.requestNotificationsPermission() ?? true;

Future<bool> notificationsEnabled() async =>
    await Notifications.instance.android?.areNotificationsEnabled() ?? true;

/// Asks Android to stop putting the app to sleep, so reminders and the location
/// service run on time.
Future<void> ensureBatteryExemption() async {
  if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) {
    await FlutterForegroundTask.requestIgnoreBatteryOptimization();
  }
}

Future<bool> batteryExempt() => FlutterForegroundTask.isIgnoringBatteryOptimizations;

/// Lets alarms show full screen over the lock screen (Android 14+ asks).
Future<void> requestFullScreenAlarms() async {
  await Notifications.instance.android?.requestFullScreenIntentPermission();
}

/// Location on and permission granted, asking or explaining as needed.
Future<bool> ensureLocationPermission(BuildContext context) async {
  if (!await Geolocator.isLocationServiceEnabled()) {
    if (context.mounted) {
      await _explain(
        context,
        'Turn on location',
        'Location alarms need the phone\'s location (GPS) switched on.',
        'Open settings',
      );
    }
    await Geolocator.openLocationSettings();
    return false;
  }
  var p = await Geolocator.checkPermission();
  if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
  if (p == LocationPermission.deniedForever || p == LocationPermission.denied) {
    if (context.mounted) {
      await _explain(
        context,
        'Location permission needed',
        'Allow location for Nudge (at least "While using the app") so it can tell when '
            'you arrive.',
        'Open app settings',
      );
    }
    await Geolocator.openAppSettings();
    return false;
  }
  return true;
}

Future<void> _explain(BuildContext context, String title, String body, String action) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [FilledButton(onPressed: () => Navigator.pop(context), child: Text(action))],
    ),
  );
}
