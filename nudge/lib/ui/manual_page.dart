import 'package:flutter/material.dart';

import 'settings_page.dart';

/// How to use the app, with worked examples. Opens first after install.
///
/// Text in `**double stars**` is shown bold.
class ManualPage extends StatelessWidget {
  const ManualPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manual'), actions: const [SettingsButton()]),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 48),
        children: const [
          _H2('Start here'),
          _P(
            'Nudge keeps you to your plans. Everything stays on your phone and it works '
            'offline. It has four parts, one per tab at the bottom:',
          ),
          _Table([
            ['Tab', 'For', 'Example'],
            [
              'Goals + Promises',
              'Hours you want to reach, filled by what you promise and do each day',
              '"Learn guitar, 50 h by 31 Dec", fed by "Guitar practice, 45 min" today',
            ],
            [
              'Routines',
              'Reminders that can keep nagging until you tick them',
              '"Leave for office, 8:45, Mon–Fri"',
            ],
            [
              'Places',
              'An alarm that rings when you arrive somewhere',
              '"Wake me 150 m before my bus stop"',
            ],
          ]),
          _H3('First, allow these'),
          _P(
            'Open **Settings** (the gear at the top right) and, under **Make reminders '
            'reliable**, allow each of these once. Without them reminders arrive late or not at all.',
          ),
          _Table([
            ['Setting', 'Why'],
            ['Notifications', 'Every reminder is a notification.'],
            [
              'Ignore battery optimization',
              'Stops Android delaying reminders and pausing location alarms.',
            ],
            [
              'Full-screen alarms',
              'Lets a location alarm show over the lock screen (Android 14+).',
            ],
            ['Location', 'Only for Places; asked when you add your first location alarm.'],
          ]),
          _P(
            'After restarting the phone, open Nudge once so location alarms start again. '
            'Routine reminders resume on their own.',
          ),

          _H2('Goals and promises'),
          _P(
            'These work as a pair. A **goal** is a number of hours you want to reach by a date. '
            'A **promise** is what you will do **today** toward it. Every promise you keep adds '
            'its time to its goal, so the goal fills up day by day.',
          ),
          _H3('Example: learning guitar'),
          _P('Say you want to practise guitar for 50 hours this quarter.'),
          _P('**Step 1: set the goal (once).** Open **Goals**, tap **Goal** and fill in:'),
          _Table([
            ['Field', 'You enter'],
            ['Goal', 'Learn guitar'],
            ['Target', '50 hours'],
            ['Start', '1 Oct'],
            ['Length', 'End date: 31 Dec (or X days: 92)'],
          ]),
          _P(
            '**Step 2: promise in the morning.** At 8:00 Nudge reminds you to make today\'s '
            'promises, and keeps reminding until you add one. Open **Promises**, tap '
            '**Promise** and add:',
          ),
          _Bullets([
            '"Guitar practice", **For** 45 min, **Counts toward** Learn guitar',
            '"Gym", **For** 1 h, **Counts toward** No goal',
          ]),
          _P('**Step 3: tick in the evening.** Tap each promise you kept:'),
          _Bullets([
            '**Guitar practice:** Nudge asks "Did you do the full 45 min?" You only managed 30, '
                'so tap **Enter actual time** and pick 30 min. Learn guitar gains 30 min.',
            '**Gym:** tap **Yes, 1 h**. It has no goal, so the hour shows under '
                '**Miscellaneous** at the bottom of Goals.',
          ]),
          _P(
            'Anything not ticked by midnight counts as **broken** and adds nothing. The Promises '
            'tab shows the day\'s tally and your record over the last 30 days.',
          ),
          _P('**Step 4: read the goal card.** Two weeks in (13 Oct, 6 h done) it shows:'),
          _Table([
            ['On the card', 'Shows', 'Means'],
            ['Progress', '6 h of 50 h · 12%', 'How much of the target is done'],
            ['Time passed', '13 of 92 days · 14%', 'How much of the period is gone'],
            ['Days left', '79', ''],
            ['At this rate', '42.5 h · 85%', 'Where you end if you keep this pace'],
            ['Needed from now', '34 min / day', 'What to promise each day to still hit 50 h'],
          ]),
          _P(
            'Progress (12%) trails time (14%), so you are a little behind: promise at least '
            '34 min tomorrow.',
          ),
          _H3('Good to know'),
          _Bullets([
            '**Morning reminder:** change its time, make it ring like an alarm, or switch it '
                'off in Settings → Promises.',
            '**Want an evening reminder to tick?** Add a daily routine such as "Tick today\'s '
                'promises" at 21:30.',
            '**Several promises, one goal:** "Guitar scales, 20 min" and "Guitar songs, 30 min" '
                'both count toward Learn guitar.',
            '**Fixing a mistake:** tap again to untick, or use the promise\'s ⋮ menu → '
                '**Change actual time…**. The goal updates straight away.',
            '**Planning ahead:** the arrow at the top of Promises goes to coming days. You can '
                'add promises there but tick them only on the day itself.',
            '**History:** past days drop off the Promises tab. A goal\'s ⋮ menu → '
                '**Finished promises** lists every kept promise for it, newest first.',
            '**Ended goals** are deleted, with their promises, two months after the end date. '
                'The card shows the day. Export a backup first to keep them.',
          ]),

          _H2('Routines'),
          _P(
            'Reminders for things to do. The tabs at the top of Routines hold three kinds: tap '
            '**Add** on a tab to make one, and tick the box when it is done.',
          ),
          _H3('Daily: every day at a set time'),
          _Table([
            ['Example', 'Set up', 'What happens'],
            ['Take vitamins', 'Time 9:00', 'One reminder at 9:00. Back unticked tomorrow.'],
            [
              'Leave for office',
              'Time 8:45, Mon–Fri, Deadline +15 min, Nag on, Ring',
              'Rings at 8:45, then every few minutes until ticked or 9:00. Silent at weekends.',
            ],
          ]),
          _H3('Repeated: any other pattern'),
          _P('Pick a **Pattern**; the screen previews the next three dates.'),
          _Table([
            ['Example', 'Pattern', 'Next dates from Tue 13 Oct'],
            ['Water the plants', 'Every 3 days', '13, 16, 19 Oct'],
            ['Pay rent', 'Monthly on day 1, Deadline +3 days, Nag on', '1 Nov, 1 Dec, 1 Jan'],
            ['Society meeting', 'Monthly on the 3rd Wednesday', '21 Oct, 18 Nov, 16 Dec'],
            ['Car insurance', 'Yearly on 15 Mar', '15 Mar'],
            ['Physio', 'Weekly on Mon + Thu, ends after 10 times', '15, 19, 22 Oct'],
          ]),
          _H3('To-do: a task to get done'),
          _Table([
            ['Example', 'Set up', 'What happens'],
            [
              'Renew passport',
              'Start Mon 10:00, no deadline',
              'Reminds daily at 10:00 until ticked.',
            ],
            [
              'Pay electricity bill',
              'Start Mon 10:00, Deadline +2 days, Nag on',
              'Nags more and more often until Wed 10:00.',
            ],
            [
              'Change toothbrush',
              'Comes back after done: 90 days',
              'When ticked, a new round appears 90 days later.',
            ],
          ]),
          _P('Ticked one by mistake? Tap **Undo** in the bar that appears.'),
          _H3('Deadlines and nagging'),
          _P(
            'Without a deadline an item just reminds you. Add a **Deadline** and switch on '
            '**Nag until the deadline** to be reminded again and again, faster as time runs '
            'out. For the electricity bill with **Remind every** 4 h:',
          ),
          _Bullets.numbered([
            'At first: every 4 h.',
            'As the deadline nears: every 2 h, 1 h, then 30 min.',
            'Last stretch: every 15 min (the **Fastest** setting; never under 5 min).',
            'Wed 10:00, still not done: marked **missed**, reminders stop.',
          ]),
          _P(
            '**Half-life** on Auto times this so the fastest reminders come just before the '
            'deadline; **Speed-up** (×2) is how much faster each step is. **Snooze** delays the '
            'next reminder but does not slow the speed-up.',
          ),
          _Bullets([
            '**Alert style:** Notify for a normal notification, Ring to ring like an alarm clock '
                '(for a minute, on the alarm volume, even if notifications are silenced).',
            '**⋮ menu:** Snooze, History (done and missed days), Delete. Tap an item to edit it.',
            '**Pause** without deleting: open the item and switch off **Active**.',
          ]),

          _H2('Places'),
          _P('A location alarm rings as you get near a spot, so you can doze on the bus.'),
          _H3('Example: never miss your bus stop'),
          _Bullets.numbered([
            '**Find the spot.** In Google Maps, long-press your stop. Its coordinates appear in '
                'the search bar (like 19.0176, 72.8562). Tap them to copy.',
            '**Add the alarm.** In **Places** tap **Alarm**, type a name ("Dadar stop") and '
                'paste into **Coordinates**. The line underneath confirms what it read.',
            '**Pick the radius.** 150 m (the default) suits a bus; use 500 m or more for a '
                'fast train.',
            '**Save.** A "Watching your location" notification stays while any alarm is on.',
            '**Arrive.** Within 150 m the phone rings, even when locked, with a big **Stop** button.',
          ]),
          _H3('Why it does not ring twice'),
          _P(
            'After **Stop** it stays quiet while you are near. It rings again only after you '
            'have been this far away and come back (**Rings again after you\'ve been away**):',
          ),
          _Table([
            ['Choose', 'When'],
            ['100 m or 1 km', 'A place you leave and return to the same day'],
            ['10 km', 'Your daily commute'],
            ['100 km (default)', 'A trip: rings when you return from far away'],
          ]),

          _H2('Backup and privacy'),
          _Bullets([
            '**Back up:** Settings → Backup → **Export data**, and save the file somewhere safe '
                '(Downloads, Google Drive). Do it now and then, and always before uninstalling.',
            '**Restore:** Settings → Backup → **Import data**. It replaces what is in the app; a '
                'wrong file is refused and changes nothing.',
            '**Private:** Nudge has no internet access, so nothing leaves your phone. Live '
                'location is never stored, and a locked phone hides notification text.',
          ]),

          _H2('Troubleshooting'),
          _Table([
            ['Problem', 'Fix'],
            [
              'Reminders late or missing',
              'Allow Notifications and Ignore battery optimization in Settings. On Xiaomi, '
                  'Oppo, Vivo and similar phones also allow Autostart for Nudge.',
            ],
            [
              'Location alarm did not ring',
              'Check location is on and allowed, and the "Watching your location" notification '
                  'shows. After a restart, open Nudge once.',
            ],
            [
              'Alarm made no sound',
              'Alarms ring on the phone\'s alarm volume: turn it up (the same one your alarm '
                  'clock uses).',
            ],
            [
              'Rang once, not again',
              'By design: it needs you to go away by the set distance first. Lower it to 100 m '
                  'or 1 km.',
            ],
            [
              'Ticked a to-do by mistake',
              'Tap Undo right after ticking (8 seconds). Delete removes the whole to-do.',
            ],
            [
              'A goal disappeared',
              'Ended goals go two months after their end. Import an older backup to get it back.',
            ],
          ]),
        ],
      ),
    );
  }
}

