import 'package:flutter/material.dart';

import '../core/dates.dart';
import '../core/recurrence.dart';
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';
import 'format.dart';
import 'settings_page.dart';
import 'routine_editor.dart';
import '../core/clock.dart';
import 'watch.dart';

/// Daily / Repeated / To-do tabs.
class RoutinesPage extends StatefulWidget {
  const RoutinesPage({super.key});

  @override
  State<RoutinesPage> createState() => _RoutinesPageState();
}

class _RoutinesPageState extends State<RoutinesPage> with SingleTickerProviderStateMixin {
  late final _tabs = TabController(length: 3, vsync: this);
  static const _kinds = [RoutineKind.daily, RoutineKind.repeated, RoutineKind.todo];

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Routines'),
        actions: const [SettingsButton()],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Daily'),
            Tab(text: 'Repeated'),
            Tab(text: 'To-do'),
          ],
        ),
      ),
      body: Watch<Map<int, Occurrence>>(
        query: () => services.db.watchLatestOccurrences(),
        builder: (context, occSnap) {
          final latest = occSnap.data ?? const {};
          return TabBarView(
            controller: _tabs,
            children: [for (final k in _kinds) _RoutineList(kind: k, latest: latest)],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        // Pages share one route (bottom bar), so each FAB needs its own hero tag.
        heroTag: 'routines-fab',
        icon: const Icon(Icons.add),
        label: const Text('Add'),
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => RoutineEditor(kind: _kinds[_tabs.index])),
        ),
      ),
    );
  }
}

class _RoutineList extends StatelessWidget {
  const _RoutineList({required this.kind, required this.latest});

  final RoutineKind kind;
  final Map<int, Occurrence> latest;

  @override
  Widget build(BuildContext context) {
    return Watch<List<Routine>>(
      query: () => services.db.watchRoutines(kind),
      keyValue: kind,
      builder: (context, snap) {
        final items = snap.data;
        if (items == null) return const Center(child: CircularProgressIndicator());
        if (items.isEmpty) {
          return EmptyState(
            icon: Icons.checklist,
            text: switch (kind) {
              RoutineKind.daily =>
                'Nothing yet. Add things you do every day, like "Leave for office 8:45".',
              RoutineKind.repeated =>
                'Nothing yet. Add things on a pattern, like "every Thursday" or '
                    '"3rd Wednesday of the month".',
              _ => 'Nothing yet. Add one-time tasks; they can nag you until done.',
            },
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.only(bottom: 96),
          itemCount: items.length,
          separatorBuilder: (_, _) => const Divider(height: 1),
          itemBuilder: (context, i) => RoutineTile(routine: items[i], latest: latest[items[i].id]),
        );
      },
    );
  }
}

class RoutineTile extends StatelessWidget {
  const RoutineTile({super.key, required this.routine, required this.latest});

  final Routine routine;
  final Occurrence? latest;

  /// The occurrence the checkbox acts on: today's, or a to-do's only one.
  Occurrence? get _current {
    final o = latest;
    if (o == null) return null;
    if (routine.kind == RoutineKind.todo) return o;
    return dateOnly(o.day) == dateOnly(appNow()) ? o : null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final current = _current;
    final status = _statusText(current);
    return ListTile(
      enabled: routine.active,
      leading: Checkbox(
        value: current?.status == OccurrenceStatus.done,
        onChanged: current == null || current.status == OccurrenceStatus.missed
            ? null
            : (v) => _setDone(context, current, v ?? false),
      ),
      title: Text(
        routine.title,
        style: current?.status == OccurrenceStatus.done
            ? const TextStyle(decoration: TextDecoration.lineThrough)
            : null,
      ),
      subtitle: Text(
        [_scheduleText(), ?status].join('\n'),
        style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
      ),
      isThreeLine: status != null,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (routine.alertStyle == AlertStyle.alarm) const Icon(Icons.alarm, size: 18),
          PopupMenuButton<String>(
            onSelected: (v) => _onMenu(context, v, current),
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
              if (current?.status == OccurrenceStatus.pending &&
                  !appNow().isBefore(current!.startAt))
                const PopupMenuItem(value: 'snooze', child: Text('Snooze…')),
              if (routine.kind != RoutineKind.todo)
                const PopupMenuItem(value: 'history', child: Text('History')),
              const PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
        ],
      ),
      onTap: () => _edit(context),
    );
  }

