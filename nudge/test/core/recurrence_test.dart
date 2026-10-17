import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/recurrence.dart';

DateTime d(int y, int m, int day) => DateTime(y, m, day);

void main() {
  test('daily on weekdays skips weekends', () {
    final r = Recurrence.daily(d(2026, 10, 12), weekdays: {1, 2, 3, 4, 5});
    expect(r.datesBetween(d(2026, 10, 12), d(2026, 10, 19)), [
      d(2026, 10, 12),
      d(2026, 10, 13),
      d(2026, 10, 14),
      d(2026, 10, 15),
      d(2026, 10, 16),
      d(2026, 10, 19),
    ]);
  });

  test('every day by default', () {
    final r = Recurrence.daily(d(2026, 10, 12));
    expect(r.datesBetween(d(2026, 10, 10), d(2026, 10, 14)), [
      d(2026, 10, 12),
      d(2026, 10, 13),
      d(2026, 10, 14),
    ]);
    expect(r.describe(), 'Every day');
  });

  test('every Thursday', () {
    final r = Recurrence(kind: RecurrenceKind.weekly, start: d(2026, 10, 12), weekdays: {4});
    expect(r.nextOnOrAfter(d(2026, 10, 12)), d(2026, 10, 15));
    expect(r.nextOnOrAfter(d(2026, 10, 16)), d(2026, 10, 22));
  });

  test('every 2 weeks on Mon and Thu counts weeks from the start week', () {
    final r = Recurrence(
      kind: RecurrenceKind.weekly,
      start: d(2026, 10, 14),
      interval: 2,
      weekdays: {1, 4},
    );
    expect(r.datesBetween(d(2026, 10, 12), d(2026, 11, 1)), [
      d(2026, 10, 15),
      d(2026, 10, 26),
      d(2026, 10, 29),
    ]);
    expect(r.describe(), 'Every 2 weeks on Mon, Thu');
  });

  test('every 3 days', () {
    final r = Recurrence(kind: RecurrenceKind.everyNDays, start: d(2026, 10, 30), interval: 3);
    expect(r.datesBetween(d(2026, 10, 30), d(2026, 11, 6)), [
      d(2026, 10, 30),
      d(2026, 11, 2),
      d(2026, 11, 5),
    ]);
  });

  test('3rd Wednesday of every month', () {
    final r = Recurrence(
      kind: RecurrenceKind.monthlyByWeekday,
      start: d(2026, 10, 1),
      weekday: DateTime.wednesday,
      weekOfMonth: 3,
    );
    expect(r.datesBetween(d(2026, 10, 1), d(2026, 12, 31)), [
      d(2026, 10, 21),
      d(2026, 11, 18),
      d(2026, 12, 16),
    ]);
    expect(r.describe(), 'Every month on the 3rd Wednesday');
  });

  test('last Friday of every month', () {
    final r = Recurrence(
      kind: RecurrenceKind.monthlyByWeekday,
      start: d(2026, 10, 1),
      weekday: DateTime.friday,
      weekOfMonth: -1,
    );
    expect(r.datesBetween(d(2026, 10, 1), d(2026, 11, 30)), [d(2026, 10, 30), d(2026, 11, 27)]);
  });

  test('5th Monday only in months that have one', () {
    final r = Recurrence(
      kind: RecurrenceKind.monthlyByWeekday,
      start: d(2026, 10, 1),
      weekday: DateTime.monday,
      weekOfMonth: 5,
    );
    expect(r.datesBetween(d(2026, 10, 1), d(2026, 12, 31)), [d(2026, 11, 30)]);
  });

  test('monthly on the 31st clamps to the last day', () {
    final r = Recurrence(kind: RecurrenceKind.monthlyByDate, start: d(2027, 1, 1), monthDay: 31);
    expect(r.datesBetween(d(2027, 1, 1), d(2027, 4, 30)), [
      d(2027, 1, 31),
      d(2027, 2, 28),
      d(2027, 3, 31),
      d(2027, 4, 30),
    ]);
  });

  test('every 2 months on the 15th', () {
    final r = Recurrence(
      kind: RecurrenceKind.monthlyByDate,
      start: d(2026, 10, 1),
      interval: 2,
      monthDay: 15,
    );
    expect(r.datesBetween(d(2026, 10, 1), d(2027, 2, 28)), [
      d(2026, 10, 15),
      d(2026, 12, 15),
      d(2027, 2, 15),
    ]);
  });

  test('yearly on Feb 29 falls on Feb 28 in other years', () {
    final r = Recurrence(kind: RecurrenceKind.yearly, start: d(2026, 1, 1), month: 2, monthDay: 29);
    expect(r.datesBetween(d(2026, 1, 1), d(2028, 12, 31)), [
      d(2026, 2, 28),
      d(2027, 2, 28),
      d(2028, 2, 29),
    ]);
  });

  test('ends after a count or on a date', () {
    final byCount = Recurrence(
      kind: RecurrenceKind.weekly,
      start: d(2026, 10, 12),
      weekdays: {1},
      count: 2,
    );
    expect(byCount.dates().toList(), [d(2026, 10, 12), d(2026, 10, 19)]);
    expect(byCount.nextOnOrAfter(d(2026, 10, 20)), isNull);

    final byDate = Recurrence(
      kind: RecurrenceKind.weekly,
      start: d(2026, 10, 12),
      weekdays: {1},
      until: d(2026, 10, 26),
    );
    expect(byDate.dates().toList(), [d(2026, 10, 12), d(2026, 10, 19), d(2026, 10, 26)]);
  });

  test('count is honored when asking from a later date', () {
    final r = Recurrence(
      kind: RecurrenceKind.everyNDays,
      start: d(2026, 10, 1),
      interval: 1,
      count: 5,
    );
    expect(r.datesBetween(d(2026, 10, 4), d(2026, 10, 10)), [d(2026, 10, 4), d(2026, 10, 5)]);
  });

  test('round-trips through JSON', () {
    final r = Recurrence(
      kind: RecurrenceKind.monthlyByWeekday,
      start: d(2026, 10, 1),
      interval: 2,
      weekday: 3,
      weekOfMonth: -1,
      until: d(2027, 10, 1),
      count: 4,
    );
    final back = Recurrence.decode(r.encode());
    expect(back.toJson(), r.toJson());
  });
}
