import 'dart:io';

import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/clock.dart';
import 'package:nudge/data/db.dart';

void main() {
  test(
    'upgrading from schema 1 adds the new columns, keeps data, drops the evening review',
    () async {
      // After 08:00, so the new database doesn't seed today's morning review.
      appNow = () => DateTime(2026, 10, 13, 12);
      addTearDown(() => appNow = DateTime.now);
      final dir = await Directory.systemTemp.createTemp('nudge_migration');
      final file = File('${dir.path}/nudge.sqlite');
      addTearDown(() => dir.delete(recursive: true));

      // Build a schema-1 database: today's schema without the later columns,
      // with the old built-in evening review beside the morning one.
      final current = AppDb(NativeDatabase(file));
      final morning = (await current.select(current.routines).get()).single;
      final evening = await current
          .into(current.routines)
          .insert(
            RoutinesCompanion.insert(
              title: 'Evening review',
              kind: RoutineKind.review,
              systemKey: const Value('evening_review'),
            ),
          );
      for (final id in [morning.id, evening]) {
        await current
            .into(current.occurrences)
            .insert(
              OccurrencesCompanion.insert(
                routineId: id,
                day: DateTime(2026, 10, 1),
                startAt: DateTime(2026, 10, 1, 8),
              ),
            );
      }
      await current.customStatement('ALTER TABLE occurrences DROP COLUMN quiet');
      await current.customStatement('ALTER TABLE routines DROP COLUMN deadline_minutes');
      await current.customStatement('ALTER TABLE routines DROP COLUMN regen_days');
      await current.customStatement('ALTER TABLE location_alarms DROP COLUMN inside');
      await current.customStatement('ALTER TABLE location_alarms DROP COLUMN rearm_meters');
      await current.customStatement('PRAGMA user_version = 1');
      await current.close();

      final upgraded = AppDb(NativeDatabase(file));
      addTearDown(upgraded.close);
      expect(await upgraded.isFirstRun(), isFalse, reason: 'an upgrade is not a new install');
      final routines = await upgraded.select(upgraded.routines).get();
      expect(routines.map((r) => (r.title, r.deadlineMinutes)), [("Make today's promises", 180)]);
      final rows = await upgraded.select(upgraded.occurrences).get();
      expect(rows.map((o) => (o.routineId, o.quiet)), [(morning.id, false)]);
    },
  );
}
