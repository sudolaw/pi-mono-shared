import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';

import '../core/dates.dart';
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';

/// Dialog to add or edit a promise for [day].
Future<void> showPromiseEditor(
  BuildContext context, {
  required DateTime day,
  PromiseEntry? existing,
}) async {
  final goals = (await services.db.select(services.db.goals).get())
      .where((g) => !g.archived || g.id == existing?.goalId)
      .toList();
  if (!context.mounted) return;
  await showDialog<void>(
    context: context,
    builder: (_) => _PromiseDialog(day: day, existing: existing, goals: goals),
  );
}

class _PromiseDialog extends StatefulWidget {
  const _PromiseDialog({required this.day, required this.existing, required this.goals});

  final DateTime day;
  final PromiseEntry? existing;
  final List<Goal> goals;

  @override
  State<_PromiseDialog> createState() => _PromiseDialogState();
}

class _PromiseDialogState extends State<_PromiseDialog> {
  late final _title = TextEditingController(text: widget.existing?.title ?? '');
  late int? _goalId = widget.existing?.goalId;
  late int _minutes = widget.existing?.promisedMinutes ?? 60;
  String? _titleError;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final goalName = widget.goals.where((g) => g.id == _goalId).firstOrNull?.name;
    final title = _title.text.trim().isEmpty ? goalName : _title.text.trim();
    if (title == null) {
      setState(() => _titleError = 'Say what you promise, or pick a goal');
      return;
    }
    if (widget.existing == null) {
      await services.addPromise(
        PromisesCompanion.insert(
          day: dateOnly(widget.day),
          title: title,
          goalId: Value(_goalId),
          promisedMinutes: _minutes,
        ),
      );
    } else {
      await services.updatePromise(
        widget.existing!.id,
        PromisesCompanion(
          title: Value(title),
          goalId: Value(_goalId),
          promisedMinutes: Value(_minutes),
        ),
      );
    }
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.existing == null ? 'I promise to…' : 'Edit promise'),
      contentPadding: const EdgeInsets.fromLTRB(0, 20, 0, 0),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: TextField(
                controller: _title,
                autofocus: true,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (_) {
                  if (_titleError != null) setState(() => _titleError = null);
                },
                decoration: InputDecoration(
                  labelText: 'What',
                  hintText: 'XGBoost model building',
                  errorText: _titleError,
                ),
              ),
            ),
            DurationTile(
              label: 'For',
              minutes: _minutes,
              presets: const [15, 30, 45, 60, 90, 120, 180, 240],
              onChanged: (v) => setState(() => _minutes = v),
            ),
            ListTile(
              title: const Text('Counts toward'),
              trailing: DropdownButton<int?>(
                value: _goalId,
                items: [
                  const DropdownMenuItem(value: null, child: Text('No goal')),
                  for (final g in widget.goals) DropdownMenuItem(value: g.id, child: Text(g.name)),
                ],
                onChanged: (v) => setState(() => _goalId = v),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: _save, child: const Text('Promise')),
      ],
    );
  }
}
