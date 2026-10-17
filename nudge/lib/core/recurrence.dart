import 'dart:convert';

import 'dates.dart';

/// How a daily or repeated routine recurs. Works on calendar days only; the time
/// of day lives on the routine itself.
enum RecurrenceKind {
  /// Every [Recurrence.interval] weeks on [Recurrence.weekdays]. A daily routine
  /// is weekly with interval 1 and its chosen weekdays.
  weekly,

  /// Every [Recurrence.interval] days.
  everyNDays,

  /// Every [Recurrence.interval] months on [Recurrence.monthDay]; clamped to the
  /// last day in shorter months.
  monthlyByDate,

  /// Every [Recurrence.interval] months on the [Recurrence.weekOfMonth]-th
  /// [Recurrence.weekday] (-1 means the last one).
  monthlyByWeekday,

  /// Every year on [Recurrence.month]/[Recurrence.monthDay].
  yearly,
}

class Recurrence {
  const Recurrence({
    required this.kind,
    required this.start,
    this.interval = 1,
    this.weekdays = const {},
    this.monthDay = 1,
    this.weekOfMonth = 1,
    this.weekday = DateTime.monday,
    this.month = 1,
    this.until,
    this.count,
  });

  /// Every day on [weekdays] (all seven when empty).
  factory Recurrence.daily(DateTime start, {Set<int> weekdays = const {}}) => Recurrence(
    kind: RecurrenceKind.weekly,
    start: start,
    weekdays: weekdays.isEmpty ? allWeekdays : weekdays,
  );

  static const Set<int> allWeekdays = {1, 2, 3, 4, 5, 6, 7};

  final RecurrenceKind kind;

  /// First day the pattern can match; also anchors "every N" counting.
  final DateTime start;
  final int interval;

  /// ISO weekdays, 1 = Monday … 7 = Sunday.
  final Set<int> weekdays;
  final int monthDay;
  final int weekOfMonth;
  final int weekday;
  final int month;

  /// Last day the pattern can match.
  final DateTime? until;

  /// Stop after this many occurrences.
  final int? count;

  /// A copy with some fields changed. [until] and [count] take a function so
  /// they can be cleared: `copyWith(until: () => null)`.
  Recurrence copyWith({
    RecurrenceKind? kind,
    DateTime? start,
    int? interval,
    Set<int>? weekdays,
    int? monthDay,
    int? weekOfMonth,
    int? weekday,
    int? month,
    DateTime? Function()? until,
    int? Function()? count,
  }) => Recurrence(
    kind: kind ?? this.kind,
    start: start ?? this.start,
    interval: interval ?? this.interval,
    weekdays: weekdays ?? this.weekdays,
    monthDay: monthDay ?? this.monthDay,
    weekOfMonth: weekOfMonth ?? this.weekOfMonth,
    weekday: weekday ?? this.weekday,
    month: month ?? this.month,
    until: until == null ? this.until : until(),
    count: count == null ? this.count : count(),
  );

  /// A copy whose day of month, weekday, week of month and month are those of
  /// [start], so the pattern's first date is the start day itself (a start on
  /// Tue 13 Oct gives "2nd Tuesday", not "1st Tuesday"). Weekly days are kept.
  Recurrence alignedToStart() {
    final s = dateOnly(start);
    return copyWith(
      monthDay: s.day,
      weekOfMonth: (s.day - 1) ~/ 7 + 1,
      weekday: s.weekday,
      month: s.month,
    );
  }

  /// Whether [date] is an occurrence, ignoring [until] and [count].
  bool matchesPattern(DateTime date) {
    final d = dateOnly(date);
    final s = dateOnly(start);
    if (d.isBefore(s)) return false;
    final n = interval < 1 ? 1 : interval;
    switch (kind) {
      case RecurrenceKind.weekly:
        final weeks = daysBetween(weekStart(s), weekStart(d)) ~/ 7;
        return weeks % n == 0 && weekdays.contains(d.weekday);
      case RecurrenceKind.everyNDays:
        return daysBetween(s, d) % n == 0;
      case RecurrenceKind.monthlyByDate:
        if (_monthsBetween(s, d) % n != 0) return false;
        return d.day == _clampedDay(d.year, d.month, monthDay);
      case RecurrenceKind.monthlyByWeekday:
        if (_monthsBetween(s, d) % n != 0) return false;
        return d == nthWeekdayOfMonth(d.year, d.month, weekday, weekOfMonth);
      case RecurrenceKind.yearly:
        return d.month == month && d.day == _clampedDay(d.year, month, monthDay);
    }
  }

