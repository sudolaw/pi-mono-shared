import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/clock.dart';
import 'package:nudge/core/goal_stats.dart';
import 'package:nudge/data/db.dart';
import 'package:nudge/services/app_services.dart';
import 'package:nudge/services/engine.dart';
import 'package:nudge/ui/home.dart';

/// Drives the real screens on an in-memory database, with the phone-only
/// parts (notifications, alarms, location) replaced.
class _SilentNotifier implements ReminderNotifier {
  final shown = <String>[];

  @override
  Future<void> showReminder(Occurrence o, Routine r) async => shown.add(r.title);

  @override
  Future<void> showMissed(Occurrence o, Routine r) async {}

  @override
  Future<void> cancelReminder(int occurrenceId) async {}

  @override
  Future<void> cancelAll() async {}
}

late AppDb db;

Future<void> startApp(WidgetTester tester, DateTime now, {bool asInstalled = false}) async {
  appNow = () => now;
  db = AppDb(DatabaseConnection(NativeDatabase.memory(), closeStreamsSynchronously: true));
  services = AppServices(
    db,
    notifier: _SilentNotifier(),
    armNextTick: (_) async {},
    syncLocation: () async {},
  );
  // As main() does on a phone; other tests start on Routines.
  final firstRun = asInstalled && (await tester.runAsync(db.isFirstRun))!;
  await tester.pumpWidget(NudgeApp(startOnManual: firstRun));
  await tester.pumpAndSettle();
}

Finder navItem(String label) =>
    find.descendant(of: find.byType(NavigationBar), matching: find.text(label));

Finder tileCheckbox(String title) =>
    find.descendant(of: find.widgetWithText(ListTile, title), matching: find.byType(Checkbox));

