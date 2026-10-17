# Nudge: product spec

One Android app (Flutter) that bundles several personal tools. Decisions here were agreed
in planning; change this file when a decision changes.

- **Platform:** Android 11+ (minSdk 30). Flutter keeps iOS possible later; iOS is out of
  scope for now.
- **Data:** stored on the phone only (SQLite). No account, works offline.
- **Install:** a GitHub Actions workflow builds the APK on every push to `nudge/`.

The app has four sections: **Location alarms**, **Routines**, **Promises**, **Goals**, plus a
**Manual** tab (section 5).

---

## 1. Location alarms

Ring when the phone gets within a radius of saved coordinates.

- Input: latitude and longitude copied from Google Maps (long-press a spot; the
  coordinates appear in the search bar). Accept the pasted pair as one string
  (`19.0760, 72.8777`) or two fields. 4 decimal places (~11 m) is enough.
- Radius in meters. Default **150 m**.
- Any number of saved alarms; any number switched on.
- Rings on **arrival** (going from outside to inside the radius). After you stop it, it
  stays quiet while you remain inside and rings again only after you have been far
  enough away and come back. That distance is set per alarm ("Rings again after you've
  been away": 100 m, 1 km, 10 km or **100 km**, the default; never under 50 m so GPS
  wobble at the edge doesn't count). Switching an alarm on where you already are
  doesn't ring.
- Background tracking: an Android **foreground service** (`flutter_foreground_task`)
  checks the position with `geolocator`, so it works with the phone locked. Chosen over
  Android geofencing, which can fire late. A persistent notification shows while any
  alarm is on.
- Battery: the check interval adapts to distance. Far away it checks rarely; close to
  the edge it checks every few seconds.
- When it rings: full-screen alarm, alarm sound and vibration until dismissed. The app plays
  the phone's alarm tone itself on the **alarm volume** (like an alarm clock app), so
  notification settings (a muted channel, notification volume, Do Not Disturb for
  notifications) can't silence it; the notification itself is silent.

## 2. Routines

Three tabs that share one engine: every item is a reminder with a schedule, an
optional deadline and optional nagging.

**The rule for every item:**
- **No deadline:** just a reminder. Daily and repeated items remind once at their
  time; a to-do reminds once a day (at its start time) until done.
- **With a deadline:** you choose whether it nags. Nagging always speeds up with
  half-life toward the deadline (see 2.4). At the deadline an unfinished item is
  marked **missed** and nagging stops.

### 2.1 Daily routine
- Things done every day at a set time: morning routine 7:00, leave for office 8:45,
  office time 9:30.
- Comes back every day, whether or not it was done the day before.
- Can be limited to certain weekdays (e.g. Mon–Fri).
- Optional **deadline** as time after the start: +30 min, +2 h, +2 days. Without a
  deadline the occurrence runs to midnight.
- Added (or re-enabled) after its time today: today's occurrence can still be ticked but
  never nags, and if left unticked it is dropped rather than counted as missed.

### 2.2 Repeated
Recurring (regen) on any pattern other than "every day":
- every chosen weekday(s) (every Thursday; Mon + Thu)
- every N days or every N weeks (every 7 days, every 30 days)
- monthly by date (the 15th) or by weekday (3rd Wednesday, last Friday)
- yearly
- optional end: on a date or after N times

Same time, deadline and nag settings as a daily routine.

### 2.3 To-do (general)
- A start date/time and an optional deadline (a date/time, picked as +t after the start).
- A one-off on a specific day ("next Thursday") is a to-do with that start date.
- If the deadline passes and it is not done: one "missed" alert, reminders stop, the
  task stays in the list marked overdue.
- **Regen after done (optional):** when ticked, it comes back N days after the day it
  was ticked (e.g. "change toothbrush", 90 days), at the same time of day and with the
  same deadline span. Ticking shows **Undo** for a few seconds; undoing withdraws the
  next round.

### 2.4 Nagging and half-life
- Only with a deadline and nagging switched on.
- Each item picks a first reminder interval (e.g. every 4 h).
- After each half-life period, reminders come **x times more often**. x defaults to
  **2** and is editable.
  Example: every 4 h, half-life 1 day, x = 2 → 4 h → 2 h → 1 h → 30 min → 15 min.
- Half-life is **auto** by default: picked so the fastest rate arrives at the deadline.
  It can be set to a custom period instead.
- It keeps speeding up until the **minimum interval**: default **15 min** for to-dos,
  **5 min** for routines, editable, never below **5 min**.
- **Snooze** delays the next reminder but does **not** reset the speed-up.
- Each item chooses **notification** (default; follows the phone's notification sound
  settings) or **ringing alarm**: the app plays the alarm tone on the alarm volume for 1
  minute each time it fires, stopped early by Done, Snooze or opening the reminder.
- Every occurrence of a daily or repeated item records **done** or **missed**.

## 3. Promises

Daily commitments that feed goals.

- A promise is "I will do *something* for *a duration* today", optionally linked to a
  goal. Example: "1 h XGBoost model building → goal: ML".
- **Morning reminder** (default 08:00, Settings → Promises): make today's promises. It
  nags (deadline +3 h) until a promise for today is added or its notification's Done is
  tapped; it can be a notification or ring like an alarm. It isn't shown in the Promises
  tab. Tick the kept promises in the evening; there is no evening reminder (removed in
  schema 6), but a daily routine such as "Tick today's promises, 21:30" does the job.
- Ticking asks "Did you do the full 1 h?": **Yes** adds the promised time to its goal;
  **Enter actual time** adds what was really done (promised 1 h, did 40 min → 40 min
  counts). The actual time can be changed later and the goal recalculates.
- A promise not ticked by the end of its day counts as **broken** and adds nothing.
- Promises without a goal are allowed. Several promises for the same goal on one day
  are allowed.
- The app tracks kept vs broken promises.
- The Promises tab shows today (and days ahead for planning); past days are hidden.
  Promises on days ahead can be added, edited and deleted but not ticked yet.
  Each goal's ⋮ menu has **Finished promises**: the promises kept for that goal, newest
  first, with the time each added.
  Kept promises without a goal are listed under **Miscellaneous** at the end of the Goals
  tab.

## 4. Goals

Long-term targets measured in **time (hours)**.

- Fields: name, target hours, start date (can be in the past), and a length given
  either as **X days** or as an **end date** (the app derives the other). A goal that
  ended over two months ago can't be saved (it would be deleted at once; see below).
- Shown for each goal (example: 365-day goal, target 100 h, 1 h done, day 20):

  | Stat | Formula | Example |
  |---|---|---|
  | Time passed | elapsed days / total days (today counts) | 20 / 365 = 5.5% |
  | Progress | done hours / target | 1 / 100 = 1% |
  | Days left | total − elapsed | 345 |
  | Projected | done / elapsed × total, as % of target | 18.25 h → 18% |
  | Needed pace | (target − done) / days left | 0.29 h/day |

## Clean-up and backup
- A goal and all its promises are **deleted permanently two months after the goal's last
  day** (checked at least every midnight). An ended goal's card shows the date.
- **Settings → Backup → Export data** saves everything (routines with their history,
  promises, goals, location alarms) as one readable JSON file wherever you choose, e.g.
  Downloads.
- **Import data** restores such a file, replacing what is in the app. The file is checked
  in full before anything changes, so a wrong or damaged file leaves the data as it was.
  Restored location alarms don't ring until you next arrive.
- Backups made before the evening review was removed still import; its rows are skipped.

## Privacy and storage
- All data lives in the app's private storage on the phone (SQLite). Live location is
  never stored; only when a location alarm rang.
- The release app has no internet permission, so nothing can leave the phone.
- Android's Google backup stays on, so data survives a reinstall or a new phone.
- Reminder and alarm notifications are marked private, so a locked phone hides their
  text (on some phones this also needs the system setting that hides sensitive
  notification content).
- The app shows over the lock screen only while a location alarm rings; otherwise a
  locked phone never shows Nudge's content. Ringing routines use sound, not a
  full-screen view.

## Editors
- A field's error shows after a failed Save and clears as soon as the field is fixed.
- Back with unsaved changes asks "Discard changes?".

## 5. Manual
- A fifth bottom tab, **Manual**, explains the app with worked examples. It starts with
  **Start here** (what each tab is for, and the permissions to allow).
- The first run after install opens on the Manual tab; later launches open on Routines.
  An update of an existing install is not a first run.

## Settings
- Morning reminder time, style and on/off.
- Permissions, backup (export and import).
- Week starts on Monday.

## Out of scope (for now)
- iOS.
- Focus audit (dropped).
- Picking a location on a map; sync between phones.
