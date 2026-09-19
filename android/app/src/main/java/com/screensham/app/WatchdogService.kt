package com.screensham.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import org.json.JSONObject

/**
 * Blocks individual apps when their per-app daily limit is exceeded.
 * Config: JSON map of packageName -> limitMinutes.
 */
class WatchdogService : Service() {

    companion object {
        const val NOTIFICATION_ID = 1002
        const val CHANNEL_ID      = "screensham_watchdog"
        const val BLOCK_NOTIFICATION_ID = 1003
        const val BLOCK_CHANNEL_ID      = "screensham_block"
        const val EXTRA_BLOCKED_APPS_JSON = "blocked_apps_json"
        const val EXTRA_DAILY_ALLOWANCE   = "daily_allowance_minutes"
        const val EXTRA_GOES_OUT_SATURDAY = "goes_out_saturday"
        const val EXTRA_BLOCKED_PACKAGE   = "blocked_package"
        const val EXTRA_BLOCKED_APP_LABEL = "blocked_app_label"
        const val EXTRA_SHOW_FRICTION     = "show_friction"
        const val EVENT_NAME              = "onFrictionTrigger"
        const val BLOCK_FAILED_EVENT      = "onBlockScreenFailed"

        @Volatile var reactContext: ReactApplicationContext? = null

        private val sessionBypassPackages = HashSet<String>()

        @Volatile var pendingFrictionShow: Boolean = false
        @Volatile var lastBlockedPackage: String = ""

        /**
         * Session bypass: user may continue using [packageName] only until they
         * leave the app. Next open requires the typing challenge again.
         */
        fun grantSessionBypass(packageName: String) {
            sessionBypassPackages.add(packageName)
            instance?.triggeredPackages?.remove(packageName)
            instance?.lastBlockAttemptByPackage?.remove(packageName)
            instance?.lastForeground = packageName
            FrictionLockActivity.isUnlocking = false
            FrictionLockActivity.finishIfOpen()
            BlockOverlayManager.hide()
            if (lastBlockedPackage == packageName) {
                pendingFrictionShow = false
                lastBlockedPackage = ""
            }
        }

        fun isBypassActive(packageName: String): Boolean {
            return sessionBypassPackages.contains(packageName)
        }

        fun clearSessionBypass(packageName: String) {
            sessionBypassPackages.remove(packageName)
        }

        fun resetBlockState() {
            pendingFrictionShow = false
            lastBlockedPackage = ""
            FrictionLockActivity.isUnlocking = false
            BlockOverlayManager.hide()
            sessionBypassPackages.clear()
            instance?.triggeredPackages?.clear()
            instance?.lastBlockAttemptByPackage?.clear()
        }

        /** True when [packageName] is over its limit and has no active bypass. */
        fun shouldBlockPackage(packageName: String): Boolean {
            if (packageName.isEmpty() || isBypassActive(packageName)) return false
            return instance?.isOverLimit(packageName) == true
        }

        private fun abandonFrictionIfNeeded(blockedPackage: String) {
            if (lastBlockedPackage == blockedPackage && !isBypassActive(blockedPackage)) {
                abandonFrictionRequest()
            }
        }

        fun consumePendingFriction(): Boolean {
            val pending = pendingFrictionShow
            pendingFrictionShow = false
            return pending
        }

        fun emitFrictionTrigger(packageName: String) {
            val ctx = reactContext ?: return
            val params = Arguments.createMap().apply {
                putString("packageName", packageName)
            }
            ctx.emitDeviceEvent(EVENT_NAME, params)
        }

        fun emitBlockScreenFailed() {
            val ctx = reactContext ?: return
            ctx.emitDeviceEvent(BLOCK_FAILED_EVENT, null)
        }

        fun beginFrictionRequest(packageName: String) {
            lastBlockedPackage = packageName
            pendingFrictionShow = true
        }

        fun abandonFrictionRequest() {
            pendingFrictionShow = false
            FrictionLockActivity.isUnlocking = false
        }

        fun isRunning(): Boolean = instance != null

        /** Push latest daily allowance from JS without restarting the service. */
        fun syncAllowanceConfig(context: Context, baseMinutes: Int, goesOut: Boolean) {
            WatchdogConfigStore.saveDailyAllowance(context, baseMinutes)
            WatchdogConfigStore.saveGoesOutSaturday(context, goesOut)
            instance?.reloadAllowanceConfigFromStore()
        }

        @Volatile private var instance: WatchdogService? = null
    }

