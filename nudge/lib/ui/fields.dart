import 'package:flutter/material.dart';

import 'format.dart';
import '../core/clock.dart';

/// A list tile that shows a duration and lets the user pick a preset or type
/// a number of minutes.
class DurationTile extends StatelessWidget {
  const DurationTile({
    super.key,
    required this.label,
    required this.minutes,
    required this.onChanged,
    this.presets = const [5, 10, 15, 30, 60, 120, 240, 480, 1440],
    this.minMinutes = 1,
    this.subtitle,
    this.enabled = true,
  });

  final String label;
  final int minutes;
  final ValueChanged<int> onChanged;
  final List<int> presets;
  final int minMinutes;
  final String? subtitle;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      enabled: enabled,
      title: Text(label),
      subtitle: subtitle == null ? null : Text(subtitle!),
      trailing: Text(formatMinutes(minutes), style: Theme.of(context).textTheme.titleMedium),
      onTap: () async {
        final picked = await pickMinutes(context, label, minutes, presets, minMinutes);
        if (picked != null) onChanged(picked);
      },
    );
  }
}

Future<int?> pickMinutes(
  BuildContext context,
  String title,
  int current,
  List<int> presets,
  int minMinutes,
) {
  return showDialog<int>(
    context: context,
    builder: (context) => _MinutesDialog(
      title: title,
      current: current,
      presets: presets.where((p) => p >= minMinutes).toList(),
      minMinutes: minMinutes,
    ),
  );
}

class _MinutesDialog extends StatefulWidget {
  const _MinutesDialog({
    required this.title,
    required this.current,
    required this.presets,
    required this.minMinutes,
  });

  final String title;
  final int current;
  final List<int> presets;
  final int minMinutes;

  @override
  State<_MinutesDialog> createState() => _MinutesDialogState();
}

class _MinutesDialogState extends State<_MinutesDialog> {
  late final _custom = TextEditingController();
  String _unit = 'min';
  String? _error;

  @override
  void dispose() {
    _custom.dispose();
    super.dispose();
  }

  void _submitCustom() {
    final n = double.tryParse(_custom.text.trim());
    final minutes = n == null
        ? null
        : (n *
                  switch (_unit) {
                    'h' => 60,
                    'd' => 1440,
                    _ => 1,
                  })
              .round();
    if (minutes == null || minutes < widget.minMinutes) {
      setState(() => _error = 'At least ${formatMinutes(widget.minMinutes)}');
      return;
    }
    Navigator.pop(context, minutes);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final p in widget.presets)
                  ChoiceChip(
                    label: Text(formatMinutes(p)),
                    selected: p == widget.current,
                    onSelected: (_) => Navigator.pop(context, p),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _custom,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: 'Custom', errorText: _error),
                    onSubmitted: (_) => _submitCustom(),
                  ),
                ),
                const SizedBox(width: 8),
                DropdownButton<String>(
                  value: _unit,
                  items: const [
                    DropdownMenuItem(value: 'min', child: Text('min')),
                    DropdownMenuItem(value: 'h', child: Text('hours')),
                    DropdownMenuItem(value: 'd', child: Text('days')),
                  ],
                  onChanged: (v) => setState(() => _unit = v!),
                ),
              ],
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: _submitCustom, child: const Text('Set custom')),
      ],
    );
  }
}

/// Weekday chips, Monday first. [selected] holds ISO weekdays (1–7).
class WeekdayPicker extends StatelessWidget {
  const WeekdayPicker({super.key, required this.selected, required this.onChanged});

  final Set<int> selected;
  final ValueChanged<Set<int>> onChanged;

  static const _labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      children: [
        for (var d = 1; d <= 7; d++)
          FilterChip(
            label: Text(_labels[d - 1]),
            showCheckmark: false,
            selected: selected.contains(d),
            onSelected: (on) {
              final next = {...selected};
              on ? next.add(d) : next.remove(d);
              if (next.isNotEmpty) onChanged(next);
            },
          ),
      ],
    );
  }
}

/// A list tile showing a date that opens the date picker.
class DateTile extends StatelessWidget {
  const DateTile({
    super.key,
    required this.label,
    required this.date,
    required this.onChanged,
    this.onClear,
    this.firstDate,
  });

  final String label;
  final DateTime? date;
  final ValueChanged<DateTime> onChanged;
  final VoidCallback? onClear;
  final DateTime? firstDate;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      subtitle: Text(date == null ? 'Not set' : formatDate(date!)),
      trailing: date != null && onClear != null
          ? IconButton(icon: const Icon(Icons.clear), onPressed: onClear)
          : const Icon(Icons.calendar_today_outlined),
      onTap: () async {
        final now = appNow();
        final picked = await showDatePicker(
          context: context,
          initialDate: date ?? now,
          firstDate: firstDate ?? DateTime(now.year - 5),
          lastDate: DateTime(now.year + 10),
        );
        if (picked != null) onChanged(picked);
      },
    );
  }
}

/// A list tile showing a time of day (minutes after midnight).
class TimeTile extends StatelessWidget {
  const TimeTile({
    super.key,
    required this.label,
    required this.minutes,
    required this.onChanged,
    this.onClear,
    this.emptyText = 'Not set',
  });

  final String label;
  final int? minutes;
  final ValueChanged<int> onChanged;
  final VoidCallback? onClear;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      subtitle: Text(minutes == null ? emptyText : formatTimeOfDay(minutes!)),
      trailing: minutes != null && onClear != null
          ? IconButton(icon: const Icon(Icons.clear), onPressed: onClear)
          : const Icon(Icons.schedule),
      onTap: () async {
        final picked = await showTimePicker(
          context: context,
          initialTime: fromMinutes(minutes ?? 9 * 60),
        );
        if (picked != null) onChanged(toMinutes(picked));
      },
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleSmall
            ?.copyWith(color: Theme.of(context).colorScheme.primary),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurfaceVariant;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: color),
            const SizedBox(height: 12),
            Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(color: color),
            ),
          ],
        ),
      ),
    );
  }
}

Future<bool> confirm(BuildContext context, String title, String action) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(action)),
      ],
    ),
  );
  return ok ?? false;
}

/// Shared behaviour of the full-screen editors: field errors that clear as soon
/// as the field is fixed, and a "Discard changes?" check on Back.
///
/// Wrap the fields in [editorForm] and the Scaffold in [guardUnsaved], and call
/// [validateForSave] in Save. Any `setState` counts as an edit.
mixin EditorGuard<T extends StatefulWidget> on State<T> {
  final _formKey = GlobalKey<FormState>();

  /// Off until a Save fails, so errors don't show while a new form is typed.
  var _autovalidate = AutovalidateMode.disabled;
  var _dirty = false;

  @override
  void setState(VoidCallback fn) {
    _dirty = true;
    super.setState(fn);
  }

  /// Runs the field validators; after a failure they re-run on every change.
  bool validateForSave() {
    if (_formKey.currentState!.validate()) return true;
    setState(() => _autovalidate = AutovalidateMode.always);
    return false;
  }

  Widget editorForm({required Widget child}) => Form(
    key: _formKey,
    autovalidateMode: _autovalidate,
    onChanged: () => _dirty = true,
    child: child,
  );

  /// Asks before Back drops edits. Save pops with `Navigator.pop`, which is
  /// never blocked.
  Widget guardUnsaved({required Widget child}) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) async {
      if (didPop) return;
      if (!_dirty || await confirm(context, 'Discard changes?', 'Discard')) {
        if (mounted) Navigator.pop(context);
      }
    },
    child: child,
  );
}
