import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';

import '../core/clock.dart';
import '../core/dates.dart';
import '../core/goal_stats.dart';
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';
import 'format.dart';

enum _LengthMode { days, endDate }

class GoalEditor extends StatefulWidget {
  const GoalEditor({super.key, this.existing});

  final Goal? existing;

  @override
  State<GoalEditor> createState() => _GoalEditorState();
}

class _GoalEditorState extends State<GoalEditor> with EditorGuard {
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late final _hours = TextEditingController(
    text: widget.existing == null ? '' : _trim(widget.existing!.targetMinutes / 60),
  );
  late final _days = TextEditingController(text: '${widget.existing?.totalDays ?? 30}');
  late DateTime _start = widget.existing?.startDate ?? dateOnly(appNow());
  _LengthMode _mode = _LengthMode.days;
  late DateTime _end = addDays(_start, (widget.existing?.totalDays ?? 30) - 1);

  static String _trim(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);

  @override
  void dispose() {
    _name.dispose();
    _hours.dispose();
    _days.dispose();
    super.dispose();
  }

  int? get _totalDays =>
      _mode == _LengthMode.days ? int.tryParse(_days.text.trim()) : daysBetween(_start, _end) + 1;

  Future<void> _save() async {
    if (!validateForSave()) return;
    final total = _totalDays;
    if (total == null || total < 1) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('The end must be on or after the start.')));
      return;
    }
    // Ended goals are deleted two months after their end, so this one would
    // vanish as soon as it was saved.
    if (goalDeletionDay(_start, total).isBefore(dateOnly(appNow()))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'That goal ended over two months ago, and ended goals are deleted then. '
            'Move its dates to keep it.',
          ),
        ),
      );
      return;
    }
    final data = GoalsCompanion(
      name: Value(_name.text.trim()),
      targetMinutes: Value((double.parse(_hours.text.trim()) * 60).round()),
      startDate: Value(dateOnly(_start)),
      totalDays: Value(total),
    );
    await services.saveGoal(data, id: widget.existing?.id);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final total = _totalDays;
    return guardUnsaved(
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.existing == null ? 'New goal' : 'Edit goal'),
          actions: [TextButton(onPressed: _save, child: const Text('Save'))],
        ),
        body: editorForm(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 48),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: TextFormField(
                  controller: _name,
                  autofocus: widget.existing == null,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Goal',
                    hintText: 'ML model building',
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Name the goal' : null,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextFormField(
                  controller: _hours,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Target', suffixText: 'hours'),
                  validator: (v) {
                    final n = double.tryParse(v?.trim() ?? '');
                    return n == null || n <= 0 ? 'Enter the hours to reach' : null;
                  },
                ),
              ),
              const SectionHeader('Period'),
              DateTile(
                label: 'Start (can be in the past)',
                date: _start,
                onChanged: (v) => setState(() {
                  _start = v;
                  if (_end.isBefore(_start)) _end = _start;
                }),
              ),
              ListTile(
                title: const Text('Length'),
                trailing: SegmentedButton<_LengthMode>(
                  segments: const [
                    ButtonSegment(value: _LengthMode.days, label: Text('X days')),
                    ButtonSegment(value: _LengthMode.endDate, label: Text('End date')),
                  ],
                  selected: {_mode},
                  onSelectionChanged: (s) => setState(() {
                    final days = _totalDays;
                    _mode = s.first;
                    if (_mode == _LengthMode.endDate && days != null && days > 0) {
                      _end = addDays(_start, days - 1);
                    } else if (_mode == _LengthMode.days) {
                      _days.text = '${daysBetween(_start, _end) + 1}';
                    }
                  }),
                ),
              ),
              if (_mode == _LengthMode.days)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TextField(
                    controller: _days,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Days', suffixText: 'days'),
                    onChanged: (_) => setState(() {}),
                  ),
                )
              else
                DateTile(
                  label: 'End date',
                  date: _end,
                  firstDate: _start,
                  onChanged: (v) => setState(() => _end = v),
                ),
              if (total != null && total > 0)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Text(
                    'Runs ${formatDate(_start)} to ${formatDate(addDays(_start, total - 1))} (${total == 1 ? '1 day' : '$total days'})',
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
