import 'package:flutter/material.dart';

import '../core/clock.dart';
import '../core/dates.dart';
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';
import 'format.dart';
import 'promise_editor.dart';
import 'settings_page.dart';
import 'watch.dart';

/// Today's promises, days ahead for planning, and the kept/broken record.
class PromisesPage extends StatefulWidget {
  const PromisesPage({super.key});

  @override
  State<PromisesPage> createState() => _PromisesPageState();
}

class _PromisesPageState extends State<PromisesPage> {
  DateTime _day = dateOnly(appNow());

  DateTime get _today => dateOnly(appNow());
  bool get _isToday => _day == _today;
  bool get _isPast => _day.isBefore(_today);

  @override
  Widget build(BuildContext context) {
    final title = _isToday
        ? 'Today'
        : _day == addDays(_today, -1)
        ? 'Yesterday'
        : _day == addDays(_today, 1)
        ? 'Tomorrow'
        : formatShortDate(_day);
    return Scaffold(
      appBar: AppBar(
        title: Text('Promises · $title'),
        actions: [
          // Past days are hidden here; kept promises are listed on each goal.
          if (_day.isAfter(_today))
            IconButton(
              tooltip: 'Previous day',
              icon: const Icon(Icons.chevron_left),
              onPressed: () => setState(() => _day = addDays(_day, -1)),
            ),
          IconButton(
            tooltip: 'Next day',
            icon: const Icon(Icons.chevron_right),
            onPressed: () => setState(() => _day = addDays(_day, 1)),
          ),
          if (!_isToday)
            IconButton(
              tooltip: 'Today',
              icon: const Icon(Icons.today),
              onPressed: () => setState(() => _day = _today),
            ),
          const SettingsButton(),
        ],
      ),
      body: Watch<List<Goal>>(
        query: () => services.db.watchGoals(),
        builder: (context, goalSnap) {
          final goals = {for (final g in goalSnap.data ?? const <Goal>[]) g.id: g};
          return Watch<List<PromiseEntry>>(
            query: () => services.db.watchPromisesFor(_day),
            keyValue: _day,
            builder: (context, snap) {
              final promises = snap.data ?? const <PromiseEntry>[];
              return ListView(
                padding: const EdgeInsets.only(bottom: 96),
                children: [
                  if (promises.isEmpty)
                    EmptyState(
                      icon: Icons.handshake_outlined,
                      text: _isPast
                          ? 'No promises on this day.'
                          : 'No promises yet. Tap "Promise" to commit to something, '
                                'like "1 h XGBoost model building".',
                    )
                  else ...[
                    const SectionHeader('Promises'),
                    for (final p in promises)
                      _PromiseTile(
                        promise: p,
                        goal: goals[p.goalId],
                        editable: !_isPast,
                        tickable: !_day.isAfter(_today),
                        goals: goals.values.where((g) => !g.archived).toList(),
                      ),
                    _DaySummary(promises: promises, today: _today),
                  ],
                  const _RecordCard(),
                ],
              );
            },
          );
        },
      ),
      floatingActionButton: _isPast
          ? null
          : FloatingActionButton.extended(
              // Pages share one route (bottom bar), so each FAB needs its own hero tag.
              heroTag: 'promises-fab',
              icon: const Icon(Icons.add),
              label: const Text('Promise'),
              onPressed: () => showPromiseEditor(context, day: _day),
            ),
    );
  }
}

class _PromiseTile extends StatelessWidget {
  const _PromiseTile({
    required this.promise,
    required this.goal,
    required this.editable,
    required this.tickable,
    required this.goals,
  });

  final PromiseEntry promise;
  final Goal? goal;
  final bool editable;

  /// False on days ahead: they can be planned but not kept yet.
  final bool tickable;
  final List<Goal> goals;

