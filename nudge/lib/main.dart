import 'dart:async';

import 'package:android_alarm_manager_plus/android_alarm_manager_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

import 'data/db.dart';
import 'services/app_services.dart';
import 'services/location_service.dart';
import 'services/notifications.dart';
import 'services/scheduler.dart';
import 'ui/home.dart';
import 'ui/permissions.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  services = AppServices(AppDb(), requestStartupPermissions: () => ensureNotificationPermission());

  // A failing platform plugin must not stop the app from opening; the screens
  // and data still work, and the failure is logged.
  await _guard('foreground task', () async => FlutterForegroundTask.initCommunicationPort());
  await _guard('alarm manager', AndroidAlarmManager.initialize);
  await _guard('location service', () async => LocationService.init());
  await _guard(
    'notifications',
    () => Notifications.instance.init(
      onTap: services.onNotificationResponse,
      onBackgroundAction: onBackgroundNotificationAction,
    ),
  );

  runApp(NudgeApp(startOnManual: await services.db.isFirstRun()));

  unawaited(_guard('reminder refresh', services.refresh));
  unawaited(_guard('location sync', services.syncLocationService));
}

Future<void> _guard(String what, Future<Object?> Function() action) async {
  try {
    await action();
  } catch (e, s) {
    debugPrint('Startup step "$what" failed: $e\n$s');
  }
}
