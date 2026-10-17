import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';

import '../core/dates.dart';
import '../core/nag.dart';
import '../core/recurrence.dart';
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';
import 'format.dart';
import 'recurrence_fields.dart';
import '../core/clock.dart';

enum _HalfLifeMode { auto, custom }

/// Create or edit a daily routine, repeated routine or to-do.
class RoutineEditor extends StatefulWidget {
  const RoutineEditor({super.key, required this.kind, this.existing});

  final RoutineKind kind;
  final Routine? existing;

  @override
  State<RoutineEditor> createState() => _RoutineEditorState();
}

class _RoutineEditorState extends State<RoutineEditor> with EditorGuard {
  final _title = TextEditingController();
  final _notes = TextEditingController();

  // Daily / repeated.
  int _time = 9 * 60;

  /// Minutes after the start.
  int? _deadline;
  late Recurrence _rec;

  // To-do.
  DateTime _startAt = appNow().add(const Duration(minutes: 5));
  DateTime? _endAt;
  int? _regenDays;

  // Nagging.
  bool _nag = true;
  late int _firstInterval;
  late _HalfLifeMode _halfLifeMode;
  late int _halfLife;
  double _factor = 2;
  late int _minInterval;
  AlertStyle _alert = AlertStyle.notification;
  bool _active = true;

  bool get _isTodo => widget.kind == RoutineKind.todo;

  bool get _hasDeadline => _isTodo ? _endAt != null : _deadline != null;

  @override
  void initState() {
    super.initState();
    _firstInterval = _isTodo ? 240 : 10;
    _halfLifeMode = _HalfLifeMode.auto;
    _halfLife = _isTodo ? 1440 : 15;
    _minInterval = _isTodo ? 15 : 5;
    final today = dateOnly(appNow());
    _rec = widget.kind == RoutineKind.daily
        ? Recurrence.daily(today)
        : Recurrence(
            kind: RecurrenceKind.weekly,
            start: today,
            weekdays: {today.weekday},
          ).alignedToStart();

    final r = widget.existing;
    if (r == null) return;
    _title.text = r.title;
    _notes.text = r.notes;
    _time = r.timeMinutes ?? _time;
    _deadline = r.deadlineMinutes;
    _regenDays = r.regenDays;
    if (r.recurrence != null) _rec = Recurrence.decode(r.recurrence!);
    _startAt = r.startAt ?? _startAt;
    _endAt = r.endAt;
    _nag = r.nagEnabled;
    _firstInterval = r.firstIntervalMinutes;
    _halfLifeMode = r.autoHalfLife || r.halfLifeMinutes == null
        ? _HalfLifeMode.auto
        : _HalfLifeMode.custom;
    _halfLife = r.halfLifeMinutes ?? _halfLife;
    _factor = r.factor;
    _minInterval = r.minIntervalMinutes;
    _alert = r.alertStyle;
    _active = r.active;
  }