  /// Occurrence days in order, honoring [until] and [count]. With [from], days
  /// before it are skipped (cheaply when there is no [count] to keep).
  Iterable<DateTime> dates({DateTime? from}) sync* {
    final s = dateOnly(start);
    final skipTo = from == null ? null : dateOnly(from);
    var d = (count == null && skipTo != null && skipTo.isAfter(s)) ? skipTo : s;
    final end = until == null ? null : dateOnly(until!);
    var produced = 0;
    // Bounded scan: about 50 years of days.
    for (var i = 0; i < 366 * 50; i++) {
      if (end != null && d.isAfter(end)) return;
      if (count != null && produced >= count!) return;
      if (matchesPattern(d)) {
        produced++;
        if (skipTo == null || !d.isBefore(skipTo)) yield d;
      }
      d = addDays(d, 1);
    }
  }

  /// First occurrence on or after [date], or null when the pattern has ended.
  DateTime? nextOnOrAfter(DateTime date) {
    for (final d in dates(from: date)) {
      return d;
    }
    return null;
  }

  /// Occurrences in the inclusive range [from]..[to].
  List<DateTime> datesBetween(DateTime from, DateTime to) {
    final b = dateOnly(to);
    return dates(from: from).takeWhile((d) => !d.isAfter(b)).toList();
  }

  /// Short human description, e.g. "Every 2 weeks on Mon, Thu".
  String describe() {
    final n = interval < 1 ? 1 : interval;
    String every(String unit) => n == 1 ? 'Every $unit' : 'Every $n ${unit}s';
    final base = switch (kind) {
      RecurrenceKind.weekly when n == 1 && weekdays.length == 7 => 'Every day',
      RecurrenceKind.weekly =>
        '${every('week')} on ${(weekdays.toList()..sort()).map((w) => weekdayShort[w - 1]).join(', ')}',
      RecurrenceKind.everyNDays => every('day'),
      RecurrenceKind.monthlyByDate => '${every('month')} on day $monthDay',
      RecurrenceKind.monthlyByWeekday =>
        '${every('month')} on the ${ordinalWeek(weekOfMonth)} ${weekdayLong[weekday - 1]}',
      RecurrenceKind.yearly => 'Every year on $monthDay ${monthShort[month - 1]}',
    };
    final ends = [
      if (until != null) 'until ${until!.day} ${monthShort[until!.month - 1]} ${until!.year}',
      if (count != null) '$count times',
    ];
    return ends.isEmpty ? base : '$base, ${ends.join(', ')}';
  }

  Map<String, Object?> toJson() => {
    'kind': kind.name,
    'start': dateOnly(start).toIso8601String(),
    'interval': interval,
    'weekdays': (weekdays.toList()..sort()),
    'monthDay': monthDay,
    'weekOfMonth': weekOfMonth,
    'weekday': weekday,
    'month': month,
    'until': until == null ? null : dateOnly(until!).toIso8601String(),
    'count': count,
  };

  factory Recurrence.fromJson(Map<String, Object?> j) => Recurrence(
    kind: RecurrenceKind.values.byName(j['kind']! as String),
    start: DateTime.parse(j['start']! as String),
    interval: j['interval'] as int? ?? 1,
    weekdays: {...(j['weekdays'] as List? ?? const []).cast<int>()},
    monthDay: j['monthDay'] as int? ?? 1,
    weekOfMonth: j['weekOfMonth'] as int? ?? 1,
    weekday: j['weekday'] as int? ?? DateTime.monday,
    month: j['month'] as int? ?? 1,
    until: j['until'] == null ? null : DateTime.parse(j['until']! as String),
    count: j['count'] as int?,
  );

  String encode() => jsonEncode(toJson());

  static Recurrence decode(String s) =>
      Recurrence.fromJson((jsonDecode(s) as Map).cast<String, Object?>());
}

int _monthsBetween(DateTime a, DateTime b) => (b.year - a.year) * 12 + (b.month - a.month);

int _clampedDay(int year, int month, int day) {
  final last = daysInMonth(year, month);
  return day > last ? last : day;
}

/// The [nth] [weekday] of a month (1-based); -1 gives the last one. Returns
/// null when the month has no such day (e.g. a 5th Monday).
DateTime? nthWeekdayOfMonth(int year, int month, int weekday, int nth) {
  if (nth == -1) {
    final last = DateTime(year, month, daysInMonth(year, month));
    return addDays(last, -((last.weekday - weekday + 7) % 7));
  }
  final first = DateTime(year, month, 1);
  final day = 1 + (weekday - first.weekday + 7) % 7 + (nth - 1) * 7;
  return day > daysInMonth(year, month) ? null : DateTime(year, month, day);
}

const weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekdayLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const monthShort = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String ordinalWeek(int n) => switch (n) {
  -1 => 'last',
  1 => '1st',
  2 => '2nd',
  3 => '3rd',
  _ => '${n}th',
};
