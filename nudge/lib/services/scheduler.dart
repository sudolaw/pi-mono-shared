import 'dart:isolate';
import 'dart:ui';

import 'package:android_alarm_manager_plus/android_alarm_manager_plus.dart';
import 'package:drift/drift.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../data/db.dart';
import 'engine.dart';
import 'notifications.dart';
import '../core/clock.dart';

/// The single exact alarm that wakes the reminder engine.
const _tickAlarmId = 7001;

/// Port the UI isolate listens on to hear about database writes from
/// background isolates.
const uiPortName = 'nudge.ui.changes';

/// Arms (or clears) the exact Android alarm for the engine's next tick.
Future<void> scheduleNextTick(DateTime? at) async {
  if (at == null) {
    await AndroidAlarmManager.cancel(_tickAlarmId);
    return;
  }
  await AndroidAlarmManager.oneShotAt(
    at,
    _tickAlarmId,
    schedulerTick,
    exact: true,
    wakeup: true,
    allowWhileIdle: true,
    rescheduleOnReboot: true,
  );
}

/// Tells the UI isolate (if the app is open) to re-read the database.
void notifyUi() => IsolateNameServer.lookupPortByName(uiPortName)?.send('changed');

/// How soon to try again when a background run fails, so one error never
/// stops the reminders for good.
const _retryAfterError = Duration(minutes: 5);

/// Opens the database in a background isolate, runs [body], then brings the
/// engine up to date and arms the next tick.
Future<void> _inBackground(Future<void> Function(ReminderEngine engine, AppDb db) body) async {
  DartPluginRegistrant.ensureInitialized();
  final db = AppDb();
  try {
    await Notifications.instance.init();
    final engine = ReminderEngine(db, Notifications.instance);
    try {
      await body(engine, db);
    } finally {
      // Whatever the button did, still fire due reminders and re-arm.
      await scheduleNextTick(await engine.tick(appNow()));
    }
    // A reminder that started ringing here plays from this process: keep the
    // background run (and so the process) alive until it stops.
    await Notifications.instance.waitForReminderTones();
  } catch (e, s) {
    debugPrint('Background reminder run failed: $e\n$s');
    await scheduleNextTick(appNow().add(_retryAfterError));
  } finally {
    await db.close();
  }
  notifyUi();
}

/// Alarm callback: fire due reminders and arm the next tick.
@pragma('vm:entry-point')
Future<void> schedulerTick() => _inBackground((_, _) async {});

/// Notification button pressed while the app is not in the foreground.
@pragma('vm:entry-point')
Future<void> onBackgroundNotificationAction(NotificationResponse response) =>
    _inBackground((engine, db) => handleNotificationAction(response, engine, db));

/// Handles Done / Snooze / Stop from a notification, in any isolate.
Future<void> handleNotificationAction(
  NotificationResponse response,
  ReminderEngine engine,
  AppDb db,
) async {
  final target = parsePayload(response.payload);
  if (target == null) return;
  final now = appNow();
  switch ((target.kind, response.actionId)) {
    case ('occ', null):
      // Opening a ringing reminder silences it; it stays to be ticked.
      await Notifications.instance.stopReminderTone(target.id);
    case ('occ', NotificationActions.done):
      await engine.markDone(target.id, now);
    case ('occ', NotificationActions.snooze):
      await engine.snooze(target.id, now);
    case ('loc', NotificationActions.stop):
      await stopLocationAlarm(db, target.id);
  }
}

/// Silences a ringing location alarm.
Future<void> stopLocationAlarm(AppDb db, int alarmId) async {
  await (db.update(db.locationAlarms)..where((t) => t.id.equals(alarmId))).write(
    const LocationAlarmsCompanion(ringing: Value(false)),
  );
  await Notifications.instance.cancelLocationAlarm(alarmId);
}

/// Listens for change pings from background isolates.
class UiChangeListener {
  UiChangeListener(void Function() onChange) {
    IsolateNameServer.removePortNameMapping(uiPortName);
    IsolateNameServer.registerPortWithName(_port.sendPort, uiPortName);
    _port.listen((_) => onChange());
  }

  final _port = ReceivePort();

  void dispose() {
    IsolateNameServer.removePortNameMapping(uiPortName);
    _port.close();
  }
}
