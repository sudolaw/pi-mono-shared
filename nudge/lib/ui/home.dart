import 'dart:async';

import 'package:flutter/material.dart';

import '../data/db.dart';
import '../services/app_services.dart';
import '../services/lock_screen.dart';
import '../services/scheduler.dart';
import 'goals_page.dart';
import 'location_page.dart';
import 'manual_page.dart';
import 'promises_page.dart';
import 'routines_page.dart';
import 'watch.dart';

class NudgeApp extends StatelessWidget {
  const NudgeApp({super.key, this.startOnManual = false});

  /// Open on the Manual tab: the first run after install.
  final bool startOnManual;

  @override
  Widget build(BuildContext context) {
    ThemeData theme(Brightness b) => ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo, brightness: b),
      useMaterial3: true,
    );
    return MaterialApp(
      title: 'Nudge',
      theme: theme(Brightness.light),
      darkTheme: theme(Brightness.dark),
      home: HomeShell(startOnManual: startOnManual),
      builder: (context, child) => _RingingLayer(child: child!),
    );
  }
}

/// Bottom navigation between the sections and the manual, plus the ringing overlay.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.startOnManual = false});

  final bool startOnManual;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  late int _index = widget.startOnManual ? _pages.length - 1 : 0;
  late final UiChangeListener _changes;

  static const _pages = [RoutinesPage(), PromisesPage(), GoalsPage(), LocationPage(), ManualPage()];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _changes = UiChangeListener(services.db.refreshAll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _firstRun());
  }

  Future<void> _firstRun() => services.requestStartupPermissions();

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _changes.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Pick up writes from background isolates and catch up on reminders.
      services.db.refreshAll();
      unawaited(services.refresh());
      unawaited(services.syncLocationService());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.checklist), label: 'Routines'),
          NavigationDestination(icon: Icon(Icons.handshake_outlined), label: 'Promises'),
          NavigationDestination(icon: Icon(Icons.flag_outlined), label: 'Goals'),
          NavigationDestination(icon: Icon(Icons.location_on_outlined), label: 'Places'),
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), label: 'Manual'),
        ],
      ),
    );
  }
}

/// Puts the ringing screen above every route (an open editor included) and
/// withdraws the lock-screen exception once nothing rings.
class _RingingLayer extends StatelessWidget {
  const _RingingLayer({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Watch<List<LocationAlarm>>(
      query: () => services.db.watchRingingAlarms(),
      builder: (context, snap) {
        final ringing = snap.data ?? const <LocationAlarm>[];
        if (snap.hasData && ringing.isEmpty) unawaited(setAllowedOnLockScreen(false));
        return Stack(
          children: [
            child,
            if (ringing.isNotEmpty) Positioned.fill(child: RingingOverlay(alarms: ringing)),
          ],
        );
      },
    );
  }
}
