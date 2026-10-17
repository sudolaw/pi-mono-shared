import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import '../core/dates.dart';
import '../core/geo.dart' show defaultRearmMeters;
import '../core/goal_stats.dart' show goalDeletionDay;
import '../core/recurrence.dart';
import '../core/clock.dart';

part 'db.g.dart';

// Enum values are stored by index: only ever append new values.

enum RoutineKind { daily, repeated, todo, review }

enum AlertStyle { notification, alarm }

enum OccurrenceStatus { pending, done, missed }

enum PromiseStatus { open, kept, broken }

/// Built-in routines. The morning review reminds you to make today's
/// promises; it isn't shown in Promises, and adding a promise for today
/// completes it. (An evening review existed until schema 6.)
abstract final class SystemRoutine {
  static const morningReview = 'morning_review';
}

class LocationAlarms extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  RealColumn get lat => real()();
  RealColumn get lng => real()();
  IntColumn get radiusMeters => integer().withDefault(const Constant(150))();
  BoolColumn get enabled => boolean().withDefault(const Constant(true))();
  DateTimeColumn get lastTriggeredAt => dateTime().nullable()();

  /// True from the moment it triggers until the user stops the alarm.
  BoolColumn get ringing => boolean().withDefault(const Constant(false))();

  /// Last known side of the zone: inside, outside, or null (not known yet).
  /// The alarm rings on going from outside to inside.
  BoolColumn get inside => boolean().nullable()();

  /// How far past the radius you must go before it can ring again.
  IntColumn get rearmMeters => integer().withDefault(const Constant(defaultRearmMeters))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

/// A daily routine, repeated routine, to-do or built-in review.
class Routines extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get title => text()();
  TextColumn get notes => text().withDefault(const Constant(''))();
  IntColumn get kind => intEnum<RoutineKind>()();

  /// Daily/repeated/review: minutes after midnight it starts.
  IntColumn get timeMinutes => integer().nullable()();

  /// Unused since schema 3 (replaced by [deadlineMinutes]).
  IntColumn get untilMinutes => integer().nullable()();

  /// Daily/repeated/review: deadline as minutes after the start (may span
  /// days). Without one the occurrence runs to midnight and never nags.
  IntColumn get deadlineMinutes => integer().nullable()();

  /// Daily/repeated: the encoded [Recurrence].
  TextColumn get recurrence => text().nullable()();

  /// To-do: when it starts and its optional deadline.
  DateTimeColumn get startAt => dateTime().nullable()();
  DateTimeColumn get endAt => dateTime().nullable()();

  /// To-do: comes back this many days after it is done (null: one-time).
  IntColumn get regenDays => integer().nullable()();

  BoolColumn get nagEnabled => boolean().withDefault(const Constant(true))();
  IntColumn get firstIntervalMinutes => integer().withDefault(const Constant(10))();

  /// Custom half-life; null with [autoHalfLife] off means a fixed interval.
  IntColumn get halfLifeMinutes => integer().nullable()();
  BoolColumn get autoHalfLife => boolean().withDefault(const Constant(false))();
  RealColumn get factor => real().withDefault(const Constant(2))();
  IntColumn get minIntervalMinutes => integer().withDefault(const Constant(15))();
  IntColumn get alertStyle =>
      intEnum<AlertStyle>().withDefault(Constant(AlertStyle.notification.index))();

  BoolColumn get active => boolean().withDefault(const Constant(true))();

  /// Last day occurrences were created for (daily/repeated/review).
  DateTimeColumn get generatedThrough => dateTime().nullable()();

  /// Set for built-in routines, see [SystemRoutine].
  TextColumn get systemKey => text().nullable().unique()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

/// One instance of a routine: today's "leave for office", or a to-do's single run.
class Occurrences extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get routineId => integer().references(Routines, #id, onDelete: KeyAction.cascade)();
  DateTimeColumn get day => dateTime()();
  DateTimeColumn get startAt => dateTime()();

  /// Null: no end (a to-do without an end date).
  DateTimeColumn get windowEnd => dateTime().nullable()();
  IntColumn get status =>
      intEnum<OccurrenceStatus>().withDefault(Constant(OccurrenceStatus.pending.index))();
  DateTimeColumn get doneAt => dateTime().nullable()();
  DateTimeColumn get snoozedUntil => dateTime().nullable()();
  DateTimeColumn get lastFiredAt => dateTime().nullable()();
  BoolColumn get missedAlertSent => boolean().withDefault(const Constant(false))();

  /// Created after its start time (the routine was added late in the day): it
  /// can be ticked but never nags, and disappears instead of counting as missed.
  BoolColumn get quiet => boolean().withDefault(const Constant(false))();

  @override
  List<Set<Column>> get uniqueKeys => [
    {routineId, day},
  ];
}

class Goals extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  IntColumn get targetMinutes => integer()();
  DateTimeColumn get startDate => dateTime()();
  IntColumn get totalDays => integer()();
  BoolColumn get archived => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

