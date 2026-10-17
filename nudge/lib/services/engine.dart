import 'package:drift/drift.dart';

import '../core/dates.dart';
import '../core/nag.dart';
import '../core/recurrence.dart';
import '../data/db.dart';

/// Shows and clears reminder notifications. Implemented by the real
/// notification service and by a fake in tests.
abstract interface class ReminderNotifier {
  Future<void> showReminder(Occurrence occurrence, Routine routine);
  Future<void> showMissed(Occurrence occurrence, Routine routine);
  Future<void> cancelReminder(int occurrenceId);

  /// Clears every Nudge notification (after a restore replaces the data).
  Future<void> cancelAll();
}

/// Days of missed occurrences recorded when the app has not run for a while.
const _maxBackfillDays = 31;

/// How long the Snooze button delays the next reminder.
const defaultSnooze = Duration(minutes: 15);

/// The reminder engine: creates occurrences, fires due nags, marks missed
/// windows and says when it next needs to run. Has no timers of its own; the
/// scheduler calls [tick] from an exact Android alarm.
class ReminderEngine {
  ReminderEngine(this.db, this.notifier);

  final AppDb db;
  final ReminderNotifier notifier;

  /// Brings everything up to date at [now]. Returns when the next tick is
  /// needed, or null when nothing is pending.
  Future<DateTime?> tick(DateTime now) {
    return db.transaction(() async {
      // Housekeeping rides on the tick, which runs at least every midnight.
      await db.purgeFinishedGoals(now);
      final routines = {for (final r in await db.activeRoutines()) r.id: r};
      var wake = _nextMidnight(now);

      for (final r in routines.values) {
        if (r.kind != RoutineKind.todo) await _generate(r, now);
      }

      for (final o in await db.pendingOccurrences()) {
        final r = routines[o.routineId];
        if (r == null) continue;
        final next = await _process(o, r, now);
        if (next != null && next.isBefore(wake)) wake = next;
      }
      return wake;
    });
  }

  /// Creates the occurrences of a daily/repeated/review routine from the day
  /// after it was last generated through today.
  Future<void> _generate(Routine r, DateTime now) async {
    final rec = r.recurrence == null ? null : Recurrence.decode(r.recurrence!);
    final time = r.timeMinutes;
    if (rec == null || time == null) return;
    final today = dateOnly(now);
    final through = r.generatedThrough;
    var from = through == null ? today : addDays(through, 1);
    final earliest = addDays(today, -_maxBackfillDays);
    if (from.isBefore(earliest)) from = earliest;
    if (from.isAfter(today)) return;

    for (final day in rec.datesBetween(from, today)) {
      final window = occurrenceWindow(day, time, r.deadlineMinutes);
      final missed = !window.end.isAfter(now);
      await db
          .into(db.occurrences)
          .insert(
            OccurrencesCompanion.insert(
              routineId: r.id,
              day: day,
              startAt: window.start,
              windowEnd: Value(window.end),
              status: Value(missed ? OccurrenceStatus.missed : OccurrenceStatus.pending),
            ),
            mode: InsertMode.insertOrIgnore,
          );
    }
    await (db.update(
      db.routines,
    )..where((t) => t.id.equals(r.id))).write(RoutinesCompanion(generatedThrough: Value(today)));
  }

