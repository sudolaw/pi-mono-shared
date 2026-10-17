# alarm_tone

Nudge's own Android plugin. It plays the phone's alarm tone on the **alarm** audio stream,
with vibration, so notification settings (a muted channel, notification volume, a
notification sound turned off) can't silence a ringing alarm.

One player serves the whole app process, so a tone started in one isolate (the location
service, a background reminder run) can be stopped from another (the app's Stop button, a
notification action). Each caller starts and stops its own *tag* (`loc:3`, `occ:12`); the
tone plays while any tag is active.