/// [text] with `**bold**` parts.
TextSpan _rich(String text, TextStyle? style) {
  final parts = text.split('**');
  return TextSpan(
    style: style,
    children: [
      for (var i = 0; i < parts.length; i++)
        TextSpan(
          text: parts[i],
          style: i.isOdd ? const TextStyle(fontWeight: FontWeight.bold) : null,
        ),
    ],
  );
}

class _H2 extends StatelessWidget {
  const _H2(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 8),
      child: Text(
        text,
        style: theme.textTheme.headlineSmall?.copyWith(color: theme.colorScheme.primary),
      ),
    );
  }
}

class _H3 extends StatelessWidget {
  const _H3(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 6),
      child: Text(text, style: Theme.of(context).textTheme.titleMedium),
    );
  }
}

class _P extends StatelessWidget {
  const _P(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text.rich(_rich(text, Theme.of(context).textTheme.bodyMedium)),
    );
  }
}

/// A list whose items are marked with bullets, or numbered when [numbered].
class _Bullets extends StatelessWidget {
  const _Bullets(this.items) : numbered = false;

  const _Bullets.numbered(this.items) : numbered = true;

  final List<String> items;
  final bool numbered;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 22, child: Text(numbered ? '${i + 1}.' : '•', style: style)),
                  Expanded(child: Text.rich(_rich(items[i], style))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// A table whose first row is the header.
class _Table extends StatelessWidget {
  const _Table(this.rows);

  final List<List<String>> rows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final small = theme.textTheme.bodySmall;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Table(
        border: TableBorder.all(color: theme.colorScheme.outlineVariant),
        defaultVerticalAlignment: TableCellVerticalAlignment.top,
        children: [
          for (var r = 0; r < rows.length; r++)
            TableRow(
              decoration: r == 0
                  ? BoxDecoration(color: theme.colorScheme.surfaceContainerHighest)
                  : null,
              children: [
                for (final cell in rows[r])
                  Padding(
                    padding: const EdgeInsets.all(6),
                    child: Text(
                      cell,
                      style: r == 0 ? small?.copyWith(fontWeight: FontWeight.bold) : small,
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