  Future<DateTime?> _process(Occurrence o, Routine r, DateTime now) async {
    final end = o.windowEnd;
    if (end != null && !now.isBefore(end)) {
      if (o.quiet) {
        await (db.delete(db.occurrences)..where((t) => t.id.equals(o.id))).go();
        return null;
      }
      await (db.update(db.occurrences)..where((t) => t.id.equals(o.id))).write(
        const OccurrencesCompanion(status: Value(OccurrenceStatus.missed)),
      );
      await notifier.cancelReminder(o.id);
      if (r.kind == RoutineKind.todo && !o.missedAlertSent) {
        await notifier.showMissed(o, r);
        await (db.update(db.occurrences)..where((t) => t.id.equals(o.id))).write(
          const OccurrencesCompanion(missedAlertSent: Value(true)),
        );
      }
      return null;
    }

    if (o.quiet) {
      // Never nags; the end of its window is handled above.
      return end;
    }

    if (now.isBefore(o.startAt)) return o.startAt;

    DateTime? next;
    if (nags(r)) {
      final policy = nagPolicyFor(r, o);
      final due = policy.fireAtOrBefore(o.startAt, now, snoozedUntil: o.snoozedUntil);
      if (due != null && (o.lastFiredAt == null || o.lastFiredAt!.isBefore(due))) {
        await _fire(o, r, now);
      }
      next = policy.nextFireAfter(o.startAt, now, snoozedUntil: o.snoozedUntil);
    } else if (r.kind == RoutineKind.todo) {
      next = await _remindDaily(o, r, now);
    } else {
      final snooze = o.snoozedUntil;
      if (o.lastFiredAt == null) {
        await _fire(o, r, now);
      } else if (snooze != null && !now.isBefore(snooze) && o.lastFiredAt!.isBefore(snooze)) {
        await _fire(o, r, now);
      } else if (snooze != null && now.isBefore(snooze)) {
        next = snooze;
      }
    }
    if (end != null && (next == null || end.isBefore(next))) next = end;
    return next;
  }

  /// A to-do without nagging: reminds at its start time once a day until done.
  Future<DateTime> _remindDaily(Occurrence o, Routine r, DateTime now) async {
    var k = now.difference(o.startAt).inDays;
    if (_plusDays(o.startAt, k).isAfter(now)) k--;
    var due = _plusDays(o.startAt, k);
    final snooze = o.snoozedUntil;
    if (snooze != null && !now.isBefore(snooze) && snooze.isAfter(due)) due = snooze;
    if (o.lastFiredAt == null || o.lastFiredAt!.isBefore(due)) await _fire(o, r, now);
    var next = _plusDays(o.startAt, k + 1);
    if (snooze != null && snooze.isAfter(now) && snooze.isBefore(next)) next = snooze;
    return next;
  }

  Future<void> _fire(Occurrence o, Routine r, DateTime now) async {
    await notifier.showReminder(o, r);
    await (db.update(
      db.occurrences,
    )..where((t) => t.id.equals(o.id))).write(OccurrencesCompanion(lastFiredAt: Value(now)));
  }

  /// Marks an occurrence done. A to-do with regen comes back [Routine.regenDays]
  /// days after today, at the same time of day and with the same deadline span.
  /// Gone (its routine was deleted) or already done: nothing happens, so a
  /// stale notification button or a double tap is harmless.
  Future<void> markDone(int occurrenceId, DateTime now) {
    return db.transaction(() async {
      await notifier.cancelReminder(occurrenceId);
      final o = await _occurrence(occurrenceId);
      if (o == null || o.status == OccurrenceStatus.done) return;
      await (db.update(db.occurrences)..where((t) => t.id.equals(occurrenceId))).write(
        OccurrencesCompanion(status: const Value(OccurrenceStatus.done), doneAt: Value(now)),
      );

      final r = await _routine(o.routineId);
      final regen = r.regenDays;
      if (r.kind != RoutineKind.todo || regen == null || !r.active) return;
      final start = DateTime(
        now.year,
        now.month,
        now.day + regen,
        o.startAt.hour,
        o.startAt.minute,
      );
      final end = o.windowEnd == null ? null : start.add(o.windowEnd!.difference(o.startAt));
      await (db.update(db.routines)..where((t) => t.id.equals(r.id))).write(
        RoutinesCompanion(startAt: Value(start), endAt: Value(end)),
      );
      await db
          .into(db.occurrences)
          .insert(
            OccurrencesCompanion.insert(
              routineId: r.id,
              day: dateOnly(start),
              startAt: start,
              windowEnd: Value(end),
            ),
            mode: InsertMode.insertOrIgnore,
          );
    });
  }

