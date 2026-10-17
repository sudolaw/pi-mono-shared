import 'dart:async';
import 'dart:math' as math;

import 'package:drift/drift.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';

import '../core/geo.dart';
import '../data/db.dart';
import 'notifications.dart';
import 'scheduler.dart';
import '../core/clock.dart';

const _serviceId = 501;

/// Readings less accurate than this never change an alarm's state.
const _maxTriggerAccuracyMeters = 300.0;

/// How often the service wakes to see whether a position check is due.
const _heartbeat = Duration(seconds: 5);

/// Starts or stops the location foreground service to match the saved alarms.
/// Call from the UI isolate after any change to location alarms.
abstract final class LocationService {
  static void init() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'location_service',
        channelName: 'Location alarm tracking',
        channelDescription: 'Shown while a location alarm is switched on',
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(_heartbeat.inMilliseconds),
        allowWakeLock: true,
      ),
    );
  }

  static Future<void> sync(AppDb db) async {
    final active = await db.enabledLocationAlarms();
    final running = await FlutterForegroundTask.isRunningService;
    if (active.isEmpty) {
      if (running) await FlutterForegroundTask.stopService();
      return;
    }
    if (running) {
      // Make the service re-read the alarm list right away.
      FlutterForegroundTask.sendDataToTask('reload');
      return;
    }
    await FlutterForegroundTask.startService(
      serviceId: _serviceId,
      serviceTypes: [ForegroundServiceTypes.location],
      notificationTitle: 'Location alarm on',
      notificationText: _watchingText(active.length),
      callback: locationServiceCallback,
    );
  }
}

String _watchingText(int count, [double nearestMeters = double.infinity, int insideCount = 0]) {
  final what = count == 1 ? '1 alarm' : '$count alarms';
  final parts = ['Watching $what'];
  if (insideCount > 0) parts.add('inside ${insideCount == 1 ? '1 zone' : '$insideCount zones'}');
  if (nearestMeters.isFinite) {
    final away = nearestMeters >= 1000
        ? '${(nearestMeters / 1000).toStringAsFixed(1)} km'
        : '${nearestMeters.round()} m';
    parts.add('nearest $away away');
  }
  return parts.join(' · ');
}

@pragma('vm:entry-point')
void locationServiceCallback() {
  FlutterForegroundTask.setTaskHandler(LocationTaskHandler());
}

/// Runs inside the foreground service: checks the position on an adaptive
/// schedule and rings alarms whose radius has been entered.
class LocationTaskHandler extends TaskHandler {
  AppDb? _db;
  DateTime _nextCheck = DateTime(0);
  bool _busy = false;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    _db = AppDb();
    await Notifications.instance.init();
    _nextCheck = DateTime(0);
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    if (_busy || timestamp.isBefore(_nextCheck)) return;
    _busy = true;
    unawaited(
      _check()
          .catchError((Object e) {
            // Database or plugin trouble: keep the service alive and retry.
            debugPrint('Location check failed: $e');
            _nextCheck = appNow().add(const Duration(seconds: 30));
          })
          .whenComplete(() => _busy = false),
    );
  }

  @override
  void onReceiveData(Object data) {
    if (data == 'reload') _nextCheck = DateTime(0);
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {
    await _db?.close();
    _db = null;
  }

  Future<void> _check() async {
    final db = _db;
    if (db == null) return;
    final alarms = await db.enabledLocationAlarms();
    if (alarms.isEmpty) {
      await FlutterForegroundTask.stopService();
      return;
    }

    final Position pos;
    try {
      pos = await Geolocator.getCurrentPosition(
        locationSettings: AndroidSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 30),
        ),
      );
    } catch (_) {
      // No fix yet (tunnel, GPS off, timeout): try again soon.
      _nextCheck = appNow().add(const Duration(seconds: 15));
      return;
    }

    final here = LatLng(pos.latitude, pos.longitude);
    final accurate = pos.accuracy <= _maxTriggerAccuracyMeters;
    var nextChange = double.infinity;
    var nearest = double.infinity;
    var insideCount = 0;
    for (final a in alarms) {
      final d = distanceMeters(here, LatLng(a.lat, a.lng));
      var inside = a.inside;
      if (accurate) {
        final step = zoneStep(
          inside: a.inside,
          distance: d,
          radiusMeters: a.radiusMeters,
          rearmMeters: a.rearmMeters,
        );
        inside = step.inside;
        if (step.ring) {
          await _ring(db, a);
        } else if (step.inside != a.inside) {
          await (db.update(db.locationAlarms)..where((t) => t.id.equals(a.id))).write(
            LocationAlarmsCompanion(inside: Value(step.inside)),
          );
        }
      }
      if (inside == true) {
        insideCount++;
      } else {
        nearest = math.min(nearest, d);
      }
      nextChange = math.min(
        nextChange,
        metersToNextChange(
          inside: inside,
          distance: d,
          radiusMeters: a.radiusMeters,
          rearmMeters: a.rearmMeters,
        ),
      );
    }

    // Plan for the reading being off by its accuracy.
    _nextCheck = appNow().add(nextCheckInterval(nextChange - pos.accuracy));
    await FlutterForegroundTask.updateService(
      notificationTitle: 'Location alarm on',
      notificationText: _watchingText(alarms.length, nearest, insideCount),
    );
  }

  Future<void> _ring(AppDb db, LocationAlarm a) async {
    await (db.update(db.locationAlarms)..where((t) => t.id.equals(a.id))).write(
      LocationAlarmsCompanion(
        inside: const Value(true),
        ringing: const Value(true),
        lastTriggeredAt: Value(appNow()),
      ),
    );
    await Notifications.instance.showLocationAlarm(a);
    FlutterForegroundTask.wakeUpScreen();
    notifyUi();
  }
}