void main() {
  setUpAll(() => driftRuntimeOptions.dontWarnAboutMultipleDatabases = true);

  tearDown(() async {
    await db.close();
    appNow = DateTime.now;
  });

  testWidgets('bottom bar moves between the sub-apps and the manual, top tabs within Routines', (
    tester,
  ) async {
    await startApp(tester, DateTime(2026, 10, 12, 10));

    expect(find.text('Routines'), findsWidgets);
    expect(find.textContaining('Add things you do every day'), findsOneWidget);

    await tester.tap(navItem('Promises'));
    await tester.pumpAndSettle();
    expect(find.text('Promises · Today'), findsOneWidget);

    await tester.tap(navItem('Goals'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No goals yet'), findsOneWidget);

    await tester.tap(navItem('Places'));
    await tester.pumpAndSettle();
    expect(find.text('Location alarms'), findsOneWidget);

    await tester.tap(navItem('Manual'));
    await tester.pumpAndSettle();
    expect(find.text('Start here'), findsOneWidget);

    await tester.tap(navItem('Routines'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Repeated'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Add things on a pattern'), findsOneWidget);
    await tester.tap(find.text('To-do'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Add one-time tasks'), findsOneWidget);
    await tester.tap(find.text('Daily'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Add things you do every day'), findsOneWidget);
  });

  testWidgets('the first run after install opens on the manual', (tester) async {
    await startApp(tester, DateTime(2026, 10, 12, 10), asInstalled: true);
    expect(tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex, 4);
    expect(find.text('Start here'), findsOneWidget);
  });

  testWidgets('goal of 2 h in 1 day is 50% after ticking a 1 h promise', (tester) async {
    await startApp(tester, DateTime(2026, 10, 12, 10));

    // Goals → new goal: "Search for 3D printer", 2 hours, 1 day.
    await tester.tap(navItem('Goals'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Goal'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'Search for 3D printer');
    await tester.enterText(find.byType(TextFormField).at(1), '2');
    await tester.enterText(find.widgetWithText(TextField, 'Days'), '1');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(find.text('Search for 3D printer'), findsOneWidget);
    expect(find.textContaining('0 h of 2 h'), findsOneWidget);

    // Promises → "3D printer", 1 h, counts toward the goal.
    await tester.tap(navItem('Promises'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Promise'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'What'), '3D printer');
    expect(find.text('1 h'), findsOneWidget, reason: 'default promise is 1 hour');
    await tester.tap(find.text('No goal'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Search for 3D printer').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Promise'));
    await tester.pumpAndSettle();

    expect(find.text('3D printer'), findsOneWidget);
    expect(find.textContaining('→ Search for 3D printer'), findsOneWidget);

    // Tick it off.
    await tester.tap(tileCheckbox('3D printer'));
    await tester.pumpAndSettle();
    expect(find.text('Did you do the full 1 h?'), findsOneWidget);
    await tester.tap(find.text('Yes, 1 h'));
    await tester.pumpAndSettle();
    expect(tester.widget<Checkbox>(tileCheckbox('3D printer')).value, isTrue);

    // The goal is now half done.
    await tester.tap(navItem('Goals'));
    await tester.pumpAndSettle();
    expect(find.textContaining('1 h of 2 h · 50%'), findsOneWidget);

    final (goal, promises) = (await tester.runAsync(
      () async => (await db.select(db.goals).getSingle(), await db.select(db.promises).get()),
    ))!;
    final stats = GoalStats.compute(
      start: goal.startDate,
      totalDays: goal.totalDays,
      targetMinutes: goal.targetMinutes,
      doneMinutes: promises
          .where((p) => p.goalId == goal.id)
          .fold(0, (sum, p) => sum + p.creditedMinutes),
      today: appNow(),
    );
    expect(goal.totalDays, 1);
    expect(stats.progressFraction, 0.5);
  });

  testWidgets('Brush teeth ticked today comes back unticked tomorrow', (tester) async {
    // Added at 5 pm with the default 9:00 time.
    await startApp(tester, DateTime(2026, 10, 12, 17));

    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Brush teeth');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.text('Brush teeth'), findsOneWidget);
    final box = tileCheckbox('Brush teeth');
    expect(tester.widget<Checkbox>(box).onChanged, isNotNull, reason: 'can tick it today');
    expect(tester.widget<Checkbox>(box).value, isFalse);

    await tester.tap(box);
    await tester.pumpAndSettle();
    expect(tester.widget<Checkbox>(box).value, isTrue);
    expect(find.textContaining('Today: done'), findsOneWidget);

    // Next morning: a fresh, unticked Brush teeth for the new day.
    appNow = () => DateTime(2026, 10, 13, 8);
    await tester.runAsync(services.refresh);
    await tester.pumpAndSettle();
    expect(tester.widget<Checkbox>(box).value, isFalse);
    expect(find.textContaining('Today: starts 9:00'), findsOneWidget);

    final rows = (await tester.runAsync(
      () =>
          (db.select(db.occurrences)
                ..where((t) => t.routineId.isNotIn([1]))
                ..orderBy([(t) => OrderingTerm.asc(t.day)]))
              .get(),
    ))!;
    expect(rows.map((o) => (o.day.day, o.status)), [
      (12, OccurrenceStatus.done),
      (13, OccurrenceStatus.pending),
    ]);
  });

  testWidgets('a coordinates error clears once the text is fixed, without saving again', (
    tester,
  ) async {
    await startApp(tester, DateTime(2026, 10, 12, 10));

    await tester.tap(navItem('Places'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Alarm'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'Dadar stop');
    await tester.enterText(find.byType(TextFormField).at(1), 'hello world');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(find.text('Could not read coordinates'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).at(1), '19.0760, 72.8777');
    await tester.pumpAndSettle();
    expect(find.text('Could not read coordinates'), findsNothing);
    expect(find.text('Latitude 19.076000, longitude 72.877700'), findsOneWidget);
  });

  testWidgets('ticking a to-do that comes back can be undone, withdrawing the next round', (
    tester,
  ) async {
    await startApp(tester, DateTime(2026, 10, 12, 10));

    await tester.tap(find.text('To-do'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Change toothbrush');
    await tester.tap(find.text('Comes back after done'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('7 d'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    await tester.tap(tileCheckbox('Change toothbrush'));
    await tester.pumpAndSettle();
    expect(find.textContaining('19 Oct'), findsWidgets, reason: 'next round shown');

    await tester.tap(find.text('Undo'));
    await tester.pumpAndSettle();
    expect(find.textContaining('19 Oct'), findsNothing);

    final rows = (await tester.runAsync(
      () => (db.select(db.occurrences)..where((t) => t.routineId.isNotIn([1]))).get(),
    ))!;
    expect(rows.map((o) => (o.day.day, o.status)), [(12, OccurrenceStatus.pending)]);
  });

  testWidgets('a promise for tomorrow can be planned but not ticked yet', (tester) async {
    await startApp(tester, DateTime(2026, 10, 12, 10));

    await tester.tap(navItem('Promises'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Next day'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Promise'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'What'), 'Gym');
    await tester.tap(find.widgetWithText(FilledButton, 'Promise'));
    await tester.pumpAndSettle();

    expect(find.text('Gym'), findsOneWidget);
    expect(tester.widget<Checkbox>(tileCheckbox('Gym')).onChanged, isNull);
    await tester.tap(find.text('Gym'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Did you do the full'), findsNothing);
  });
}
