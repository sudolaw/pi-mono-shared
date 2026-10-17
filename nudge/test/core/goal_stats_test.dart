import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/goal_stats.dart';

void main() {
  test('spec example: day 20 of 365, 1 h of 100 h done', () {
    final s = GoalStats.compute(
      start: DateTime(2026, 1, 1),
      totalDays: 365,
      targetMinutes: 100 * 60,
      doneMinutes: 60,
      today: DateTime(2026, 1, 20),
    );
    expect(s.elapsedDays, 20);
    expect(s.timeFraction, closeTo(0.0548, 0.0001));
    expect(s.progressFraction, closeTo(0.01, 1e-9));
    expect(s.daysLeft, 345);
    expect(s.projectedMinutes / 60, closeTo(18.25, 1e-9));
    expect(s.projectedFraction, closeTo(0.1825, 1e-9));
    expect(s.neededMinutesPerDay! / 60, closeTo(99 / 345, 1e-9));
  });

  test('before the start nothing has elapsed', () {
    final s = GoalStats.compute(
      start: DateTime(2026, 11, 1),
      totalDays: 30,
      targetMinutes: 600,
      doneMinutes: 0,
      today: DateTime(2026, 10, 20),
    );
    expect(s.elapsedDays, 0);
    expect(s.projectedMinutes, 0);
    expect(s.daysLeft, 30);
  });

  test('after the end the goal is finished', () {
    final s = GoalStats.compute(
      start: DateTime(2026, 1, 1),
      totalDays: 30,
      targetMinutes: 600,
      doneMinutes: 700,
      today: DateTime(2026, 3, 1),
    );
    expect(s.elapsedDays, 30);
    expect(s.isFinished, isTrue);
    expect(s.isReached, isTrue);
    expect(s.neededMinutesPerDay, isNull);
  });
}
