package com.screensham.app

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

class UsageStatsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageStats"

    // ── Check if Usage Access permission is granted ───────────────────────────
    // PACKAGE_USAGE_STATS is an AppOps permission — it cannot be requested
    // at runtime like a normal permission. The user must enable it manually
    // in Settings → Apps → Special App Access → Usage Access.
    @ReactMethod
    fun hasUsagePermission(promise: Promise) {
        try {
            val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName,
            )
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    // ── Open the Usage Access settings screen ─────────────────────────────────
    // Call this when hasUsagePermission() returns false.
    @ReactMethod
    fun openUsageSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    // ── Get foreground minutes for a specific package today ───────────────────
    // Queries UsageStatsManager for the interval from midnight → now.
    // Returns total foreground minutes as an Int. Returns 0 if the app
    // has not been used today or is not installed.
    @ReactMethod
    fun getTodayUsageForPackage(packageName: String, promise: Promise) {
        try {
            // Verify permission before querying
            val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName,
            )
            if (mode != AppOpsManager.MODE_ALLOWED) {
                promise.reject("NO_PERMISSION", "Usage Access permission not granted.")
                return
            }

            val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE)
                    as UsageStatsManager

            // Build time range: midnight today → now
            val calendar = Calendar.getInstance()
            val endTime = calendar.timeInMillis
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startTime = calendar.timeInMillis

            val stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime,
            )

            val appStats = stats.firstOrNull { it.packageName == packageName }
            val totalMs = appStats?.totalTimeInForeground ?: 0L
            val totalMinutes = (totalMs / 1000 / 60).toInt()

            promise.resolve(totalMinutes)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