    private lateinit var workerThread: HandlerThread
    private lateinit var handler: Handler

    /** packageName -> limitMinutes */
    private var blockedApps = HashMap<String, Int>()
    private var dailyAllowanceBase = WatchdogConfigStore.DEFAULT_DAILY_ALLOWANCE
    private var goesOutSaturday = false
    val triggeredPackages = HashSet<String>()
    val lastBlockAttemptByPackage = HashMap<String, Long>()

    private var currentForeground = ""
    private var lastForeground    = ""
    private var lastEventQueryMs  = 0L

    override fun onCreate() {
        super.onCreate()
        instance = this
        workerThread = HandlerThread("ScreenShamWatchdog").also { it.start() }
        handler = Handler(workerThread.looper)
        createNotificationChannel()
        createBlockNotificationChannel()
        RoastNotificationEngine.createChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val fromIntent = intent?.getStringExtra(EXTRA_BLOCKED_APPS_JSON)
        val json = if (!fromIntent.isNullOrEmpty()) {
            WatchdogConfigStore.saveBlockedAppsJson(this, fromIntent)
            WatchdogConfigStore.setEnabled(this, true)
            fromIntent
        } else {
            WatchdogConfigStore.getBlockedAppsJson(this)
        }

        blockedApps = parseBlockedApps(json)

        val allowanceFromIntent = intent?.getIntExtra(EXTRA_DAILY_ALLOWANCE, -1) ?: -1
        if (allowanceFromIntent > 0) {
            WatchdogConfigStore.saveDailyAllowance(this, allowanceFromIntent)
        }
        if (intent?.hasExtra(EXTRA_GOES_OUT_SATURDAY) == true) {
            WatchdogConfigStore.saveGoesOutSaturday(
                this,
                intent.getBooleanExtra(EXTRA_GOES_OUT_SATURDAY, false),
            )
        }
        dailyAllowanceBase = WatchdogConfigStore.getDailyAllowance(this)
        goesOutSaturday = WatchdogConfigStore.getGoesOutSaturday(this)

        if (blockedApps.isEmpty() && !RoastConfigStore.hasProfile(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        triggeredPackages.clear()
        lastBlockAttemptByPackage.clear()
        currentForeground = ""
        lastForeground    = ""
        lastEventQueryMs  = System.currentTimeMillis() - 60_000L

        handler.removeCallbacksAndMessages(null)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }

        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        updateForegroundState(usm, System.currentTimeMillis())
        schedulePoll()
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // User swiped ScreenSham from recents — restart watchdog immediately.
        if (WatchdogConfigStore.isEnabled(this)) {
            WatchdogStarter.start(this)
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        workerThread.quitSafely()
        if (instance === this) instance = null
        super.onDestroy()

        // Belt-and-suspenders restart if the service was killed unexpectedly.
        if (WatchdogConfigStore.isEnabled(applicationContext)) {
            WatchdogStarter.start(applicationContext)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun parseBlockedApps(json: String): HashMap<String, Int> {
        val map = HashMap<String, Int>()
        try {
            val obj = JSONObject(json)
            for (key in obj.keys()) {
                val mins = obj.getInt(key)
                if (mins > 0) map[key] = mins
            }
        } catch (_: Exception) { }
        return map
    }

    private fun reloadAllowanceConfigFromStore() {
        dailyAllowanceBase = WatchdogConfigStore.getDailyAllowance(this)
        goesOutSaturday = WatchdogConfigStore.getGoesOutSaturday(this)
    }

    private fun schedulePoll() {
        handler.postDelayed({ runPoll() }, 1_000L)
    }

    private fun runPoll() {
        try {
            reloadAllowanceConfigFromStore()

            val now = System.currentTimeMillis()
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            updateForegroundState(usm, now)

            val foreground = resolveForegroundPackage(usm, now)
            val activePackages = UsageStatsHelper.getActiveForegroundPackages(usm, 600_000L, now)
            val usageMs = UsageStatsHelper.computeForegroundMs(
                usm, UsageStatsHelper.todayStartMs(), now,
            )

            val resolvedForeground = when {
                foreground.isNotEmpty() -> foreground
                activePackages.size == 1 -> activePackages.first()
                else -> ""
            }
            if (resolvedForeground.isNotEmpty()) {
                RoastNotificationEngine.onForegroundChanged(
                    this, resolvedForeground, packageName, now,
                )
            }
            RoastNotificationEngine.evaluate(
                context = this,
                now = now,
                foreground = resolvedForeground,
                activePackages = activePackages,
                usageMs = usageMs,
                blockedApps = blockedApps,
                screenshamPkg = packageName,
            )

            if (blockedApps.isEmpty()) {
                if (resolvedForeground.isNotEmpty()) {
                    lastForeground = resolvedForeground
                }
                schedulePoll()
                return
            }

            val prev = lastForeground

            // Only skip blocking while ScreenSham is the actual foreground app.
            // Do NOT use activePackages here — on MIUI ScreenSham can stay "open" in
            // usage events after the user left, which prevented all blocking.
            if (foreground == packageName) {
                lastForeground = packageName
                schedulePoll()
                return
            }

            // User left ScreenSham without completing unlock — re-arm blocking
            if (prev == packageName && (foreground.isNotEmpty() || activePackages.isNotEmpty())) {
                abandonFrictionIfNeeded(lastBlockedPackage)
            }

            // User left a blocked app — clear session bypass so next open re-blocks
            if (prev.isNotEmpty() && blockedApps.containsKey(prev) && prev != foreground &&
                !activePackages.contains(prev)
            ) {
                clearSessionBypass(prev)
                triggeredPackages.remove(prev)
                lastBlockAttemptByPackage.remove(prev)

                if (foreground != packageName && !activePackages.contains(packageName)) {
                    BlockOverlayManager.hide()
                    abandonFrictionIfNeeded(prev)
                }
            }

            checkAndBlockApps(now, foreground, activePackages, usageMs)

            if (foreground.isNotEmpty()) {
                lastForeground = foreground
            } else if (activePackages.size == 1) {
                lastForeground = activePackages.first()
            }
        } catch (_: Exception) { }

        schedulePoll()
    }

    private fun resolveForegroundPackage(usm: UsageStatsManager, now: Long): String {
        // Prefer the most recent non-ScreenSham app from usage history (MIUI-safe).
        val recent = findForegroundFromHistory(usm, now - 120_000L, now)
        if (recent != null && recent != packageName) return recent

        if (currentForeground.isNotEmpty() && currentForeground != packageName) {
            return currentForeground
        }

        val active = UsageStatsHelper.getActiveForegroundPackages(usm, 600_000L, now)
            .filter { it != packageName }
        if (active.size == 1) return active.first()
        if (active.isNotEmpty()) {
            return findForegroundFromHistory(usm, now - 600_000L, now) ?: active.first()
        }

        if (currentForeground == packageName) return packageName
        return findForegroundFromHistory(usm, now - 60_000L, now) ?: ""
    }

    private fun checkAndBlockApps(
        now: Long,
        foreground: String,
        activePackages: Set<String>,
        usageMs: Map<String, Long>,
    ) {
        val globalOverLimit = isGlobalDailyOverLimit(usageMs)

        for ((pkg, limitMinutes) in blockedApps) {
            if (limitMinutes <= 0 || isBypassActive(pkg)) continue

            val isActive = pkg == foreground || activePackages.contains(pkg)
            if (!isActive) continue

            val usedMs = usageMs[pkg] ?: 0L
            val perAppOver = usedMs >= limitMinutes * 60_000L
            if (!perAppOver && !globalOverLimit) continue

            abandonFrictionIfNeeded(pkg)

            val lastAttempt = lastBlockAttemptByPackage[pkg] ?: 0L
            val overlayVisible = BlockOverlayManager.isShowingPackage(pkg)
            val minInterval = if (overlayVisible) 2_000L else 300L
            if (now - lastAttempt >= minInterval) {
                triggeredPackages.add(pkg)
                lastBlockAttemptByPackage[pkg] = now
                triggerBlock(pkg, globalOverLimit && !perAppOver)
            }
        }
    }

    private fun updateForegroundState(usm: UsageStatsManager, now: Long) {
        val from = lastEventQueryMs
        lastEventQueryMs = now
        if (from >= now) return

        val events = usm.queryEvents(from, now)
        val event = UsageEvents.Event()

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            when (event.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED,
                UsageEvents.Event.MOVE_TO_FOREGROUND -> currentForeground = pkg
                UsageEvents.Event.ACTIVITY_PAUSED,
                UsageEvents.Event.ACTIVITY_STOPPED,
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    if (pkg == currentForeground) currentForeground = ""
                }
            }
        }

        if (currentForeground.isEmpty()) {
            currentForeground = resolveForegroundPackage(usm, now)
        }
    }

    private fun findForegroundFromHistory(
        usm: UsageStatsManager,
        startMs: Long,
        endMs: Long,
    ): String? {
        val events = usm.queryEvents(startMs, endMs)
        val event = UsageEvents.Event()
        var lastPkg: String? = null
        var lastTime = 0L
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
                event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
            ) {
                if (event.timeStamp >= lastTime) {
                    lastTime = event.timeStamp
                    lastPkg = event.packageName
                }
            }
        }
        return lastPkg
    }

