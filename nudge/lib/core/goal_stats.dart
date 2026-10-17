import 'dates.dart';

/// The last day of a goal that runs [totalDays] from [start].
DateTime goalEndDay(DateTime start, int totalDays) =>
    addDays(dateOnly(start), (totalDays < 1 ? 1 : totalDays) - 1);

/// A finished goal and its promises are deleted permanently after this day:
/// two months after the goal's last day.
DateTime goalDeletionDay(DateTime start, int totalDays) {
  final end = goalEndDay(start, totalDays);
  return DateTime(end.year, end.month + 2, end.day);
}

/// Progress numbers for a time goal on a given day.
///
/// Days count inclusively: on the start date one day has passed.
class GoalStats {
  GoalStats._({
    required this.totalDays,
    required this.elapsedDays,
    required this.targetMinutes,
    required this.doneMinutes,
  });

  factory GoalStats.compute({
    required DateTime start,
    required int totalDays,
    required int targetMinutes,
    required int doneMinutes,
    required DateTime today,
  }) {
    final total = totalDays < 1 ? 1 : totalDays;
    final elapsed = (daysBetween(start, today) + 1).clamp(0, total);
    return GoalStats._(
      totalDays: total,
      elapsedDays: elapsed,
      targetMinutes: targetMinutes,
      doneMinutes: doneMinutes,
    );
  }

  final int totalDays;
  final int elapsedDays;
  final int targetMinutes;
  final int doneMinutes;

  int get daysLeft => totalDays - elapsedDays;

  double get timeFraction => elapsedDays / totalDays;

  double get progressFraction => targetMinutes <= 0 ? 0 : doneMinutes / targetMinutes;

  /// Minutes done by the end date if the pace so far continues.
  double get projectedMinutes => elapsedDays == 0 ? 0 : doneMinutes / elapsedDays * totalDays;

  double get projectedFraction => targetMinutes <= 0 ? 0 : projectedMinutes / targetMinutes;

  /// Minutes per day needed from tomorrow to hit the target; null once the goal
  /// period is over.
  double? get neededMinutesPerDay {
    if (daysLeft <= 0) return null;
    final remaining = targetMinutes - doneMinutes;
    return remaining <= 0 ? 0 : remaining / daysLeft;
  }

  bool get isFinished => daysLeft <= 0;

  bool get isReached => doneMinutes >= targetMinutes;
}