  /// Ticking a to-do that comes back swaps the tile to its next round, leaving
  /// the ticked one out of reach, so Undo is offered straight away.
  Future<void> _setDone(BuildContext context, Occurrence o, bool done) async {
    final messenger = ScaffoldMessenger.of(context);
    await services.setDone(o.id, done);
    if (!done || routine.kind != RoutineKind.todo || routine.regenDays == null) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text('"${routine.title}" done'),
          persist: false,
          duration: const Duration(seconds: 8),
          action: SnackBarAction(label: 'Undo', onPressed: () => services.setDone(o.id, false)),
        ),
      );
  }

  String _scheduleText() {
    if (routine.kind == RoutineKind.todo) {
      final start = routine.startAt;
      final end = routine.endAt;
      final regen = routine.regenDays;
      return [
        [
          if (start != null) 'From ${formatDateTime(start)}',
          if (end != null) 'deadline ${formatDateTime(end)}',
        ].join(', '),
        if (regen != null) 'back ${regen == 1 ? '1 day' : '$regen days'} after done',
      ].join(' · ');
    }
    final parts = <String>[];
    final time = routine.timeMinutes;
    if (time != null) {
      final deadline = routine.deadlineMinutes;
      parts.add(
        deadline == null
            ? formatTimeOfDay(time)
            : '${formatTimeOfDay(time)}, deadline +${formatMinutes(deadline)}',
      );
    }
    if (routine.recurrence != null) parts.add(Recurrence.decode(routine.recurrence!).describe());
    if (!routine.active) parts.add('Paused');
    return parts.join(' · ');
  }

  String? _statusText(Occurrence? o) {
    if (!routine.active) return null;
    final now = appNow();
    if (o == null) {
      if (routine.kind == RoutineKind.todo || routine.recurrence == null) return null;
      final rec = Recurrence.decode(routine.recurrence!);
      final next = rec.nextOnOrAfter(addDays(now, 1));
      return next == null ? 'No upcoming dates' : 'Next: ${formatDate(next)}';
    }
    final today = routine.kind == RoutineKind.todo ? '' : 'Today: ';
    return switch (o.status) {
      OccurrenceStatus.done =>
        '${today}done${o.doneAt == null ? '' : ' at ${formatClock(o.doneAt!)}'}',
      OccurrenceStatus.missed => routine.kind == RoutineKind.todo ? 'Overdue' : '${today}missed',
      // A later day: a to-do's next round or future start.
      OccurrenceStatus.pending when o.day.isAfter(dateOnly(now)) =>
        'Starts ${formatDateTime(o.startAt)}',
      OccurrenceStatus.pending when now.isBefore(o.startAt) =>
        '${today}starts ${formatClock(o.startAt)}',
      OccurrenceStatus.pending when o.snoozedUntil != null && now.isBefore(o.snoozedUntil!) =>
        '${today}snoozed until ${formatClock(o.snoozedUntil!)}',
      OccurrenceStatus.pending => '${today}waiting for Done',
    };
  }

  void _edit(BuildContext context) => Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => RoutineEditor(kind: routine.kind, existing: routine),
    ),
  );

  Future<void> _onMenu(BuildContext context, String action, Occurrence? current) async {
    switch (action) {
      case 'edit':
        _edit(context);
      case 'snooze':
        final minutes = await pickMinutes(context, 'Snooze for', 15, const [5, 15, 30, 60, 180], 1);
        if (minutes != null) await services.snooze(current!.id, Duration(minutes: minutes));
      case 'history':
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => _HistoryPage(routine: routine)),
        );
      case 'delete':
        if (await confirm(context, 'Delete "${routine.title}"?', 'Delete')) {
          await services.deleteRoutine(routine.id);
        }
    }
  }
}

class _HistoryPage extends StatelessWidget {
  const _HistoryPage({required this.routine});

  final Routine routine;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(routine.title)),
      body: Watch<List<Occurrence>>(
        query: () => services.db.watchHistory(routine.id),
        keyValue: routine.id,
        builder: (context, snap) {
          final rows = snap.data;
          if (rows == null) return const Center(child: CircularProgressIndicator());
          if (rows.isEmpty) {
            return const EmptyState(icon: Icons.history, text: 'No history yet.');
          }
          final finished = rows.where((o) => o.status != OccurrenceStatus.pending).toList();
          final done = finished.where((o) => o.status == OccurrenceStatus.done).length;
          return ListView(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  finished.isEmpty
                      ? 'Nothing finished yet'
                      : 'Done $done of ${finished.length} (${formatPercent(done / finished.length)})',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              for (final o in rows)
                ListTile(
                  leading: Icon(switch (o.status) {
                    OccurrenceStatus.done => Icons.check_circle,
                    OccurrenceStatus.missed => Icons.cancel_outlined,
                    OccurrenceStatus.pending => Icons.radio_button_unchecked,
                  }),
                  title: Text(formatDate(o.day)),
                  subtitle: Text(switch (o.status) {
                    OccurrenceStatus.done =>
                      'Done${o.doneAt == null ? '' : ' at ${formatDateTime(o.doneAt!)}'}',
                    OccurrenceStatus.missed => 'Missed',
                    OccurrenceStatus.pending => 'Pending',
                  }),
                ),
            ],
          );
        },
      ),
    );
  }
}
