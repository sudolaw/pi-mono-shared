import 'package:flutter/services.dart';

/// The phone's alarm tone, played on the alarm stream with vibration.
///
/// Process-wide: any isolate can stop a tone another one started. The tone
/// plays while at least one tag is active.
abstract final class AlarmTone {
  static const _channel = MethodChannel('alarm_tone');

  /// Starts (or keeps) the tone for [tag]. With [timeout], the tag stops by
  /// itself after that long; starting it again restarts the timeout.
  static Future<void> start(String tag, {Duration? timeout}) =>
      _channel.invokeMethod('start', {'tag': tag, 'timeoutMs': timeout?.inMilliseconds});

  static Future<void> stop(String tag) => _channel.invokeMethod('stop', {'tag': tag});

  static Future<void> stopAll() => _channel.invokeMethod('stopAll');

  /// The tags currently keeping the tone on.
  static Future<List<String>> active() async =>
      (await _channel.invokeListMethod<String>('active')) ?? const [];
}
