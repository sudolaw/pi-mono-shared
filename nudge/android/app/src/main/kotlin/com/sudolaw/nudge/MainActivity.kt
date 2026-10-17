package com.sudolaw.nudge

import android.content.Intent
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * The app may show over the lock screen only while a location alarm rings: it
 * is allowed when a location-alarm notification opens the app (payload
 * `loc:<id>`) and switched off from Dart once the alarm is stopped. Otherwise a
 * locked phone left on Nudge would show routines and promises without unlocking.
 */
class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        allowIfRinging(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        allowIfRinging(intent)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "nudge/lock_screen")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "setAllowed" -> {
                        setAllowedOnLockScreen(call.arguments as Boolean)
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun allowIfRinging(intent: Intent?) {
        if (intent?.getStringExtra("payload")?.startsWith("loc:") == true) {
            setAllowedOnLockScreen(true)
        }
    }

    private fun setAllowedOnLockScreen(allowed: Boolean) {
        setShowWhenLocked(allowed)
        setTurnScreenOn(allowed)
    }
}
