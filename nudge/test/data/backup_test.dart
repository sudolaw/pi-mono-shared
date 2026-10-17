import 'dart:convert';

import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/clock.dart';
import 'package:nudge/data/backup.dart';
import 'package:nudge/data/db.dart';

AppDb memoryDb() => AppDb(NativeDatabase.memory());

Future<void> fill(AppDb db) async {
  final goal = await db
      .into(db.goals)
      .insert(
        GoalsCompanion.insert(
          name: '3D printer',
          targetMinutes: 120,
          startDate: DateTime(2026, 10, 1),
          totalDays: 30,
        ),
      );
  await db
      .into(db.promises)
      .insert(
        PromisesCompanion.insert(
          day: DateTime(2026, 10, 2),
          title: 'Research',
          goalId: Value(goal),
          promisedMinutes: 60,
          status: const Value(PromiseStatus.kept),
        ),
      );
  await db
      .into(db.locationAlarms)
      .insert(
        LocationAlarmsCompanion.insert(
          name: 'Bus stop',
          lat: 19.07,
          lng: 72.87,
          ringing: const Value(true),
        ),
      );
}

void main() {
  setUpAll(() => driftRuntimeOptions.dontWarnAboutMultipleDatabases = true);

  test('export then import into a fresh install gives the same data back', () async {
    final old = memoryDb();
    await fill(old);
    final json = await exportBackup(old, DateTime(2026, 10, 13));
    expect(json, contains('"app": "nudge"'));

    final fresh = memoryDb();
    final counts = await importBackup(fresh, json);
    expect(counts, (routines: 0, promises: 1, goals: 1, alarms: 1));

    Future<List<Map<String, dynamic>>> rows(AppDb db, TableInfo t) async => [
      for (final r in await db.select(t).get()) (r as DataClass).toJson(),
    ];
    expect(await rows(fresh, fresh.goals), await rows(old, old.goals));
    expect(await rows(fresh, fresh.promises), await rows(old, old.promises));
    expect(await rows(fresh, fresh.routines), await rows(old, old.routines));
    final alarm = await fresh.select(fresh.locationAlarms).getSingle();
    expect(alarm.name, 'Bus stop');
    expect(alarm.ringing, isFalse, reason: 'nothing rings on restore');
    await old.close();
    await fresh.close();
  });

  test('an old backup\'s evening review is skipped', () async {
    // After 08:00, so a fresh install doesn't seed today's morning review.
    appNow = () => DateTime(2026, 10, 13, 12);
    addTearDown(() => appNow = DateTime.now);
    final old = memoryDb();
    await fill(old);
    final file = jsonDecode(await exportBackup(old, DateTime(2026, 10, 13))) as Map;
    (file['routines'] as List).add({'id': 7, 'systemKey': 'evening_review', 'kind': 3});
    (file['occurrences'] as List).add({'id': 9, 'routineId': 7});

    final fresh = memoryDb();
    await importBackup(fresh, jsonEncode(file));
    final keys = [for (final r in await fresh.select(fresh.routines).get()) r.systemKey];
    expect(keys, ['morning_review']);
    expect(await fresh.select(fresh.occurrences).get(), isEmpty);
    await old.close();
    await fresh.close();
  });

  test('a bad file is refused and leaves the data untouched', () async {
    final db = memoryDb();
    await fill(db);
    await expectLater(importBackup(db, 'not json'), throwsA(isA<BackupException>()));
    await expectLater(importBackup(db, '{"app": "other"}'), throwsA(isA<BackupException>()));
    await expectLater(
      importBackup(db, '{"app": "nudge", "format": 1, "goals": [{"id": "x"}]}'),
      throwsA(isA<BackupException>()),
    );
    expect(await db.select(db.goals).get(), hasLength(1));
    expect(await db.select(db.promises).get(), hasLength(1));
    await db.close();
  });

  test('a goal and its promises are deleted two months after it ended', () async {
    final db = memoryDb();
    await fill(db); // goal runs 1–30 Oct 2026, so it goes after 30 Dec
    await db.purgeFinishedGoals(DateTime(2026, 12, 30));
    expect(await db.select(db.goals).get(), hasLength(1));
    await db.purgeFinishedGoals(DateTime(2026, 12, 31));
    expect(await db.select(db.goals).get(), isEmpty);
    expect(await db.select(db.promises).get(), isEmpty);
    await db.close();
  });
}
