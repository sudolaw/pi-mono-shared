import 'package:flutter/services.dart';

const _channel = MethodChannel('nudge/lock_screen');

/// Lets the app show over the lock screen (while an alarm rings) or not. See
/// MainActivity.kt. A no-op where the channel does not exist (tests).
Future<void> setAllowedOnLockScreen(bool allowed) async {
  try {
    await _channel.invokeMethod<void>('setAllowed', allowed);
  } on MissingPluginException {
    // Not on Android.
  }
}