@DataClassName('PromiseEntry')
class Promises extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get day => dateTime()();
  TextColumn get title => text()();
  IntColumn get goalId =>
      integer().nullable().references(Goals, #id, onDelete: KeyAction.setNull)();
  IntColumn get promisedMinutes => integer()();

  /// Time actually spent, when it differs from the promise.
  IntColumn get actualMinutes => integer().nullable()();
  IntColumn get status =>
      intEnum<PromiseStatus>().withDefault(Constant(PromiseStatus.open.index))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

/// A promise with its effective status: open promises from past days are broken.
extension PromiseEntryStatus on PromiseEntry {
  PromiseStatus effectiveStatus(DateTime today) =>
      status == PromiseStatus.open && dateOnly(day).isBefore(dateOnly(today))
      ? PromiseStatus.broken
      : status;

  /// Minutes that count toward the goal.
  int get creditedMinutes => status == PromiseStatus.kept ? (actualMinutes ?? promisedMinutes) : 0;
}

@DriftDatabase(tables: [LocationAlarms, Routines, Occurrences, Goals, Promises])
class AppDb extends _$AppDb {
  AppDb([QueryExecutor? executor]) : super(executor ?? _open());

  @override
  int get schemaVersion => 6;

  var _created = false;

  /// Whether opening the database created it: the first run after install.
  Future<bool> isFirstRun() async {
    await customSelect('SELECT 1').get();
    return _created;
  }

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      _created = true;
      await m.createAll();
      await _seedSystemRoutines();
    },
    onUpgrade: (m, from, to) async {
      if (from < 2) await m.addColumn(occurrences, occurrences.quiet);
      if (from < 3) {
        await m.addColumn(routines, routines.deadlineMinutes);
        await m.addColumn(routines, routines.regenDays);
        await customStatement(
          'UPDATE routines SET deadline_minutes = until_minutes - time_minutes '
          'WHERE until_minutes > time_minutes',
        );
        // Reviews nag until a deadline now that nagging needs one.
        await customStatement(
          "UPDATE routines SET deadline_minutes = 180 WHERE system_key = 'morning_review'",
        );
        await customStatement(
          "UPDATE routines SET deadline_minutes = 150 WHERE system_key = 'evening_review'",
        );
      }
      if (from < 4) await m.addColumn(locationAlarms, locationAlarms.inside);
      if (from < 5) await m.addColumn(locationAlarms, locationAlarms.rearmMeters);
      if (from < 6) {
        // The evening review is gone. Foreign keys are off during migration,
        // so delete its occurrences first.
        await customStatement(
          'DELETE FROM occurrences WHERE routine_id IN '
          "(SELECT id FROM routines WHERE system_key = 'evening_review')",
        );
        await customStatement("DELETE FROM routines WHERE system_key = 'evening_review'");
        await customStatement(
          "UPDATE routines SET title = 'Make today''s promises' WHERE system_key = 'morning_review'",
        );
      }
    },
    beforeOpen: (details) async {
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );

  static QueryExecutor _open() => driftDatabase(
    name: 'nudge',
    native: DriftNativeOptions(
      // Several isolates (UI, alarm callbacks, notification actions, the
      // location service) open their own connection to the same file.
      setup: (db) {
        db.execute('PRAGMA journal_mode = WAL');
        db.execute('PRAGMA busy_timeout = 5000');
      },
    ),
  );

  Future<void> _seedSystemRoutines() async {
    final today = dateOnly(appNow());
    for (final (key, title, minutes, deadline) in [
      (SystemRoutine.morningReview, 'Make today\'s promises', 8 * 60, 180),
    ]) {
      await into(routines).insert(
        RoutinesCompanion.insert(
          title: title,
          kind: RoutineKind.review,
          systemKey: Value(key),
          timeMinutes: Value(minutes),
          deadlineMinutes: Value(deadline),
          // A fixed early start: every day matches (generatedThrough stops backfill).
          recurrence: Value(Recurrence.daily(DateTime(2000)).encode()),
          firstIntervalMinutes: const Value(15),
          halfLifeMinutes: const Value(30),
          minIntervalMinutes: const Value(5),
          generatedThrough: Value(today),
        ),
      );
    }
    // Today's review only if its time is still ahead; the engine creates the
    // following days' ones.
    final now = appNow();
    for (final r in await select(routines).get()) {
      final start = atMinutes(today, r.timeMinutes!);
      if (start.isBefore(now)) continue;
      await into(occurrences).insert(
        OccurrencesCompanion.insert(
          routineId: r.id,
          day: today,
          startAt: start,
          windowEnd: Value(start.add(Duration(minutes: r.deadlineMinutes!))),
        ),
      );
    }
  }

  // ---- Location alarms ----

  Stream<List<LocationAlarm>> watchLocationAlarms() =>
      (select(locationAlarms)..orderBy([(t) => OrderingTerm.asc(t.name)])).watch();

  Future<List<LocationAlarm>> enabledLocationAlarms() =>
      (select(locationAlarms)..where((t) => t.enabled)).get();

  Stream<List<LocationAlarm>> watchRingingAlarms() =>
      (select(locationAlarms)..where((t) => t.ringing)).watch();

  // ---- Routines ----

  Stream<List<Routine>> watchRoutines(RoutineKind kind) =>
      (select(routines)
            ..where((t) => t.kind.equalsValue(kind))
            ..orderBy([
              (t) => OrderingTerm.desc(t.active),
              (t) => OrderingTerm.asc(t.timeMinutes),
              (t) => OrderingTerm.asc(t.startAt),
              (t) => OrderingTerm.asc(t.title),
            ]))
          .watch();

  Future<Routine?> routineBySystemKey(String key) =>
      (select(routines)..where((t) => t.systemKey.equals(key))).getSingleOrNull();

  Stream<Routine?> watchRoutineBySystemKey(String key) =>
      (select(routines)..where((t) => t.systemKey.equals(key))).watchSingleOrNull();

  Future<List<Routine>> activeRoutines() => (select(routines)..where((t) => t.active)).get();

  Future<List<Occurrence>> pendingOccurrences() =>
      (select(occurrences)..where((t) => t.status.equalsValue(OccurrenceStatus.pending))).get();

  /// The latest occurrence of each routine, for showing today's state.
  ///
  /// The database picks one row per routine, so this stays small however much
  /// history builds up.
  Stream<Map<int, Occurrence>> watchLatestOccurrences() {
    return customSelect(
      'SELECT o.* FROM occurrences o '
      'JOIN (SELECT routine_id, MAX(start_at) AS latest FROM occurrences '
      'GROUP BY routine_id) m '
      'ON o.routine_id = m.routine_id AND o.start_at = m.latest',
      readsFrom: {occurrences},
    ).watch().map(
      (rows) => {for (final row in rows) row.read<int>('routine_id'): occurrences.map(row.data)},
    );
  }

  Stream<List<Occurrence>> watchHistory(int routineId) =>
      (select(occurrences)
            ..where((t) => t.routineId.equals(routineId))
            ..orderBy([(t) => OrderingTerm.desc(t.startAt)])
            ..limit(60))
          .watch();

  // ---- Goals and promises ----

  Stream<List<Goal>> watchGoals() => (select(
    goals,
  )..orderBy([(t) => OrderingTerm.asc(t.archived), (t) => OrderingTerm.asc(t.name)])).watch();

  Stream<List<PromiseEntry>> watchPromisesFor(DateTime day) =>
      (select(promises)
            ..where((t) => t.day.equals(dateOnly(day)))
            ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
          .watch();

  /// Deletes, permanently, goals whose deletion day (two months after they
  /// ended) is before [today], together with all their promises.
  Future<void> purgeFinishedGoals(DateTime today) async {
    final day = dateOnly(today);
    final expired = [
      for (final g in await select(goals).get())
        if (goalDeletionDay(g.startDate, g.totalDays).isBefore(day)) g.id,
    ];
    if (expired.isEmpty) return;
    await transaction(() async {
      await (delete(promises)..where((t) => t.goalId.isIn(expired))).go();
      await (delete(goals)..where((t) => t.id.isIn(expired))).go();
    });
  }

  /// Kept promises of a goal (or, with null, those without a goal), newest first.
  Stream<List<PromiseEntry>> watchKeptPromises(int? goalId) =>
      (select(promises)
            ..where(
              (t) =>
                  (goalId == null ? t.goalId.isNull() : t.goalId.equals(goalId)) &
                  t.status.equalsValue(PromiseStatus.kept),
            )
            ..orderBy([(t) => OrderingTerm.desc(t.day), (t) => OrderingTerm.desc(t.createdAt)]))
          .watch();

  Stream<List<PromiseEntry>> watchPromisesSince(DateTime day) =>
      (select(promises)..where((t) => t.day.isBiggerOrEqualValue(dateOnly(day)))).watch();

  /// Minutes credited to each goal by kept promises, summed by the database.
  Stream<Map<int, int>> watchGoalMinutes() {
    final minutes = coalesce([promises.actualMinutes, promises.promisedMinutes]).sum();
    final q = selectOnly(promises)
      ..addColumns([promises.goalId, minutes])
      ..where(promises.goalId.isNotNull() & promises.status.equalsValue(PromiseStatus.kept))
      ..groupBy([promises.goalId]);
    return q.watch().map(
      (rows) => {for (final r in rows) r.read(promises.goalId)!: r.read(minutes) ?? 0},
    );
  }

  /// Mark every table changed so open screens re-read data written by other
  /// isolates (notification actions, alarm callbacks).
  void refreshAll() => notifyUpdates({for (final t in allTables) TableUpdate.onTable(t)});
}
