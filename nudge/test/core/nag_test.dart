import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/nag.dart';

void main() {
  final start = DateTime(2026, 10, 15, 9);

  test('desktop-plan example: 4h, half-life 1 day, x2 → 4h, 2h, 1h, 30m, 15m', () {
    const p = NagPolicy(
      firstInterval: Duration(hours: 4),
      halfLife: Duration(days: 1),
      minInterval: Duration(minutes: 15),
    );
    expect(p.intervalAt(Duration.zero), const Duration(hours: 4));
    expect(p.intervalAt(const Duration(days: 1)), const Duration(hours: 2));
    expect(p.intervalAt(const Duration(days: 2)), const Duration(hours: 1));
    expect(p.intervalAt(const Duration(days: 3)), const Duration(minutes: 30));
    expect(p.intervalAt(const Duration(days: 4)), const Duration(minutes: 15));
    expect(p.intervalAt(const Duration(days: 9)), const Duration(minutes: 15));
  });

  test('without half-life the interval never changes', () {
    const p = NagPolicy(firstInterval: Duration(hours: 1));
    expect(p.intervalAt(const Duration(days: 30)), const Duration(hours: 1));
  });

  test('minimum interval is never below 5 minutes', () {
    const p = NagPolicy(
      firstInterval: Duration(minutes: 10),
      halfLife: Duration(minutes: 1),
      minInterval: Duration(minutes: 1),
    );
    expect(p.minInterval, const Duration(minutes: 5));
    expect(p.intervalAt(const Duration(hours: 1)), const Duration(minutes: 5));
  });

  test('fire times follow the sped-up sequence', () {
    const p = NagPolicy(
      firstInterval: Duration(minutes: 10),
      halfLife: Duration(minutes: 15),
      minInterval: Duration(minutes: 5),
    );
    // Fires at 9:00, 9:10 (elapsed 10m → 10m gap), 9:20 (elapsed 20m → 5m gap), 9:25, 9:30...
    expect(p.nextFireAfter(start, start.subtract(const Duration(minutes: 1))), start);
    expect(p.nextFireAfter(start, start), start.add(const Duration(minutes: 10)));
    expect(
      p.nextFireAfter(start, start.add(const Duration(minutes: 10))),
      start.add(const Duration(minutes: 20)),
    );
    expect(
      p.nextFireAfter(start, start.add(const Duration(minutes: 20))),
      start.add(const Duration(minutes: 25)),
    );
    expect(
      p.fireAtOrBefore(start, start.add(const Duration(minutes: 23))),
      start.add(const Duration(minutes: 20)),
    );
    expect(p.fireAtOrBefore(start, start.subtract(const Duration(seconds: 1))), isNull);
  });

  test('snooze delays the next reminder but keeps the speed-up', () {
    const p = NagPolicy(
      firstInterval: Duration(hours: 4),
      halfLife: Duration(days: 1),
      minInterval: Duration(minutes: 15),
    );
    final snoozed = start.add(const Duration(days: 2));
    final now = snoozed.subtract(const Duration(minutes: 30));
    expect(p.nextFireAfter(start, now, snoozedUntil: snoozed), snoozed);
    expect(p.fireAtOrBefore(start, now, snoozedUntil: snoozed), isNull);
    // After the snooze, the gap is the day-2 rate (1 h), not back to 4 h.
    expect(
      p.nextFireAfter(start, snoozed, snoozedUntil: snoozed),
      snoozed.add(const Duration(hours: 1)),
    );
  });

  test('auto half-life reaches the minimum at the end date', () {
    final end = start.add(const Duration(days: 4));
    final hl = NagPolicy.autoHalfLife(
      start: start,
      end: end,
      firstInterval: const Duration(hours: 4),
      minInterval: const Duration(minutes: 15),
    );
    // 4h → 15m is 4 halvings, so one per day.
    expect(hl, const Duration(days: 1));
    expect(
      NagPolicy.autoHalfLife(
        start: start,
        end: end,
        firstInterval: const Duration(minutes: 15),
        minInterval: const Duration(minutes: 15),
      ),
      isNull,
    );
  });
}
