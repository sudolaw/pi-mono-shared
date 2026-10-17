/// Date helpers that work on local calendar days (time of day dropped).
library;

DateTime dateOnly(DateTime t) => DateTime(t.year, t.month, t.day);

DateTime addDays(DateTime date, int days) => DateTime(date.year, date.month, date.day + days);

/// Whole calendar days from [a] to [b] (negative when [b] is earlier).
int daysBetween(DateTime a, DateTime b) =>
    DateTime.utc(b.year, b.month, b.day).difference(DateTime.utc(a.year, a.month, a.day)).inDays;

/// The Monday on or before [date] (weeks start on Monday).
DateTime weekStart(DateTime date) => addDays(dateOnly(date), -(date.weekday - 1));

int daysInMonth(int year, int month) => DateTime(year, month + 1, 0).day;

/// [date] at [minutes] after midnight.
DateTime atMinutes(DateTime date, int minutes) =>
    DateTime(date.year, date.month, date.day, minutes ~/ 60, minutes % 60);