  /// Undo a Done tap: the occurrence reminds again if its window is still
  /// open, and a regenerated next round of a to-do is withdrawn.
  Future<void> markPending(int occurrenceId) {
    return db.transaction(() async {
      final o = await _occurrence(occurrenceId);
      if (o == null || o.status != OccurrenceStatus.done) return;
      await (db.update(db.occurrences)..where((t) => t.id.equals(occurrenceId))).write(
        const OccurrencesCompanion(
          status: Value(OccurrenceStatus.pending),
          doneAt: Value(null),
          lastFiredAt: Value(null),
        ),
      );
      final r = await _routine(o.routineId);
      if (r.kind != RoutineKind.todo || r.regenDays == null) return;
      final next =
          await (db.select(db.occurrences)..where(
                (t) =>
                    t.routineId.equals(r.id) &
                    t.id.equals(o.id).not() &
                    t.status.equalsValue(OccurrenceStatus.pending),
              ))
              .get();
      for (final n in next) {
        await notifier.cancelReminder(n.id);
        await (db.delete(db.occurrences)..where((t) => t.id.equals(n.id))).go();
      }
      await (db.update(db.routines)..where((t) => t.id.equals(r.id))).write(
        RoutinesCompanion(startAt: Value(o.startAt), endAt: Value(o.windowEnd)),
      );
    });
  }

  Future<Occurrence?> _occurrence(int id) =>
      (db.select(db.occurrences)..where((t) => t.id.equals(id))).getSingleOrNull();

  Future<Routine> _routine(int id) =>
      (db.select(db.routines)..where((t) => t.id.equals(id))).getSingle();

  Future<void> snooze(int occurrenceId, DateTime now, [Duration by = defaultSnooze]) async {
    await (db.update(db.occurrences)..where((t) => t.id.equals(occurrenceId))).write(
      OccurrencesCompanion(snoozedUntil: Value(now.add(by))),
    );
    await notifier.cancelReminder(occurrenceId);
  }

  /// Saves a routine and resets its upcoming occurrences so edits take effect
  /// at once. Returns the routine id.
  Future<int> saveRoutine(RoutinesCompanion data, DateTime now) {
    return db.transaction(() async {
      final int id;
      if (data.id.present) {
        id = data.id.value;
        await (db.update(db.routines)..where((t) => t.id.equals(id))).write(data);
      } else {
        id = await db.into(db.routines).insert(data);
      }
      final r = await (db.select(db.routines)..where((t) => t.id.equals(id))).getSingle();

      // Drop not-yet-finished occurrences; they are rebuilt from the new settings.
      final stale =
          await (db.select(db.occurrences)..where(
                (t) => t.routineId.equals(id) & t.status.equalsValue(OccurrenceStatus.pending),
              ))
              .get();
      for (final o in stale) {
        await notifier.cancelReminder(o.id);
      }
      final today = dateOnly(now);
      final hadToday = stale.any((o) => dateOnly(o.day) == today && !o.quiet);
      await (db.delete(db.occurrences)
            ..where((t) => t.routineId.equals(id) & t.status.equalsValue(OccurrenceStatus.pending)))
          .go();

      if (!r.active) return id;

      if (r.kind == RoutineKind.todo) {
        // Rebuild the open round so a new start or deadline applies (a missed
        // one is revived). A one-time to-do that is done stays done; one with
        // regen always has a next round.
        await (db.delete(
              db.occurrences,
            )..where((t) => t.routineId.equals(id) & t.status.equalsValue(OccurrenceStatus.missed)))
            .go();
        final done = await (db.select(db.occurrences)..where((t) => t.routineId.equals(id))).get();
        if (r.startAt != null && (done.isEmpty || r.regenDays != null)) {
          await db
              .into(db.occurrences)
              .insert(
                OccurrencesCompanion.insert(
                  routineId: id,
                  day: dateOnly(r.startAt!),
                  startAt: r.startAt!,
                  windowEnd: Value(r.endAt),
                ),
                mode: InsertMode.insertOrIgnore,
              );
        }
        return id;
      }

      // Today's occurrence. Not started yet, or already running (an edit
      // mid-window): a normal one. Saved after its time with the window still
      // open: a quiet one, so it can be ticked today without nagging; a routine
      // created at 20:00 must not nag about 08:45.
      final rec = r.recurrence == null ? null : Recurrence.decode(r.recurrence!);
      if (rec != null && r.timeMinutes != null && rec.matchesPattern(today)) {
        final window = occurrenceWindow(today, r.timeMinutes!, r.deadlineMinutes);
        final upcoming = !window.start.isBefore(now);
        final open = window.end.isAfter(now);
        if (upcoming || open) {
          await db
              .into(db.occurrences)
              .insert(
                OccurrencesCompanion.insert(
                  routineId: id,
                  day: today,
                  startAt: window.start,
                  windowEnd: Value(window.end),
                  quiet: Value(!upcoming && !hadToday),
                ),
                mode: InsertMode.insertOrIgnore,
              );
        }
      }
      await (db.update(
        db.routines,
      )..where((t) => t.id.equals(id))).write(RoutinesCompanion(generatedThrough: Value(today)));
      return id;
    });
  }