  @override
  Widget build(BuildContext context) {
    final status = promise.effectiveStatus(appNow());
    final kept = status == PromiseStatus.kept;
    final broken = status == PromiseStatus.broken;
    final actual = promise.actualMinutes;
    final duration = actual != null && kept
        ? '${formatMinutes(actual)} of ${formatMinutes(promise.promisedMinutes)}'
        : formatMinutes(promise.promisedMinutes);
    return ListTile(
      leading: broken
          ? const Padding(
              padding: EdgeInsets.all(12),
              child: Icon(Icons.close, color: Colors.redAccent),
            )
          : Checkbox(
              value: kept,
              onChanged: editable && tickable ? (v) => _toggle(context, kept) : null,
            ),
      title: Text(
        promise.title,
        style: kept ? const TextStyle(decoration: TextDecoration.lineThrough) : null,
      ),
      subtitle: Text(
        [duration, if (goal != null) '→ ${goal!.name}', if (broken) 'Broken'].join(' · '),
      ),
      trailing: editable
          ? PopupMenuButton<String>(
              onSelected: (v) => _onMenu(context, v),
              itemBuilder: (_) => [
                if (tickable)
                  const PopupMenuItem(value: 'actual', child: Text('Change actual time…')),
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                const PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            )
          : null,
      onTap: editable && tickable ? () => _toggle(context, kept) : null,
    );
  }

  /// Unticking is immediate; ticking asks whether the full time was kept.
  Future<void> _toggle(BuildContext context, bool kept) async {
    if (kept) return _setKept(false, null);
    final full = formatMinutes(promise.promisedMinutes);
    final choice = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Did you do the full $full?'),
        content: Text(promise.title),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, 'actual'),
            child: const Text('Enter actual time'),
          ),
          FilledButton(onPressed: () => Navigator.pop(context, 'full'), child: Text('Yes, $full')),
        ],
      ),
    );
    if (choice == 'full') return _setKept(true, null);
    if (choice == 'actual' && context.mounted) await _askActual(context);
  }

  Future<void> _askActual(BuildContext context) async {
    final minutes = await pickMinutes(
      context,
      'Time actually spent',
      promise.actualMinutes ?? promise.promisedMinutes,
      const [15, 30, 45, 60, 90, 120, 180, 240],
      1,
    );
    if (minutes != null) await _setKept(true, minutes);
  }

  Future<void> _setKept(bool kept, int? actualMinutes) async {
    await services.setPromiseKept(promise.id, kept, actualMinutes);
  }

  Future<void> _onMenu(BuildContext context, String action) async {
    switch (action) {
      case 'actual':
        await _askActual(context);
      case 'edit':
        await showPromiseEditor(context, day: promise.day, existing: promise);
      case 'delete':
        if (await confirm(context, 'Delete "${promise.title}"?', 'Delete')) {
          await services.deletePromise(promise.id);
        }
    }
  }
}

class _DaySummary extends StatelessWidget {
  const _DaySummary({required this.promises, required this.today});

  final List<PromiseEntry> promises;
  final DateTime today;

  @override
  Widget build(BuildContext context) {
    final kept = promises.where((p) => p.effectiveStatus(today) == PromiseStatus.kept);
    final promised = promises.fold<int>(0, (s, p) => s + p.promisedMinutes);
    final done = kept.fold<int>(0, (s, p) => s + p.creditedMinutes);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Text(
        'Kept ${kept.length} of ${promises.length} · ${formatMinutes(done)} of ${formatMinutes(promised)}',
        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
    );
  }
}

/// Kept vs broken over the last 30 days.
class _RecordCard extends StatelessWidget {
  const _RecordCard();

  @override
  Widget build(BuildContext context) {
    return Watch<List<PromiseEntry>>(
      query: () => services.db.watchPromisesSince(addDays(dateOnly(appNow()), -29)),
      keyValue: dateOnly(appNow()),
      builder: (context, snap) {
        final today = dateOnly(appNow());
        final from = addDays(today, -29);
        final recent = (snap.data ?? const <PromiseEntry>[])
            .where((p) => !p.day.isBefore(from) && !p.day.isAfter(today))
            .map((p) => p.effectiveStatus(today))
            .where((s) => s != PromiseStatus.open)
            .toList();
        if (recent.isEmpty) return const SizedBox.shrink();
        final kept = recent.where((s) => s == PromiseStatus.kept).length;
        final broken = recent.length - kept;
        return Card(
          margin: const EdgeInsets.fromLTRB(12, 16, 12, 0),
          child: ListTile(
            leading: const Icon(Icons.insights),
            title: const Text('Last 30 days'),
            subtitle: Text(
              'Kept $kept · Broken $broken · ${formatPercent(kept / recent.length)} kept',
            ),
          ),
        );
      },
    );
  }
}
