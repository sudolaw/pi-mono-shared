package com.sudolaw.alarm_tone;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/** Registered in every Flutter engine of the app; all share one {@link Tone}. */
public class AlarmTonePlugin implements FlutterPlugin, MethodChannel.MethodCallHandler {
  private MethodChannel channel;
  private Context context;

  @Override
  public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
    context = binding.getApplicationContext();
    channel = new MethodChannel(binding.getBinaryMessenger(), "alarm_tone");
    channel.setMethodCallHandler(this);
  }

  @Override
  public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
    channel.setMethodCallHandler(null);
  }

  @Override
  public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
    switch (call.method) {
      case "start":
        Number timeout = call.argument("timeoutMs");
        Tone.start(context, call.argument("tag"), timeout == null ? 0 : timeout.longValue());
        result.success(null);
        break;
      case "stop":
        Tone.stop(call.argument("tag"));
        result.success(null);
        break;
      case "stopAll":
        Tone.stopAll();
        result.success(null);
        break;
      case "active":
        result.success(Tone.active());
        break;
      default:
        result.notImplemented();
    }
  }

  /** The one tone of the process: plays while any tag is active. */
  static final class Tone {
    private static final String TAG = "AlarmTone";
    private static final AudioAttributes ALARM =
        new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final Map<String, Runnable> tags = new HashMap<>();
    private static MediaPlayer player;
    private static Vibrator vibrator;

    static synchronized void start(Context context, String tag, long timeoutMs) {
      Runnable old = tags.get(tag);
      if (old != null) main.removeCallbacks(old);
      Runnable expire = () -> stop(tag);
      tags.put(tag, expire);
      if (timeoutMs > 0) main.postDelayed(expire, timeoutMs);
      if (player == null && vibrator == null) begin(context);
    }

    static synchronized void stop(String tag) {
      Runnable expire = tags.remove(tag);
      if (expire != null) main.removeCallbacks(expire);
      if (tags.isEmpty()) end();
    }

    static synchronized void stopAll() {
      for (Runnable expire : tags.values()) main.removeCallbacks(expire);
      tags.clear();
      end();
    }

    static synchronized ArrayList<String> active() {
      return new ArrayList<>(tags.keySet());
    }

    private static void begin(Context context) {
      try {
        MediaPlayer mp = new MediaPlayer();
        mp.setAudioAttributes(ALARM);
        mp.setDataSource(context, toneUri(context));
        mp.setLooping(true);
        mp.prepare();
        mp.start();
        player = mp;
      } catch (Exception e) {
        Log.w(TAG, "Could not play the alarm tone", e);
      }
      try {
        vibrator =
            Build.VERSION.SDK_INT >= 31
                ? ((VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE))
                    .getDefaultVibrator()
                : (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        vibrator.vibrate(VibrationEffect.createWaveform(new long[] {0, 800, 400}, 0), ALARM);
      } catch (Exception e) {
        Log.w(TAG, "Could not vibrate", e);
        vibrator = null;
      }
    }

    private static void end() {
      if (player != null) {
        try {
          player.stop();
        } catch (IllegalStateException ignored) {
          // Already stopped.
        }
        player.release();
        player = null;
      }
      if (vibrator != null) {
        vibrator.cancel();
        vibrator = null;
      }
    }

    /** The alarm sound chosen in the phone's settings, else any default tone. */
    private static Uri toneUri(Context context) {
      Uri uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM);
      if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
      return uri != null ? uri : Settings.System.DEFAULT_ALARM_ALERT_URI;
    }
  }
}