  Future<void> deleteRoutine(int id) async {
    final pending = await (db.select(
      db.occurrences,
    )..where((t) => t.routineId.equals(id) & t.status.equalsValue(OccurrenceStatus.pending))).get();
    for (final o in pending) {
      await notifier.cancelReminder(o.id);
    }
    await (db.delete(db.routines)..where((t) => t.id.equals(id))).go();
  }

  /// Marks today's occurrence of a built-in review done (if there is one).
  Future<void> completeReview(String systemKey, DateTime now) async {
    final r = await db.routineBySystemKey(systemKey);
    if (r == null) return;
    final o = await (db.select(
      db.occurrences,
    )..where((t) => t.routineId.equals(r.id) & t.day.equals(dateOnly(now)))).getSingleOrNull();
    if (o != null && o.status == OccurrenceStatus.pending) await markDone(o.id, now);
  }
}

/// Whether a routine has a deadline. Nagging only exists with one.
bool hasDeadline(Routine r) =>
    r.kind == RoutineKind.todo ? r.endAt != null : r.deadlineMinutes != null;

/// Whether a routine nags (otherwise it just reminds).
bool nags(Routine r) => r.nagEnabled && hasDeadline(r);

/// The nag policy for one occurrence. Auto half-life reaches the fastest rate
/// at the occurrence's deadline.
NagPolicy nagPolicyFor(Routine r, Occurrence o) {
  final first = Duration(minutes: r.firstIntervalMinutes);
  final min = Duration(minutes: r.minIntervalMinutes);
  final end = o.windowEnd;
  final Duration? halfLife;
  if (r.autoHalfLife && end != null) {
    halfLife = NagPolicy.autoHalfLife(
      start: o.startAt,
      end: end,
      firstInterval: first,
      minInterval: min,
      factor: r.factor,
    );
  } else {
    halfLife = r.halfLifeMinutes == null ? null : Duration(minutes: r.halfLifeMinutes!);
  }
  return NagPolicy(firstInterval: first, halfLife: halfLife, factor: r.factor, minInterval: min);
}

/// Start and end of a daily/repeated occurrence: the deadline is [deadline]
/// minutes after the start; without one the occurrence runs to midnight.
({DateTime start, DateTime end}) occurrenceWindow(DateTime day, int time, int? deadline) {
  final start = atMinutes(day, time);
  final end = deadline != null && deadline > 0
      ? start.add(Duration(minutes: deadline))
      : addDays(day, 1);
  return (start: start, end: end);
}

DateTime _plusDays(DateTime t, int days) =>
    DateTime(t.year, t.month, t.day + days, t.hour, t.minute);

DateTime _nextMidnight(DateTime now) => addDays(dateOnly(now), 1).add(const Duration(seconds: 30));