  @override
  void dispose() {
    _title.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!validateForSave()) return;
    if (_isTodo && _endAt != null && !_endAt!.isAfter(_startAt)) {
      _snack('The end must be after the start.');
      return;
    }
    final recurring = !_isTodo;
    final data = RoutinesCompanion(
      id: widget.existing == null ? const Value.absent() : Value(widget.existing!.id),
      title: Value(_title.text.trim()),
      notes: Value(_notes.text.trim()),
      kind: Value(widget.kind),
      timeMinutes: Value(recurring ? _time : null),
      deadlineMinutes: Value(recurring ? _deadline : null),
      regenDays: Value(_isTodo ? _regenDays : null),
      recurrence: Value(recurring ? _rec.encode() : null),
      startAt: Value(_isTodo ? _startAt : null),
      endAt: Value(_isTodo ? _endAt : null),
      nagEnabled: Value(_nag && _hasDeadline),
      firstIntervalMinutes: Value(_firstInterval),
      halfLifeMinutes: Value(_halfLifeMode == _HalfLifeMode.custom ? _halfLife : null),
      autoHalfLife: Value(_halfLifeMode == _HalfLifeMode.auto),
      factor: Value(_factor),
      minIntervalMinutes: Value(_minInterval),
      alertStyle: Value(_alert),
      active: Value(_active),
    );
    await services.saveRoutine(data);
    if (mounted) Navigator.pop(context);
  }

  void _snack(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  @override
  Widget build(BuildContext context) {
    final kindName = switch (widget.kind) {
      RoutineKind.daily => 'daily routine',
      RoutineKind.repeated => 'repeated routine',
      _ => 'to-do',
    };
    return guardUnsaved(
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.existing == null ? 'New $kindName' : 'Edit $kindName'),
          actions: [TextButton(onPressed: _save, child: const Text('Save'))],
        ),
        body: editorForm(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 48),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: TextFormField(
                  controller: _title,
                  autofocus: widget.existing == null,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Title'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Give it a title' : null,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextFormField(
                  controller: _notes,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Notes (optional)'),
                ),
              ),
              ..._scheduleSection(),
              ..._nagSection(),
              if (widget.existing != null)
                SwitchListTile(
                  title: const Text('Active'),
                  subtitle: const Text('Pause to stop reminders without deleting'),
                  value: _active,
                  onChanged: (v) => setState(() => _active = v),
                ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _scheduleSection() {
    if (_isTodo) {
      return [
        const SectionHeader('When'),
        ListTile(
          title: const Text('Start'),
          subtitle: Text(formatDateTime(_startAt)),
          trailing: const Icon(Icons.event),
          onTap: () async {
            final picked = await _pickDateTime(_startAt);
            if (picked != null) setState(() => _startAt = picked);
          },
        ),
        ListTile(
          title: const Text('Deadline (optional)'),
          subtitle: Text(
            _endAt == null
                ? 'None: reminds once a day until done'
                : '${formatDateTime(_endAt!)} (+${formatMinutes(_endAt!.difference(_startAt).inMinutes)})',
          ),
          trailing: _endAt == null
              ? const Icon(Icons.event_busy)
              : IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () => setState(() => _endAt = null),
                ),
          onTap: () async {
            final minutes = await pickMinutes(
              context,
              'Deadline after the start',
              _endAt?.difference(_startAt).inMinutes ?? 1440,
              _deadlinePresets,
              5,
            );
            if (minutes != null) {
              setState(() => _endAt = _startAt.add(Duration(minutes: minutes)));
            }
          },
        ),
        ListTile(
          title: const Text('Comes back after done'),
          subtitle: Text(
            _regenDays == null
                ? 'No: one-time'
                : '${_regenDays == 1 ? '1 day' : '$_regenDays days'} after you tick it',
          ),
          trailing: _regenDays == null
              ? const Icon(Icons.autorenew)
              : IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () => setState(() => _regenDays = null),
                ),
          onTap: () async {
            final minutes = await pickMinutes(
              context,
              'Comes back after',
              (_regenDays ?? 7) * 1440,
              const [1440, 7 * 1440, 14 * 1440, 30 * 1440, 90 * 1440],
              1440,
            );
            if (minutes != null) setState(() => _regenDays = minutes ~/ 1440);
          },
        ),
      ];
    }

    return [
      const SectionHeader('When'),
      TimeTile(label: 'Time', minutes: _time, onChanged: (v) => setState(() => _time = v)),
      ListTile(
        title: const Text('Deadline (optional)'),
        subtitle: Text(
          _deadline == null
              ? 'None: just a reminder at the time'
              : '+${formatMinutes(_deadline!)} after the time',
        ),
        trailing: _deadline == null
            ? const Icon(Icons.timer_outlined)
            : IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () => setState(() => _deadline = null),
              ),
        onTap: () async {
          final minutes = await pickMinutes(
            context,
            'Deadline after the time',
            _deadline ?? 30,
            _deadlinePresets,
            5,
          );
          if (minutes != null) setState(() => _deadline = minutes);
        },
      ),
      if (widget.kind == RoutineKind.daily) ...[
        const ListTile(title: Text('Days')),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: WeekdayPicker(
            selected: _rec.weekdays,
            onChanged: (v) => setState(() => _rec = _rec.copyWith(weekdays: v)),
          ),
        ),
      ] else
        RecurrenceFields(value: _rec, onChanged: (v) => setState(() => _rec = v)),
    ];
  }

  List<Widget> _nagSection() {
    if (!_hasDeadline) {
      return [
        const SectionHeader('Reminders'),
        ListTile(
          leading: const Icon(Icons.notifications_outlined),
          title: Text(_isTodo ? 'Reminds once a day until done' : 'Reminds once at the time'),
          subtitle: const Text('Set a deadline to nag with half-life'),
        ),
        _alertStyleTile(),
      ];
    }
    // Preview on a sample occurrence: start now-ish, end at the deadline.
    final sampleStart = _isTodo ? _startAt : DateTime(2000, 1, 1);
    final sampleEnd = _isTodo ? _endAt! : sampleStart.add(Duration(minutes: _deadline!));
    final policy = NagPolicy(
      firstInterval: Duration(minutes: _firstInterval),
      halfLife: _halfLifeMode == _HalfLifeMode.custom
          ? Duration(minutes: _halfLife)
          : NagPolicy.autoHalfLife(
              start: sampleStart,
              end: sampleEnd,
              firstInterval: Duration(minutes: _firstInterval),
              minInterval: Duration(minutes: _minInterval),
              factor: _factor,
            ),
      factor: _factor,
      minInterval: Duration(minutes: _minInterval),
    );
    return [
      const SectionHeader('Reminders'),
      SwitchListTile(
        title: const Text('Nag until the deadline'),
        subtitle: Text(
          _nag
              ? 'Reminds more and more often until you tap Done'
              : (_isTodo ? 'Reminds once a day until done' : 'Reminds once at the time'),
        ),
        value: _nag,
        onChanged: (v) => setState(() => _nag = v),
      ),
      if (_nag) ...[
        DurationTile(
          label: 'Remind every',
          minutes: _firstInterval,
          minMinutes: 5,
          onChanged: (v) => setState(() => _firstInterval = v),
        ),
        ListTile(
          title: const Text('Half-life'),
          subtitle: Text(
            _halfLifeMode == _HalfLifeMode.auto
                ? (policy.halfLife == null
                      ? 'Set "remind every" above the fastest rate'
                      : 'Every ${formatMinutes(policy.halfLife!.inMinutes)}, so the fastest '
                            'rate arrives at the deadline')
                : 'Reminders come more often after each period',
          ),
          trailing: DropdownButton<_HalfLifeMode>(
            value: _halfLifeMode,
            items: const [
              DropdownMenuItem(value: _HalfLifeMode.auto, child: Text('Auto')),
              DropdownMenuItem(value: _HalfLifeMode.custom, child: Text('Custom')),
            ],
            onChanged: (v) => setState(() => _halfLifeMode = v!),
          ),
        ),
        if (_halfLifeMode == _HalfLifeMode.custom)
          DurationTile(
            label: 'Half-life period',
            minutes: _halfLife,
            minMinutes: 5,
            presets: const [10, 15, 30, 60, 240, 720, 1440, 2880],
            onChanged: (v) => setState(() => _halfLife = v),
          ),
        ListTile(
          title: const Text('Speed-up (x)'),
          subtitle: const Text('Reminders come x times more often each period'),
          trailing: DropdownButton<double>(
            value: _factor,
            items: [
              for (final f in const [1.5, 2.0, 3.0, 4.0])
                DropdownMenuItem(
                  value: f,
                  child: Text('×${f == f.roundToDouble() ? f.toInt() : f}'),
                ),
            ],
            onChanged: (v) => setState(() => _factor = v!),
          ),
        ),
        DurationTile(
          label: 'Fastest (minimum interval)',
          minutes: _minInterval,
          minMinutes: absoluteMinInterval.inMinutes,
          presets: const [5, 10, 15, 30, 60],
          onChanged: (v) => setState(() => _minInterval = v),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Text(
            'Sequence: ${_sequence(policy)}',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ),
      ],
      _alertStyleTile(),
    ];
  }

  Widget _alertStyleTile() {
    return ListTile(
      title: const Text('Alert style'),
      trailing: SegmentedButton<AlertStyle>(
        segments: const [
          ButtonSegment(
            value: AlertStyle.notification,
            icon: Icon(Icons.notifications_outlined),
            label: Text('Notify'),
          ),
          ButtonSegment(value: AlertStyle.alarm, icon: Icon(Icons.alarm), label: Text('Ring')),
        ],
        selected: {_alert},
        onSelectionChanged: (s) => setState(() => _alert = s.first),
      ),
    );
  }

  static const _deadlinePresets = [15, 30, 60, 120, 240, 1440, 2880, 4320, 10080];

  /// The distinct gaps the policy steps through, e.g. "4 h → 2 h → 1 h".
  String _sequence(NagPolicy p) {
    final out = <String>[];
    final hl = p.halfLife;
    if (hl == null) return 'every ${formatMinutes(p.intervalAt(Duration.zero).inMinutes)}';
    for (var i = 0; i < 12; i++) {
      final text = formatMinutes(p.intervalAt(hl * i).inMinutes);
      if (out.isNotEmpty && out.last == text) break;
      out.add(text);
    }
    return out.join(' → ');
  }

  Future<DateTime?> _pickDateTime(DateTime initial) async {
    final now = appNow();
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 10),
    );
    if (date == null || !mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null) return null;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }
}