    private fun getTodayAllUsageMs(): Map<String, Long> {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        return UsageStatsHelper.computeForegroundMs(
            usm, UsageStatsHelper.todayStartMs(), System.currentTimeMillis(),
        )
    }

    private fun getTodayAllowanceMinutes(): Int {
        return UsageStatsHelper.getTodayAllowanceMinutes(
            dailyAllowanceBase, goesOutSaturday,
        )
    }

    private fun isGlobalDailyOverLimit(usageMs: Map<String, Long>): Boolean {
        val totalMinutes = UsageStatsHelper.circleTotalDisplayMinutes(usageMs, packageName)
        return totalMinutes >= getTodayAllowanceMinutes()
    }

    private fun getTodayUsageMs(packageName: String): Long {
        return getTodayAllUsageMs()[packageName] ?: 0L
    }

    private fun getAppLabel(packageName: String): String {
        return try {
            packageManager.getApplicationLabel(
                packageManager.getApplicationInfo(packageName, 0),
            ).toString()
        } catch (_: Exception) { packageName }
    }

    private fun isOverLimit(packageName: String): Boolean {
        val limitMinutes = blockedApps[packageName] ?: return false
        if (limitMinutes <= 0) return false
        val usageMs = getTodayAllUsageMs()
        val usedMs = usageMs[packageName] ?: 0L
        val perAppOver = usedMs >= limitMinutes * 60_000L
        return perAppOver || isGlobalDailyOverLimit(usageMs)
    }

