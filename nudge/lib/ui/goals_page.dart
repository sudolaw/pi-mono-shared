import 'package:flutter/material.dart';

import '../core/clock.dart';
import '../core/goal_stats.dart';
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';
import 'format.dart';
import 'goal_editor.dart';
import 'settings_page.dart';
import 'watch.dart';

/// Time goals fed by kept promises.
class GoalsPage extends StatelessWidget {
  const GoalsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Goals'), actions: const [SettingsButton()]),
      body: Watch<Map<int, int>>(
        query: () => services.db.watchGoalMinutes(),
        builder: (context, minSnap) {
          final minutes = minSnap.data ?? const {};
          return Watch<List<Goal>>(
            query: () => services.db.watchGoals(),
            builder: (context, snap) {
              final goals = snap.data;
              if (goals == null) return const Center(child: CircularProgressIndicator());
              return ListView(
                padding: const EdgeInsets.only(bottom: 96, top: 4),
                children: [
                  if (goals.isEmpty)
                    const EmptyState(
                      icon: Icons.flag_outlined,
                      text:
                          'No goals yet. Add one like "ML: 200 h in 90 days", then link '
                          'promises to it.',
                    ),
                  for (final g in goals) _GoalCard(goal: g, doneMinutes: minutes[g.id] ?? 0),
                  const _MiscellaneousCard(),
                ],
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        // Pages share one route (bottom bar), so each FAB needs its own hero tag.
        heroTag: 'goals-fab',
        icon: const Icon(Icons.add),
        label: const Text('Goal'),
        onPressed: () =>
            Navigator.push(context, MaterialPageRoute(builder: (_) => const GoalEditor())),
      ),
    );
  }
}

class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.goal, required this.doneMinutes});

  final Goal goal;
  final int doneMinutes;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final s = GoalStats.compute(
      start: goal.startDate,
      totalDays: goal.totalDays,
      targetMinutes: goal.targetMinutes,
      doneMinutes: doneMinutes,
      today: appNow(),
    );
    final end = goalEndDay(goal.startDate, goal.totalDays);
    final needed = s.neededMinutesPerDay;
    return Opacity(
      opacity: goal.archived ? 0.55 : 1,
      child: Card(
        margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 4, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(goal.name, style: theme.textTheme.titleLarge)),
                  PopupMenuButton<String>(
                    onSelected: (v) => _onMenu(context, v),
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'edit', child: Text('Edit')),
                      const PopupMenuItem(value: 'promises', child: Text('Finished promises')),
                      PopupMenuItem(
                        value: 'archive',
                        child: Text(goal.archived ? 'Unarchive' : 'Archive'),
                      ),
                      const PopupMenuItem(value: 'delete', child: Text('Delete')),
                    ],
                  ),
                ],
              ),
              Text(
                '${formatShortDate(goal.startDate)} – ${formatDate(end)} · ${goal.totalDays} days',
                style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
              ),
              if (s.isFinished)
                Text(
                  'Ended. Deleted with its promises after '
                  '${formatDate(goalDeletionDay(goal.startDate, goal.totalDays))}; '
                  'export a backup to keep it.',
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Bar(
                      label: 'Progress',
                      value: s.progressFraction,
                      text:
                          '${formatHours(doneMinutes)} of ${formatHours(goal.targetMinutes)}'
                          ' · ${formatPercent(s.progressFraction)}',
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(height: 8),
                    _Bar(
                      label: 'Time passed',
                      value: s.timeFraction,
                      text:
                          '${s.elapsedDays} of ${s.totalDays} days · ${formatPercent(s.timeFraction)}',
                      color: theme.colorScheme.tertiary,
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 24,
                      runSpacing: 8,
                      children: [
                        _Stat('Days left', '${s.daysLeft}'),
                        _Stat(
                          'At this rate',
                          s.elapsedDays == 0
                              ? '—'
                              : '${formatHours(s.projectedMinutes)} · ${formatPercent(s.projectedFraction)}',
                        ),
                        _Stat(
                          'Needed from now',
                          needed == null
                              ? (s.isReached ? 'Reached' : 'Ended')
                              : needed == 0
                              ? 'Reached'
                              : '${formatMinutes(needed.ceil())} / day',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _onMenu(BuildContext context, String action) async {
    switch (action) {
      case 'edit':
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => GoalEditor(existing: goal)),
        );
      case 'promises':
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => _FinishedPromisesPage(goal: goal)),
        );
      case 'archive':
        await services.setGoalArchived(goal.id, !goal.archived);
      case 'delete':
        if (await confirm(
          context,
          'Delete "${goal.name}"? Its promises stay, unlinked.',
          'Delete',
        )) {
          await services.deleteGoal(goal.id);
        }
    }
  }
}

/// Kept promises without a goal; shown only once there are some.
class _MiscellaneousCard extends StatelessWidget {
  const _MiscellaneousCard();

  @override
  Widget build(BuildContext context) {
    return Watch<List<PromiseEntry>>(
      query: () => services.db.watchKeptPromises(null),
      builder: (context, snap) {
        final kept = snap.data ?? const <PromiseEntry>[];
        if (kept.isEmpty) return const SizedBox.shrink();
        final total = kept.fold<int>(0, (sum, p) => sum + p.creditedMinutes);
        return Card(
          margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: ListTile(
            leading: const Icon(Icons.inbox_outlined),
            title: const Text('Miscellaneous'),
            subtitle: Text('Promises without a goal · ${kept.length} kept · ${formatHours(total)}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const _FinishedPromisesPage(goal: null)),
            ),
          ),
        );
      },
    );
  }
}

/// The promises kept for one goal ([goal] null: those without a goal), newest
/// first, with the time each added.
class _FinishedPromisesPage extends StatelessWidget {
  const _FinishedPromisesPage({required this.goal});

  final Goal? goal;

  @override
  Widget build(BuildContext context) {
    final muted = TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant);
    final goal = this.goal;
    return Scaffold(
      appBar: AppBar(title: Text(goal?.name ?? 'Miscellaneous')),
      body: Watch<List<PromiseEntry>>(
        query: () => services.db.watchKeptPromises(goal?.id),
        keyValue: goal?.id,
        builder: (context, snap) {
          final kept = snap.data;
          if (kept == null) return const Center(child: CircularProgressIndicator());
          if (kept.isEmpty) {
            return const EmptyState(
              icon: Icons.handshake_outlined,
              text: 'No kept promises for this goal yet.',
            );
          }
          final total = kept.fold<int>(0, (sum, p) => sum + p.creditedMinutes);
          return ListView(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  goal == null
                      ? '${kept.length} kept · ${formatHours(total)}'
                      : '${kept.length} kept · ${formatHours(total)} of ${formatHours(goal.targetMinutes)}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              for (final p in kept)
                ListTile(
                  leading: const Icon(Icons.check_circle_outline),
                  title: Text(p.title),
                  subtitle: Text(formatDate(p.day), style: muted),
                  trailing: Text(
                    p.actualMinutes == null
                        ? formatMinutes(p.promisedMinutes)
                        : '${formatMinutes(p.actualMinutes!)} of ${formatMinutes(p.promisedMinutes)}',
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, required this.text, required this.color});

  final String label;
  final double value;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: theme.textTheme.labelLarge),
            const Spacer(),
            Text(text, style: theme.textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value.clamp(0, 1),
            minHeight: 8,
            color: color,
            backgroundColor: color.withValues(alpha: 0.15),
          ),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        Text(value, style: theme.textTheme.titleSmall),
      ],
    );
  }
}
