import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// "1 h 30 min", "45 min", "2 h", "3 d".
String formatMinutes(int minutes) {
  if (minutes <= 0) return '0 min';
  if (minutes % (24 * 60) == 0) return '${minutes ~/ (24 * 60)} d';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h == 0) return '$m min';
  if (m == 0) return '$h h';
  return '$h h $m min';
}

/// Hours with up to one decimal: "3.5 h".
String formatHours(num minutes) {
  final h = minutes / 60;
  final text = h == h.roundToDouble() ? h.toStringAsFixed(0) : h.toStringAsFixed(1);
  return '$text h';
}

String formatPercent(double fraction) {
  final p = fraction * 100;
  return p >= 10 || p == 0 ? '${p.round()}%' : '${p.toStringAsFixed(1)}%';
}

String formatTimeOfDay(int minutes) =>
    DateFormat.jm().format(DateTime(2000, 1, 1, minutes ~/ 60, minutes % 60));

/// "100 m", "1 km", "100 km".
String formatDistance(int meters) {
  if (meters < 1000) return '$meters m';
  final km = meters / 1000;
  return '${km == km.roundToDouble() ? km.toStringAsFixed(0) : km.toStringAsFixed(1)} km';
}

/// The time of day of [t], e.g. "9:05 AM".
String formatClock(DateTime t) => formatTimeOfDay(t.hour * 60 + t.minute);

String formatDate(DateTime d) => DateFormat('EEE d MMM yyyy').format(d);

String formatShortDate(DateTime d) => DateFormat('d MMM').format(d);

String formatDateTime(DateTime d) => DateFormat('EEE d MMM, h:mm a').format(d);

int toMinutes(TimeOfDay t) => t.hour * 60 + t.minute;

TimeOfDay fromMinutes(int m) => TimeOfDay(hour: m ~/ 60, minute: m % 60);