    private fun triggerBlock(blockedPackage: String, dailyLimitReached: Boolean = false) {
        lastBlockedPackage = blockedPackage
        val appLabel = getAppLabel(blockedPackage)

        // Primary: overlay on top of blocked app (needs "Display over other apps")
        val overlayShown = BlockOverlayManager.show(
            this, blockedPackage, appLabel, dailyLimitReached,
        )

        if (!overlayShown) {
            BlockStatusStore.setOverlayBlockFailed(this, true)
            emitBlockScreenFailed()
            val lockIntent = Intent(this, FrictionLockActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP,
                )
                putExtra(EXTRA_BLOCKED_PACKAGE, blockedPackage)
                putExtra(EXTRA_BLOCKED_APP_LABEL, appLabel)
            }
            showBlockNotification(lockIntent)
            val launchPi = PendingIntent.getActivity(
                this,
                2,
                lockIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            try {
                launchPi.send()
            } catch (_: Exception) {
                try {
                    startActivity(lockIntent)
                } catch (_: Exception) { }
            }
        } else {
            // Cancel stale notification when overlay is active
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .cancel(BLOCK_NOTIFICATION_ID)
        }
    }

    private fun showBlockNotification(lockIntent: Intent) {
        val fullScreenPi = PendingIntent.getActivity(
            this, 2, lockIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, BLOCK_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("App limit reached")
            .setContentText("Tap to unlock")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .setAutoCancel(true)
            .build()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(BLOCK_NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Screen Time Protection", NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "ScreenSham is protecting your focus"
            setShowBadge(false)
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    private fun createBlockNotificationChannel() {
        val channel = NotificationChannel(
            BLOCK_CHANNEL_ID, "Screen Time Block", NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Shows the lock screen when an app limit is reached"
            setShowBadge(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE)
        val count = blockedApps.size
        val statusText = if (count > 0) {
            "Watching $count blocked app${if (count == 1) "" else "s"}"
        } else {
            "Roast notifications active"
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("📵 ScreenSham Active")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pi)
            .build()
    }
}
