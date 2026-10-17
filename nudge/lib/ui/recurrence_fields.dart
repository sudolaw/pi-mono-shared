import 'package:flutter/material.dart';

import '../core/clock.dart';
import '../core/dates.dart';
import '../core/recurrence.dart';
import 'fields.dart';
import 'format.dart';

enum _Ends { never, onDate, afterCount }

/// Edits a repeat pattern: kind, every N, which days, start and end, with a
/// preview of the next dates.
class RecurrenceFields extends StatelessWidget {
  const RecurrenceFields({super.key, required this.value, required this.onChanged});

  final Recurrence value;
  final ValueChanged<Recurrence> onChanged;

  @override
  Widget build(BuildContext context) {
    final r = value;
    void set(Recurrence next) => onChanged(next);
    final unit = switch (r.kind) {
      RecurrenceKind.weekly => 'week',
      RecurrenceKind.everyNDays => 'day',
      RecurrenceKind.yearly => 'year',
      _ => 'month',
    };
    final ends = r.until != null
        ? _Ends.onDate
        : r.count != null
        ? _Ends.afterCount
        : _Ends.never;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader('Repeat'),
        ListTile(
          title: const Text('Pattern'),
          trailing: DropdownButton<RecurrenceKind>(
            value: r.kind,
            items: const [
              DropdownMenuItem(value: RecurrenceKind.weekly, child: Text('Weekly on days')),
              DropdownMenuItem(value: RecurrenceKind.everyNDays, child: Text('Every N days')),
              DropdownMenuItem(
                value: RecurrenceKind.monthlyByDate,
                child: Text('Monthly on a date'),
              ),
              DropdownMenuItem(
                value: RecurrenceKind.monthlyByWeekday,
                child: Text('Monthly on a weekday'),
              ),
              DropdownMenuItem(value: RecurrenceKind.yearly, child: Text('Yearly')),
            ],
            onChanged: (v) => set(r.copyWith(kind: v).alignedToStart()),
          ),
        ),
        if (r.kind != RecurrenceKind.yearly)
          _Stepper(
            label: 'Every',
            value: r.interval,
            text: '${r.interval} $unit${r.interval == 1 ? '' : 's'}',
            onChanged: (v) => set(r.copyWith(interval: v)),
          ),
        if (r.kind == RecurrenceKind.weekly)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: WeekdayPicker(
              selected: r.weekdays,
              onChanged: (v) => set(r.copyWith(weekdays: v)),
            ),
          ),
        if (r.kind == RecurrenceKind.monthlyByDate || r.kind == RecurrenceKind.yearly)
          ListTile(
            title: const Text('Day of month'),
            trailing: DropdownButton<int>(
              value: r.monthDay,
              items: [for (var d = 1; d <= 31; d++) DropdownMenuItem(value: d, child: Text('$d'))],
              onChanged: (v) => set(r.copyWith(monthDay: v)),
            ),
          ),
        if (r.kind == RecurrenceKind.yearly)
          ListTile(
            title: const Text('Month'),
            trailing: DropdownButton<int>(
              value: r.month,
              items: [
                for (var m = 1; m <= 12; m++)
                  DropdownMenuItem(value: m, child: Text(monthShort[m - 1])),
              ],
              onChanged: (v) => set(r.copyWith(month: v)),
            ),
          ),
        if (r.kind == RecurrenceKind.monthlyByWeekday)
          ListTile(
            title: const Text('On the'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButton<int>(
                  value: r.weekOfMonth,
                  items: [
                    for (final n in [1, 2, 3, 4, 5, -1])
                      DropdownMenuItem(value: n, child: Text(ordinalWeek(n))),
                  ],
                  onChanged: (v) => set(r.copyWith(weekOfMonth: v)),
                ),
                const SizedBox(width: 8),
                DropdownButton<int>(
                  value: r.weekday,
                  items: [
                    for (var d = 1; d <= 7; d++)
                      DropdownMenuItem(value: d, child: Text(weekdayLong[d - 1])),
                  ],
                  onChanged: (v) => set(r.copyWith(weekday: v)),
                ),
              ],
            ),
          ),
        DateTile(
          label: 'Starting',
          date: r.start,
          onChanged: (v) => set(r.copyWith(start: v).alignedToStart()),
        ),
        ListTile(
          title: const Text('Ends'),
          trailing: DropdownButton<_Ends>(
            value: ends,
            items: const [
              DropdownMenuItem(value: _Ends.never, child: Text('Never')),
              DropdownMenuItem(value: _Ends.onDate, child: Text('On a date')),
              DropdownMenuItem(value: _Ends.afterCount, child: Text('After N times')),
            ],
            onChanged: (v) => set(switch (v!) {
              _Ends.never => r.copyWith(until: () => null, count: () => null),
              _Ends.onDate => r.copyWith(until: () => addDays(r.start, 90), count: () => null),
              _Ends.afterCount => r.copyWith(until: () => null, count: () => 10),
            }),
          ),
        ),
        if (ends == _Ends.onDate)
          DateTile(
            label: 'Last day',
            date: r.until,
            onChanged: (v) => set(r.copyWith(until: () => v)),
          ),
        if (ends == _Ends.afterCount)
          _Stepper(
            label: 'Times',
            value: r.count!,
            text: '${r.count}',
            onChanged: (v) => set(r.copyWith(count: () => v)),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Text(
            _preview(r),
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ),
      ],
    );
  }

  static String _preview(Recurrence r) {
    final today = dateOnly(appNow());
    final next = r.datesBetween(today, addDays(today, 400)).take(3);
    if (next.isEmpty) return '${r.describe()}. No upcoming dates.';
    return '${r.describe()}. Next: ${next.map(formatShortDate).join(', ')}';
  }
}

/// "− 3 weeks +" style counter, never below 1.
class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.label,
    required this.value,
    required this.text,
    required this.onChanged,
  });

  final String label;
  final int value;
  final String text;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: 'Fewer',
            icon: const Icon(Icons.remove),
            onPressed: value > 1 ? () => onChanged(value - 1) : null,
          ),
          Text(text),
          IconButton(
            tooltip: 'More',
            icon: const Icon(Icons.add),
            onPressed: () => onChanged(value + 1),
          ),
        ],
      ),
    );
  }
}
