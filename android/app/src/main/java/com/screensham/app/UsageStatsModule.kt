package com.screensham.app

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream

class UsageStatsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        // Give WatchdogService a reference to the ReactContext so it can
        // emit DeviceEventEmitter events back to JS when it triggers.
        WatchdogService.reactContext = reactContext
    }

    override fun getName(): String = "UsageStats"

    // ── Permission helpers ────────────────────────────────────────────────────

    private fun checkPermission(): Boolean {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactContext.packageName,
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    @ReactMethod
    fun hasUsagePermission(promise: Promise) {
        try { promise.resolve(checkPermission()) }
        catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    @ReactMethod
    fun openUsageSettings(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            val runnable = Runnable {
                try {
                    val opened = PermissionHelper.openUsageSettings(reactContext)
                    if (opened) promise.resolve(true)
                    else promise.reject("ERROR", "Could not open usage settings.")
                } catch (e: Exception) {
                    promise.reject("ERROR", e.message)
                }
            }
            if (activity != null) {
                activity.runOnUiThread(runnable)
            } else {
                mainHandler.post(runnable)
            }
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        try {
            val works = PermissionHelper.verifyOverlayWorks(reactContext)
            if (works) {
                BlockStatusStore.setOverlayBlockFailed(reactContext, false)
            }
            promise.resolve(works && !BlockStatusStore.hasOverlayBlockFailed(reactContext))
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /**
     * Single source of truth for whether blocking can work.
     * Includes persisted overlay failures from background block attempts.
     */
    @ReactMethod
    fun getBlockingStatus(promise: Promise) {
        try {
            val overlayWorks = PermissionHelper.verifyOverlayWorks(reactContext)
            if (overlayWorks) {
                BlockStatusStore.setOverlayBlockFailed(reactContext, false)
            }
            val overlayFailed = BlockStatusStore.hasOverlayBlockFailed(reactContext)
            val watchdogRunning = WatchdogService.isRunning()
            val usageGranted = checkPermission()

            val json = WatchdogConfigStore.getBlockedAppsJson(reactContext)
            val dailyAllowanceBase = WatchdogConfigStore.getDailyAllowance(reactContext)
            val goesOutSaturday = WatchdogConfigStore.getGoesOutSaturday(reactContext)
            val todayAllowanceMinutes = UsageStatsHelper.getTodayAllowanceMinutes(
                dailyAllowanceBase, goesOutSaturday,
            )
            val blockedApps = Arguments.createArray()
            var anyOverLimit = false
            var dailyOverLimit = false

            try {
                val obj = org.json.JSONObject(json)
                val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                val end = System.currentTimeMillis()
                val usageMs = if (usageGranted) {
                    UsageStatsHelper.computeForegroundMs(
                        usm, UsageStatsHelper.todayStartMs(), end,
                    )
                } else {
                    emptyMap()
                }

                if (usageGranted) {
                    val totalMinutes = UsageStatsHelper.circleTotalDisplayMinutes(
                        usageMs, reactContext.packageName,
                    )
                    dailyOverLimit = totalMinutes >= todayAllowanceMinutes
                    if (dailyOverLimit) anyOverLimit = true
                }

                for (key in obj.keys()) {
                    val limitMinutes = obj.getInt(key)
                    if (limitMinutes <= 0) continue
                    val usedMs = usageMs[key] ?: 0L
                    val usedMinutes = UsageStatsHelper.msToDisplayMinutes(usedMs)
                    val perAppOver = usedMs >= limitMinutes * 60_000L
                    val overLimit = perAppOver || dailyOverLimit
                    if (overLimit) anyOverLimit = true

                    val entry = Arguments.createMap().apply {
                        putString("packageName", key)
                        putInt("limitMinutes", limitMinutes)
                        putInt("usageMinutes", usedMinutes)
                        putBoolean("overLimit", overLimit)
                        putBoolean("perAppOverLimit", perAppOver)
                    }
                    blockedApps.pushMap(entry)
                }
            } catch (_: Exception) { }

            val needsOverlay = !overlayWorks || overlayFailed

            val result = Arguments.createMap().apply {
                putBoolean("usageGranted", usageGranted)
                putBoolean("overlayWorks", overlayWorks)
                putBoolean("overlayBlockFailed", overlayFailed)
                putBoolean("watchdogRunning", watchdogRunning)
                putBoolean("needsOverlaySetup", needsOverlay)
                putBoolean("anyOverLimit", anyOverLimit)
                putBoolean("dailyOverLimit", dailyOverLimit)
                putInt("todayAllowanceMinutes", todayAllowanceMinutes)
                putArray("blockedApps", blockedApps)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            val runnable = Runnable {
                try {
                    val opened = PermissionHelper.openOverlaySettings(reactContext)
                    if (opened) promise.resolve(true)
                    else promise.reject("ERROR", "Could not open permission settings on this device.")
                } catch (e: Exception) {
                    promise.reject("ERROR", e.message)
                }
            }
            if (activity != null) {
                activity.runOnUiThread(runnable)
            } else {
                mainHandler.post(runnable)
            }
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    @ReactMethod
    fun hasNotificationPermission(promise: Promise) {
        try {
            promise.resolve(PermissionHelper.hasNotificationPermission(reactContext))
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val opened = PermissionHelper.openNotificationSettings(reactContext)
            if (opened) promise.resolve(true)
            else promise.reject("ERROR", "Could not open notification settings.")
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())

    @ReactMethod
    fun getDeviceManufacturer(promise: Promise) {
        try {
            promise.resolve(Build.MANUFACTURER.lowercase())
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    // ── Today's usage ─────────────────────────────────────────────────────────

    @ReactMethod
    fun getTodayUsageForPackage(packageName: String, promise: Promise) {
        try {
            if (!checkPermission()) {
                promise.reject("NO_PERMISSION", "Usage Access permission not granted.")
                return
            }
            val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val end = System.currentTimeMillis()
            val usageMs = UsageStatsHelper.computeForegroundMs(usm, UsageStatsHelper.todayStartMs(), end)
            val ms = usageMs[packageName] ?: 0L
            promise.resolve(UsageStatsHelper.msToDisplayMinutes(ms))
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    // ── Foreground app detection ──────────────────────────────────────────────

    @ReactMethod
    fun getCurrentForegroundApp(promise: Promise) {
        try {
            if (!checkPermission()) { promise.resolve(null); return }
            val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val events = usm.queryEvents(now - 10_000L, now)
            val event = UsageEvents.Event()
            var last: String? = null
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) last = event.packageName
            }
            promise.resolve(last)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    // ── Bring ScreenSham to front ─────────────────────────────────────────────

    @ReactMethod
    fun bringToFront(promise: Promise) {
        try {
            val intent = reactContext.packageManager
                .getLaunchIntentForPackage(reactContext.packageName)
                ?.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT) }
            if (intent != null) { reactContext.startActivity(intent); promise.resolve(true) }
            else promise.reject("ERROR", "Could not build launch intent")
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    // ── All apps used today (with icons) ──────────────────────────────────────

    /**
     * Returns an array of { packageName, appName, minutes, iconBase64 }
     * for every launchable app used today, sorted by minutes descending.
     * Only apps with > 0 minutes are included. Our own app is excluded.
     */
    @ReactMethod
    fun getTodayAppUsageList(promise: Promise) {
        try {
            if (!checkPermission()) {
                promise.reject("NO_PERMISSION", "Usage Access permission not granted.")
                return
            }

            val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val pm  = reactContext.packageManager
            val end = System.currentTimeMillis()
            val usageMs = UsageStatsHelper.computeForegroundMs(usm, UsageStatsHelper.todayStartMs(), end)

            val result = Arguments.createArray()

            usageMs.entries
                .asSequence()
                .map { (pkg, ms) -> pkg to UsageStatsHelper.msToDisplayMinutes(ms) }
                .filter { (pkg, mins) ->
                    mins > 0 && pkg != reactContext.packageName
                }
                .sortedByDescending { it.second }
                .forEach { (pkg, mins) ->
                    val map = Arguments.createMap()
                    map.putString("packageName", pkg)
                    map.putInt("minutes", mins)

                    val appName = try {
                        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                    } catch (_: Exception) { pkg }
                    map.putString("appName", appName)

                    map.putString("iconBase64", getAppIconBase64(pkg))
                    result.pushMap(map)
                }

            promise.resolve(result)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /**
     * Returns every launchable app installed on the device, sorted A–Z.
     * { packageName, appName, iconBase64 }
     */
    @ReactMethod
    fun getInstalledAppsForBlocking(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val activities = pm.queryIntentActivities(intent, 0)
            val seen = HashSet<String>()
            val items = mutableListOf<Pair<String, String>>()

            for (info in activities) {
                val pkg = info.activityInfo?.packageName ?: continue
                if (pkg == reactContext.packageName) continue
                if (!seen.add(pkg)) continue
                val label = try {
                    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                } catch (_: Exception) { pkg }
                items.add(pkg to label)
            }

            items.sortBy { it.second.lowercase() }

            val result = Arguments.createArray()
            for ((pkg, label) in items) {
                val map = Arguments.createMap()
                map.putString("packageName", pkg)
                map.putString("appName", label)
                map.putString("iconBase64", getAppIconBase64(pkg))
                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    @ReactMethod
    fun getAppLabel(packageName: String, promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val label = try {
                pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
            } catch (_: Exception) { packageName }
            promise.resolve(label)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** Renders the app icon drawable to a 96x96 PNG and encodes it as base64. */
    private fun getAppIconBase64(packageName: String): String? {
        return try {
            val drawable = reactContext.packageManager.getApplicationIcon(packageName)
            val size = 96
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
            bitmap.recycle()
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) { null }
    }

    // ── Native ForegroundService watchdog ─────────────────────────────────────

    /**
     * Starts WatchdogService — a native ForegroundService that keeps polling
     * even when the JS runtime is suspended in the background.
     */
    @ReactMethod
    fun startNativeWatchdog(
        blockedAppsJson: String,
        dailyAllowanceMinutes: Int,
        goesOutSaturday: Boolean,
        promise: Promise,
    ) {
        try {
            if (!checkPermission()) {
                promise.reject("NO_PERMISSION", "Grant Usage Access before starting watchdog.")
                return
            }
            WatchdogStarter.start(
                reactContext,
                blockedAppsJson,
                dailyAllowanceMinutes,
                goesOutSaturday,
            )
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    @ReactMethod
    fun updateWatchdogAllowance(
        dailyAllowanceMinutes: Int,
        goesOutSaturday: Boolean,
        promise: Promise,
    ) {
        try {
            WatchdogService.syncAllowanceConfig(
                reactContext,
                dailyAllowanceMinutes,
                goesOutSaturday,
            )
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** Stops the WatchdogService. */
    @ReactMethod
    fun stopNativeWatchdog(promise: Promise) {
        try {
            WatchdogStarter.stop(reactContext)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** Sync user profile + roast templates for native background notifications. */
    @ReactMethod
    fun syncRoastConfig(
        name: String,
        goal: String,
        templatesJson: String,
        promise: Promise,
    ) {
        try {
            RoastConfigStore.saveProfile(reactContext, name, goal)
            RoastConfigStore.saveTemplatesJson(reactContext, templatesJson)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** True while the native foreground watchdog service is running. */
    @ReactMethod
    fun isWatchdogRunning(promise: Promise) {
        try {
            promise.resolve(WatchdogService.isRunning())
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** Opens another app by package name (e.g. return to Instagram after unlock). */
    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val pm = reactContext.packageManager

            var intent = pm.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            // Fallback when getLaunchIntentForPackage returns null (Android 11+ visibility)
            if (intent == null) {
                intent = Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_LAUNCHER)
                    setPackage(packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                if (intent.resolveActivity(pm) == null) {
                    promise.reject(
                        "NOT_INSTALLED",
                        "App not installed or not launchable: $packageName",
                    )
                    return
                }
            }

            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /**
     * Grants a temporary bypass so the user can use the nemesis app after
     * completing the typing challenge without being blocked again immediately.
     */
    @ReactMethod
    fun grantSessionBypass(packageName: String, promise: Promise) {
        try {
            WatchdogService.grantSessionBypass(packageName)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** Returns true once if the watchdog requested the friction screen. */
    @ReactMethod
    fun consumePendingFriction(promise: Promise) {
        try {
            promise.resolve(WatchdogService.consumePendingFriction())
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** Re-arm the watchdog after the user dismisses friction without unlocking. */
    @ReactMethod
    fun resetBlockState(promise: Promise) {
        try {
            WatchdogService.resetBlockState()
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** Package that triggered the most recent block. */
    @ReactMethod
    fun getLastBlockedPackage(promise: Promise) {
        try {
            promise.resolve(WatchdogService.lastBlockedPackage)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }

    /** Closes the native FrictionLockActivity overlay after successful unlock. */
    @ReactMethod
    fun finishFrictionLock(promise: Promise) {
        try {
            FrictionLockActivity.finishIfOpen()
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("ERROR", e.message) }
    }
}
