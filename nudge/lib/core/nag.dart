import 'dart:math' as math;

/// The shortest gap between two nags the app ever allows.
const Duration absoluteMinInterval = Duration(minutes: 5);

/// When nag reminders fire for one occurrence of a routine or to-do.
///
/// The first reminder fires at the occurrence start, then every [firstInterval].
/// In half-life mode, each [halfLife] that passes since the start divides the
/// interval by [factor], down to [minInterval].
class NagPolicy {
  const NagPolicy({
    required this.firstInterval,
    this.halfLife,
    this.factor = 2,
    this._minInterval = const Duration(minutes: 15),
  });

  final Duration firstInterval;

  /// Null turns half-life off: the interval stays at [firstInterval].
  final Duration? halfLife;
  final double factor;
  final Duration _minInterval;

  Duration get minInterval =>
      _minInterval < absoluteMinInterval ? absoluteMinInterval : _minInterval;

  /// Gap until the next reminder for one fired [elapsed] after the start.
  Duration intervalAt(Duration elapsed) {
    final first = firstInterval < minInterval ? minInterval : firstInterval;
    final hl = halfLife;
    if (hl == null || hl <= Duration.zero || factor <= 1) return first;
    final periods = elapsed.inMicroseconds ~/ hl.inMicroseconds;
    final micros = first.inMicroseconds / math.pow(factor, periods);
    final interval = Duration(microseconds: micros.round());
    return interval < minInterval ? minInterval : interval;
  }

  /// Latest reminder time at or before [now], or null before [start].
  ///
  /// After a snooze, reminders restart at [snoozedUntil] and continue at the
  /// sped-up rate: snoozing never resets the half-life progress.
  DateTime? fireAtOrBefore(DateTime start, DateTime now, {DateTime? snoozedUntil}) {
    if (snoozedUntil != null && snoozedUntil.isAfter(start)) {
      if (now.isBefore(snoozedUntil)) return null;
      return _lastOnOrBefore(start, snoozedUntil, now);
    }
    if (now.isBefore(start)) return null;
    return _lastOnOrBefore(start, start, now);
  }

  /// First reminder time strictly after [now].
  DateTime nextFireAfter(DateTime start, DateTime now, {DateTime? snoozedUntil}) {
    if (snoozedUntil != null && snoozedUntil.isAfter(start)) {
      if (now.isBefore(snoozedUntil)) return snoozedUntil;
      final last = _lastOnOrBefore(start, snoozedUntil, now);
      return last.add(intervalAt(last.difference(start)));
    }
    if (now.isBefore(start)) return start;
    final last = _lastOnOrBefore(start, start, now);
    return last.add(intervalAt(last.difference(start)));
  }

  DateTime _lastOnOrBefore(DateTime start, DateTime from, DateTime now) {
    var t = from;
    while (true) {
      final next = t.add(intervalAt(t.difference(start)));
      if (next.isAfter(now)) return t;
      t = next;
    }
  }

  /// Half-life that reaches [minInterval] exactly at [end]: the "auto" option
  /// for a to-do with an end date. Null when no speed-up is possible.
  static Duration? autoHalfLife({
    required DateTime start,
    required DateTime end,
    required Duration firstInterval,
    required Duration minInterval,
    double factor = 2,
  }) {
    final window = end.difference(start);
    if (window <= Duration.zero || factor <= 1) return null;
    final min = minInterval < absoluteMinInterval ? absoluteMinInterval : minInterval;
    if (firstInterval <= min) return null;
    final steps = (math.log(firstInterval.inMicroseconds / min.inMicroseconds) / math.log(factor))
        .ceil();
    if (steps <= 0) return null;
    return Duration(microseconds: window.inMicroseconds ~/ steps);
  }
}
