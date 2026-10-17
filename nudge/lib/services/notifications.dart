import 'package:alarm_tone/alarm_tone.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../data/db.dart';
import 'engine.dart';

/// Notification ids: reminders use the occurrence id, the rest are offset.
const _missedIdBase = 1000000;
const _locationIdBase = 2000000;

/// How long an alarm-style routine reminder rings each time it fires.
const routineRingTime = Duration(minutes: 1);

/// Tone tags (see [AlarmTone]): one per ringing reminder or location alarm.
String _occTone(int occurrenceId) => 'occ:$occurrenceId';
String _locTone(int alarmId) => 'loc:$alarmId';

abstract final class NotificationActions {
  static const done = 'done';
  static const snooze = 'snooze';
  static const stop = 'stop';
}

abstract final class _Channels {
  static const reminders = 'reminders';

  /// Silent: the app plays the alarm tone itself (see [AlarmTone]), so no
  /// notification setting can mute a ringing alarm. Replaced 'alarms', which
  /// relied on the notification's own sound.
  static const alarms = 'ringing';
  static const oldAlarms = 'alarms';
  static const missed = 'missed';
}

/// Shows reminder and alarm notifications. One instance per isolate.
class Notifications implements ReminderNotifier {
  Notifications._();

  static final Notifications instance = Notifications._();

  final plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  AndroidFlutterLocalNotificationsPlugin? get android =>
      plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<void> init({
    DidReceiveNotificationResponseCallback? onTap,
    DidReceiveBackgroundNotificationResponseCallback? onBackgroundAction,
  }) async {
    if (_ready) return;
    await plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
      onDidReceiveNotificationResponse: onTap,
      onDidReceiveBackgroundNotificationResponse: onBackgroundAction,
    );
    await android?.createNotificationChannel(
      const AndroidNotificationChannel(
        _Channels.reminders,
        'Reminders',
        description: 'Routine, to-do and review reminders',
        importance: Importance.high,
      ),
    );
    await android?.deleteNotificationChannel(channelId: _Channels.oldAlarms);
    await android?.createNotificationChannel(
      const AndroidNotificationChannel(
        _Channels.alarms,
        'Alarms',
        description:
            'Location alarms and alarm-style routines. The alarm tone plays on the alarm '
            'volume, whatever this channel\'s sound setting.',
        importance: Importance.max,
        playSound: false,
        enableVibration: false,
        bypassDnd: true,
      ),
    );
    await android?.createNotificationChannel(
      const AndroidNotificationChannel(
        _Channels.missed,
        'Missed',
        description: 'A to-do passed its end date',
        importance: Importance.defaultImportance,
      ),
    );
    _ready = true;
  }

  @override
  Future<void> showReminder(Occurrence occurrence, Routine routine) async {
    final alarm = routine.alertStyle == AlertStyle.alarm;
    final details = AndroidNotificationDetails(
      alarm ? _Channels.alarms : _Channels.reminders,
      alarm ? 'Alarms' : 'Reminders',
      // Text hidden on a locked phone.
      visibility: NotificationVisibility.private,
      importance: alarm ? Importance.max : Importance.high,
      priority: alarm ? Priority.max : Priority.high,
      category: alarm ? AndroidNotificationCategory.alarm : AndroidNotificationCategory.reminder,
      autoCancel: false,
      when: occurrence.startAt.millisecondsSinceEpoch,
      actions: const [
        AndroidNotificationAction(NotificationActions.done, 'Done'),
        AndroidNotificationAction(NotificationActions.snooze, 'Snooze 15 min'),
      ],
    );
    await plugin.show(
      id: occurrence.id,
      title: routine.title,
      body: routine.notes.isEmpty ? _reminderBody(routine) : routine.notes,
      notificationDetails: NotificationDetails(android: details),
      payload: 'occ:${occurrence.id}',
    );
    if (alarm) {
      await _tone(() => AlarmTone.start(_occTone(occurrence.id), timeout: routineRingTime));
    }
  }

  String _reminderBody(Routine r) => switch (r.kind) {
    RoutineKind.todo => 'To-do: tap Done when finished',
    RoutineKind.review => 'Open Promises and add today\'s promises',
    _ => 'Tap Done when finished',
  };

  @override
  Future<void> showMissed(Occurrence occurrence, Routine routine) async {
    await plugin.show(
      id: _missedIdBase + occurrence.id,
      title: 'Missed: ${routine.title}',
      body: 'The end date passed before it was done.',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _Channels.missed,
          'Missed',
          visibility: NotificationVisibility.private,
        ),
      ),
      payload: 'occ:${occurrence.id}',
    );
  }

  @override
  Future<void> cancelReminder(int occurrenceId) async {
    await plugin.cancel(id: occurrenceId);
    await stopReminderTone(occurrenceId);
  }

  /// Silences a ringing reminder but leaves its notification.
  Future<void> stopReminderTone(int occurrenceId) =>
      _tone(() => AlarmTone.stop(_occTone(occurrenceId)));

  @override
  Future<void> cancelAll() async {
    await plugin.cancelAll();
    await _tone(AlarmTone.stopAll);
  }

  /// Waits while a reminder this process started is still ringing, so a
  /// background run keeps the process alive until the tone ends (at most
  /// [routineRingTime] after the last reminder fired).
  Future<void> waitForReminderTones() async {
    final end = DateTime.now().add(routineRingTime + const Duration(seconds: 5));
    while (DateTime.now().isBefore(end)) {
      final active = await _activeTones();
      if (!active.any((t) => t.startsWith('occ:'))) return;
      await Future<void>.delayed(const Duration(seconds: 1));
    }
  }

  Future<List<String>> _activeTones() async {
    try {
      return await AlarmTone.active();
    } catch (e) {
      debugPrint('Alarm tone unavailable: $e');
      return const [];
    }
  }

  /// A tone that fails to play must not stop the notification around it.
  Future<void> _tone(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      debugPrint('Alarm tone failed: $e');
    }
  }

  Future<void> showLocationAlarm(LocationAlarm alarm) async {
    final details = AndroidNotificationDetails(
      _Channels.alarms,
      'Alarms',
      // Text hidden on a locked phone.
      visibility: NotificationVisibility.private,
      importance: Importance.max,
      priority: Priority.max,
      category: AndroidNotificationCategory.alarm,
      fullScreenIntent: true,
      ongoing: true,
      autoCancel: false,
      actions: const [
        AndroidNotificationAction(NotificationActions.stop, 'Stop', showsUserInterface: true),
      ],
    );
    await plugin.show(
      id: _locationIdBase + alarm.id,
      title: 'You\'ve arrived: ${alarm.name}',
      body: 'Within ${alarm.radiusMeters} m of your alarm location.',
      notificationDetails: NotificationDetails(android: details),
      payload: 'loc:${alarm.id}',
    );
    // Rings until stopped.
    await _tone(() => AlarmTone.start(_locTone(alarm.id)));
  }

  Future<void> cancelLocationAlarm(int alarmId) async {
    await plugin.cancel(id: _locationIdBase + alarmId);
    await _tone(() => AlarmTone.stop(_locTone(alarmId)));
  }
}

/// Parsed notification payload: `occ:<id>` or `loc:<id>`.
({String kind, int id})? parsePayload(String? payload) {
  final parts = payload?.split(':');
  if (parts == null || parts.length != 2) return null;
  final id = int.tryParse(parts[1]);
  return id == null ? null : (kind: parts[0], id: id);
}
