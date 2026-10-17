import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/clock.dart';
import 'package:nudge/data/db.dart';
import 'package:nudge/services/app_services.dart';
import 'package:nudge/services/engine.dart';

class _SilentNotifier implements ReminderNotifier {
  @override
  Future<void> showReminder(Occurrence o, Routine r) async {}

  @override
  Future<void> showMissed(Occurrence o, Routine r) async {}

  @override
  Future<void> cancelReminder(int occurrenceId) async {}

  @override
  Future<void> cancelAll() async {}
}

void main() {
  late AppDb db;
  late AppServices app;
  var syncs = 0;
  final now = DateTime(2026, 10, 12, 8, 5);

  setUp(() {
    appNow = () => now;
    db = AppDb(NativeDatabase.memory());
    syncs = 0;
    app = AppServices(
      db,
      notifier: _SilentNotifier(),
      armNextTick: (_) async {},
      syncLocation: () async => syncs++,
    );
  });

  tearDown(() async {
    await db.close();
    appNow = DateTime.now;
  });

  Future<OccurrenceStatus> morningReview() async {
    final r = (await db.routineBySystemKey(SystemRoutine.morningReview))!;
    final o = await (db.select(db.occurrences)..where((t) => t.routineId.equals(r.id))).getSingle();
    return o.status;
  }

  test('only a promise for today completes the morning review', () async {
    final review = (await db.routineBySystemKey(SystemRoutine.morningReview))!;
    await app.saveRoutine(RoutinesCompanion(id: Value(review.id)));
    expect(await morningReview(), OccurrenceStatus.pending);

    await app.addPromise(
      PromisesCompanion.insert(day: DateTime(2026, 10, 13), title: 'Tomorrow', promisedMinutes: 30),
    );
    expect(await morningReview(), OccurrenceStatus.pending);

    await app.addPromise(
      PromisesCompanion.insert(day: DateTime(2026, 10, 12), title: 'Today', promisedMinutes: 30),
    );
    expect(await morningReview(), OccurrenceStatus.done);
  });

  test('reopening a kept promise clears the time spent', () async {
    await app.addPromise(
      PromisesCompanion.insert(day: DateTime(2026, 10, 13), title: 'Read', promisedMinutes: 30),
    );
    final id = (await db.select(db.promises).getSingle()).id;

    await app.setPromiseKept(id, true, 45);
    var p = await db.select(db.promises).getSingle();
    expect((p.status, p.actualMinutes), (PromiseStatus.kept, 45));

    await app.setPromiseKept(id, false, 45);
    p = await db.select(db.promises).getSingle();
    expect((p.status, p.actualMinutes), (PromiseStatus.open, null));
  });

  test('a new location alarm is saved off; switching it on resyncs tracking', () async {
    final id = await app.saveLocationAlarm(
      const LocationAlarmsCompanion(name: Value('Home'), lat: Value(12.9), lng: Value(77.6)),
    );
    expect((await db.select(db.locationAlarms).getSingle()).enabled, isFalse);
    expect(syncs, 0);

    await (db.update(db.locationAlarms)).write(const LocationAlarmsCompanion(inside: Value(true)));
    await app.setLocationAlarmEnabled(id, true);
    final alarm = await db.select(db.locationAlarms).getSingle();
    expect((alarm.enabled, alarm.inside), (true, null));
    expect(syncs, 1);
  });

  test('archiving and deleting a goal', () async {
    await app.saveGoal(
      GoalsCompanion.insert(name: 'Write', targetMinutes: 600, startDate: DateTime(2026, 10, 12), totalDays: 7),
    );
    final id = (await db.select(db.goals).getSingle()).id;
    await app.saveGoal(const GoalsCompanion(name: Value('Write more')), id: id);
    await app.setGoalArchived(id, true);
    final goal = await db.select(db.goals).getSingle();
    expect((goal.name, goal.archived), ('Write more', true));

    await app.deleteGoal(id);
    expect(await db.select(db.goals).get(), isEmpty);
  });
}
