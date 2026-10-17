import 'package:drift/drift.dart' show Value;
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../core/clock.dart';
import '../core/dates.dart';
import '../data/backup.dart' as backup;
import '../data/db.dart';
import 'engine.dart';
import 'location_service.dart';
import 'notifications.dart';
import 'scheduler.dart' as scheduler;

Future<void> _noop() async {}

/// Everything the UI isolate uses to change data. Every change that affects
/// reminders goes through here so the next alarm is re-armed.
///
/// The Android-only parts are parameters so tests can run the real screens on
/// an in-memory database.
class AppServices {
  AppServices(
    this.db, {
    ReminderNotifier? notifier,
    Future<void> Function(DateTime? at)? armNextTick,
    Future<void> Function()? syncLocation,
    this.requestStartupPermissions = _noop,
  }) : engine = ReminderEngine(db, notifier ?? Notifications.instance),
       _armNextTick = armNextTick ?? scheduler.scheduleNextTick,
       _syncLocation = syncLocation ?? (() => LocationService.sync(db));

  final AppDb db;
  final ReminderEngine engine;
  final Future<void> Function(DateTime? at) _armNextTick;
  final Future<void> Function() _syncLocation;

  /// Asked once the home screen is up (notification permission on a phone).
  final Future<void> Function() requestStartupPermissions;

  /// Fires anything due and re-arms the exact alarm for the next tick. Never
  /// throws: a failure here must not undo or block the change that caused it.
  Future<void> refresh() async {
    try {
      await _armNextTick(await engine.tick(appNow()));
    } catch (e, s) {
      debugPrint('Reminder refresh failed: $e\n$s');
    }
  }

  Future<void> saveRoutine(RoutinesCompanion data) async {
    await engine.saveRoutine(data, appNow());
    await refresh();
  }

  Future<void> deleteRoutine(int id) async {
    await engine.deleteRoutine(id);
    await refresh();
  }

  Future<void> setDone(int occurrenceId, bool done) async {
    if (done) {
      await engine.markDone(occurrenceId, appNow());
    } else {
      await engine.markPending(occurrenceId);
    }
    await refresh();
  }

  Future<void> snooze(int occurrenceId, Duration by) async {
    await engine.snooze(occurrenceId, appNow(), by);
    await refresh();
  }

  Future<void> completeReview(String systemKey) async {
    await engine.completeReview(systemKey, appNow());
    await refresh();
  }

  /// Adds a goal, or updates goal [id].
  Future<void> saveGoal(GoalsCompanion data, {int? id}) async {
    if (id == null) {
      await db.into(db.goals).insert(data);
    } else {
      await (db.update(db.goals)..where((t) => t.id.equals(id))).write(data);
    }
  }

  Future<void> setGoalArchived(int id, bool archived) => (db.update(
    db.goals,
  )..where((t) => t.id.equals(id))).write(GoalsCompanion(archived: Value(archived)));

  /// Its promises stay, unlinked.
  Future<void> deleteGoal(int id) => (db.delete(db.goals)..where((t) => t.id.equals(id))).go();

  /// A promise for today is what the morning reminder asks for, so adding one
  /// completes it.
  Future<void> addPromise(PromisesCompanion data) async {
    await db.into(db.promises).insert(data);
    if (data.day.value == dateOnly(appNow())) await completeReview(SystemRoutine.morningReview);
  }

  Future<void> updatePromise(int id, PromisesCompanion data) =>
      (db.update(db.promises)..where((t) => t.id.equals(id))).write(data);

  /// Marks a promise kept with the time it took, or open again.
  Future<void> setPromiseKept(int id, bool kept, int? actualMinutes) => updatePromise(
    id,
    PromisesCompanion(
      status: Value(kept ? PromiseStatus.kept : PromiseStatus.open),
      actualMinutes: Value(kept ? actualMinutes : null),
    ),
  );

  Future<void> deletePromise(int id) => (db.delete(db.promises)..where((t) => t.id.equals(id))).go();

  /// Adds a location alarm, switched off, or updates alarm [id]; returns its id.
  /// Switching it on goes through [setLocationAlarmEnabled].
  Future<int> saveLocationAlarm(LocationAlarmsCompanion data, {int? id}) async {
    if (id == null) {
      return db.into(db.locationAlarms).insert(data.copyWith(enabled: const Value(false)));
    }
    await (db.update(db.locationAlarms)..where((t) => t.id.equals(id))).write(data);
    return id;
  }

  /// Switching off a ringing alarm also silences it. Either way the next
  /// reading decides which side of the zone the phone is on.
  Future<void> setLocationAlarmEnabled(int id, bool on) async {
    if (!on) await stopLocationAlarm(id);
    await (db.update(db.locationAlarms)..where((t) => t.id.equals(id))).write(
      LocationAlarmsCompanion(enabled: Value(on), inside: const Value(null)),
    );
    await _syncLocation();
  }

  Future<void> deleteLocationAlarm(int id) async {
    await stopLocationAlarm(id);
    await (db.delete(db.locationAlarms)..where((t) => t.id.equals(id))).go();
    await _syncLocation();
  }

  Future<void> syncLocationService() => _syncLocation();

  /// Everything as a JSON backup file's contents.
  Future<String> exportBackup() => backup.exportBackup(db, appNow());

  /// Replaces all data with a backup, then rebuilds reminders and location
  /// tracking from it. Throws [backup.BackupException] for a bad file, in which
  /// case nothing changed.
  Future<backup.BackupCounts> importBackup(String json) async {
    final counts = await backup.importBackup(db, json);
    await engine.notifier.cancelAll();
    await refresh();
    await _syncLocation();
    return counts;
  }

  Future<void> stopLocationAlarm(int alarmId) => scheduler.stopLocationAlarm(db, alarmId);

  /// Notification tapped or a button pressed while the app is running.
  Future<void> onNotificationResponse(NotificationResponse response) async {
    await scheduler.handleNotificationAction(response, engine, db);
    await refresh();
  }
}

/// The services for the UI isolate, set up in `main` (and by tests).
late AppServices services;
