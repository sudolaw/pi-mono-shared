import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/recurrence.dart';
import 'package:nudge/data/db.dart';
import 'package:nudge/services/engine.dart';

class FakeNotifier implements ReminderNotifier {
  final shown = <String>[];
  final missed = <String>[];
  final cancelled = <int>[];

  @override
  Future<void> showReminder(Occurrence o, Routine r) async => shown.add(r.title);

  @override
  Future<void> showMissed(Occurrence o, Routine r) async => missed.add(r.title);

  @override
  Future<void> cancelReminder(int occurrenceId) async => cancelled.add(occurrenceId);

  @override
  Future<void> cancelAll() async {}
}

DateTime at(int day, int h, [int m = 0]) => DateTime(2026, 10, day, h, m);

void main() {
  late AppDb db;
  late FakeNotifier notifier;
  late ReminderEngine engine;

  setUp(() async {
    db = AppDb(NativeDatabase.memory());
    notifier = FakeNotifier();
    engine = ReminderEngine(db, notifier);
    // Pause the built-in morning review so it doesn't add noise.
    await db.update(db.routines).write(const RoutinesCompanion(active: Value(false)));
    await db.delete(db.occurrences).go();
  });

  tearDown(() => db.close());

  Future<int> daily(String title, int time, {int? deadline, DateTime? savedAt}) =>
      engine.saveRoutine(
        RoutinesCompanion.insert(
          title: title,
          kind: RoutineKind.daily,
          timeMinutes: Value(time),
          deadlineMinutes: Value(deadline),
          recurrence: Value(Recurrence.daily(DateTime(2026, 10, 1)).encode()),
          firstIntervalMinutes: const Value(10),
          halfLifeMinutes: const Value(15),
          minIntervalMinutes: const Value(5),
        ),
        savedAt ?? at(12, 7),
      );

  test('only the built-in morning review is seeded', () async {
    final rows = await db.select(db.routines).get();
    expect(rows.map((r) => r.systemKey), ['morning_review']);
  });

  test('daily routine nags with half-life inside its window, then is missed', () async {
    await daily('Leave for office', 8 * 60 + 45, deadline: 30);

    expect(await engine.tick(at(12, 8)), at(12, 8, 45));
    expect(notifier.shown, isEmpty);

    expect(await engine.tick(at(12, 8, 45)), at(12, 8, 55));
    expect(notifier.shown, ['Leave for office']);

    // Already fired for 8:45; nothing new at 8:50.
    await engine.tick(at(12, 8, 50));
    expect(notifier.shown.length, 1);

    // 8:55 fires; elapsed 10 min < half-life, so the next gap is still 10 min.
    expect(await engine.tick(at(12, 8, 55)), at(12, 9, 5));
    // 9:05 fires; elapsed 20 min ≥ 15, so the gap halves to 5 min.
    expect(await engine.tick(at(12, 9, 5)), at(12, 9, 10));
    expect(notifier.shown.length, 3);

    // Window ends at 9:15: marked missed, notification cleared.
    await engine.tick(at(12, 9, 15));
    final occ = await db.select(db.occurrences).getSingle();
    expect(occ.status, OccurrenceStatus.missed);
    expect(notifier.cancelled, contains(occ.id));
    expect(notifier.missed, isEmpty, reason: 'routines miss silently');
  });

  test('Done stops the nagging', () async {
    await daily('Morning routine', 7 * 60 + 30);
    await engine.tick(at(12, 7, 30));
    final occ = await db.select(db.occurrences).getSingle();
    await engine.markDone(occ.id, at(12, 7, 35));
    await engine.tick(at(12, 8));
    expect(notifier.shown.length, 1);
  });

  test('snooze delays the next reminder', () async {
    await daily('Gym', 7 * 60 + 30);
    await engine.tick(at(12, 7, 30));
    final occ = await db.select(db.occurrences).getSingle();
    await engine.snooze(occ.id, at(12, 7, 31), const Duration(minutes: 30));
    expect(await engine.tick(at(12, 7, 45)), at(12, 8, 1));
    expect(notifier.shown.length, 1);
    await engine.tick(at(12, 8, 1));
    expect(notifier.shown.length, 2);
  });

  test('a routine saved after its time can be ticked today but never nags', () async {
    await daily('Brush teeth', 9 * 60, savedAt: at(12, 17));
    final today = await db.select(db.occurrences).getSingle();
    expect(today.day, DateTime(2026, 10, 12));
    expect(today.quiet, isTrue);

    await engine.tick(at(12, 17, 1));
    await engine.tick(at(12, 22));
    expect(notifier.shown, isEmpty);

    // Editing it keeps it quiet.
    await engine.saveRoutine(
      RoutinesCompanion(id: Value(today.routineId), title: const Value('Brush teeth!')),
      at(12, 18),
    );
    await engine.tick(at(12, 18, 30));
    expect(notifier.shown, isEmpty);
    expect((await db.select(db.occurrences).getSingle()).quiet, isTrue);
  });

  test('an unticked quiet occurrence disappears instead of counting as missed', () async {
    await daily('Leave for office', 8 * 60 + 45, savedAt: at(12, 20));
    // Just after midnight: today's quiet one is gone, tomorrow's normal one exists.
    expect(await engine.tick(at(13, 0, 1)), at(13, 8, 45));
    final occ = await db.select(db.occurrences).getSingle();
    expect(occ.day, DateTime(2026, 10, 13));
    expect(occ.quiet, isFalse);
  });

  test('ticking a daily routine today brings it back pending tomorrow', () async {
    await daily('Brush teeth', 9 * 60, savedAt: at(12, 17));
    final today = await db.select(db.occurrences).getSingle();
    await engine.markDone(today.id, at(12, 17, 5));

    await engine.tick(at(13, 0, 1));
    final rows = await (db.select(db.occurrences)..orderBy([(t) => OrderingTerm.asc(t.day)])).get();
    expect(rows.map((o) => (o.day.day, o.status)), [
      (12, OccurrenceStatus.done),
      (13, OccurrenceStatus.pending),
    ]);
    // Tomorrow it reminds at 9:00 as usual.
    await engine.tick(at(13, 9));
    expect(notifier.shown, ['Brush teeth']);
  });

  test('days the app did not run are recorded as missed', () async {
    await daily('Read', 21 * 60, savedAt: at(10, 8));
    await engine.tick(at(13, 12));
    final rows = await (db.select(db.occurrences)..orderBy([(t) => OrderingTerm.asc(t.day)])).get();
    expect(rows.map((o) => (o.day.day, o.status)), [
      (10, OccurrenceStatus.missed),
      (11, OccurrenceStatus.missed),
      (12, OccurrenceStatus.missed),
      (13, OccurrenceStatus.pending),
    ]);
    expect(notifier.shown, isEmpty);
  });

  test('to-do sends one missed alert when its end passes', () async {
    await engine.saveRoutine(
      RoutinesCompanion.insert(
        title: 'Renew passport',
        kind: RoutineKind.todo,
        startAt: Value(at(12, 9)),
        endAt: Value(at(14, 9)),
        firstIntervalMinutes: const Value(240),
      ),
      at(12, 8),
    );
    await engine.tick(at(12, 9));
    expect(notifier.shown, ['Renew passport']);
    await engine.tick(at(14, 9));
    await engine.tick(at(14, 10));
    expect(notifier.missed, ['Renew passport']);
  });

  test('to-do without nagging fires once', () async {
    await engine.saveRoutine(
      RoutinesCompanion.insert(
        title: 'Call bank',
        kind: RoutineKind.todo,
        startAt: Value(at(12, 9)),
        nagEnabled: const Value(false),
      ),
      at(12, 8),
    );
    await engine.tick(at(12, 9));
    expect(await engine.tick(at(12, 12)), DateTime(2026, 10, 13, 0, 0, 30));
    expect(notifier.shown.length, 1);
  });

  test('editing a routine rebuilds today\'s pending occurrence', () async {
    final id = await daily('Leave for office', 8 * 60 + 45);
    await engine.saveRoutine(
      RoutinesCompanion(id: Value(id), timeMinutes: const Value(9 * 60)),
      at(12, 7, 30),
    );
    final occ = await db.select(db.occurrences).getSingle();
    expect(occ.startAt, at(12, 9));
  });

  test('editing a routine mid-window keeps today\'s reminders going', () async {
    final id = await daily('Leave for office', 8 * 60 + 45, deadline: 30);
    await engine.tick(at(12, 8, 45));
    await engine.saveRoutine(
      RoutinesCompanion(id: Value(id), title: const Value('Leave now')),
      at(12, 8, 50),
    );
    final occ = await db.select(db.occurrences).getSingle();
    expect(occ.status, OccurrenceStatus.pending);
    await engine.tick(at(12, 8, 51));
    expect(notifier.shown, ['Leave for office', 'Leave now']);
  });

  test('to-do without a deadline reminds once a day until done', () async {
    await engine.saveRoutine(
      RoutinesCompanion.insert(
        title: 'Call bank',
        kind: RoutineKind.todo,
        startAt: Value(at(12, 9)),
      ),
      at(12, 8),
    );
    await engine.tick(at(12, 9));
    await engine.tick(at(12, 15));
    await engine.tick(at(13, 9));
    expect(notifier.shown, ['Call bank', 'Call bank']);
  });

  test('to-do with regen comes back N days after it is ticked', () async {
    final id = await engine.saveRoutine(
      RoutinesCompanion.insert(
        title: 'Change toothbrush',
        kind: RoutineKind.todo,
        startAt: Value(at(12, 9)),
        endAt: Value(at(14, 9)),
        regenDays: const Value(90),
      ),
      at(12, 8),
    );
    final first = await db.select(db.occurrences).getSingle();
    // Ticked late, on the 20th: the next round is 90 days after that.
    await engine.markDone(first.id, at(20, 18));
    final r = await (db.select(db.routines)..where((t) => t.id.equals(id))).getSingle();
    expect(r.startAt, DateTime(2027, 1, 18, 9));
    expect(r.endAt, DateTime(2027, 1, 20, 9), reason: 'keeps the 2-day deadline');
    final next = await (db.select(
      db.occurrences,
    )..where((t) => t.status.equalsValue(OccurrenceStatus.pending))).getSingle();
    expect(next.startAt, DateTime(2027, 1, 18, 9));

    // Undoing the tick withdraws the next round.
    await engine.markPending(first.id);
    expect(await db.select(db.occurrences).get(), hasLength(1));
  });

  test('completing a review marks today done', () async {
    await db.update(db.routines).write(const RoutinesCompanion(active: Value(true)));
    final morning = (await db.routineBySystemKey(SystemRoutine.morningReview))!;
    await engine.saveRoutine(RoutinesCompanion(id: Value(morning.id)), at(12, 7));
    await engine.tick(at(12, 8));
    await engine.completeReview(SystemRoutine.morningReview, at(12, 8, 5));
    final occ = await (db.select(
      db.occurrences,
    )..where((t) => t.routineId.equals(morning.id))).getSingle();
    expect(occ.status, OccurrenceStatus.done);
  });
}
