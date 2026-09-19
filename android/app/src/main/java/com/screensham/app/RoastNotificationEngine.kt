package com.screensham.app

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import androidx.core.app.NotificationCompat
import java.util.Calendar
import kotlin.math.max
import kotlin.random.Random

/**
 * Context-aware roast notifications from WatchdogService.
 *
 * Production triggers (see [RoastNotificationConfig]):
 * - Daily usage every 15 min (15, 30, 45…)
 * - Session 30 min without leaving
 * - Opens 5 / 8, rapid 3 in 10 min
 * - Early morning scroll before 7 AM
 * - 10 min cooldown between roasts (desynced from usage so other triggers can fire)
 */
object RoastNotificationEngine {

    const val CHANNEL_ID = "screensham_roasts"
    private const val NOTIFICATION_ID_BASE = 2100

    private data class AppDayState(
        var openCount: Int = 0,
        val openTimestampsMs: MutableList<Long> = mutableListOf(),
        var sessionStartMs: Long = 0L,
        val firedTriggers: MutableSet<String> = mutableSetOf(),
    )

    private data class MessageContext(
        val minutes: Long = 0,
        val count: Int = 0,
        val windowMinutes: Int = 0,
    )

    private var dayStartMs = 0L
    private var lastRoastAtMs = 0L
    private var roastNotificationCounter = 0
    private val appStates = HashMap<String, AppDayState>()
    private var lastTrackedForeground = ""

    fun resetDayStateIfNeeded(now: Long) {
        val today = UsageStatsHelper.todayStartMs()
        if (today != dayStartMs) {
            dayStartMs = today
            appStates.clear()
            lastTrackedForeground = ""
            lastRoastAtMs = 0L
        }
    }

    /** Call when foreground app changes — tracks opens, sessions, rapid reopens. */
    fun onForegroundChanged(
        context: Context,
        newForeground: String,
        screenshamPkg: String,
        now: Long,
    ) {
        resetDayStateIfNeeded(now)
        if (newForeground.isEmpty() || newForeground == screenshamPkg) return
        if (newForeground == lastTrackedForeground) return

        lastTrackedForeground = newForeground

        val state = appStates.getOrPut(newForeground) { AppDayState() }
        state.openCount++
        state.openTimestampsMs.add(now)
        state.sessionStartMs = now
        pruneOldOpens(state, now)

        if (!RoastConfigStore.hasProfile(context)) return
        val blockedApps = parseBlockedAppsMap(context)
        if (!isRoastTarget(context, newForeground, blockedApps)) return

        for (threshold in RoastNotificationConfig.openCountThresholds) {
            maybeFire(
                context = context,
                packageName = newForeground,
                triggerKey = "opens_$threshold",
                triggerType = RoastConfigStore.TriggerType.OPENS,
                condition = state.openCount >= threshold,
                msg = MessageContext(count = state.openCount),
            )
        }

        val rapidCount = state.openTimestampsMs.size
        if (rapidCount >= RoastNotificationConfig.rapidOpenCount) {
            val windowMin = (RoastNotificationConfig.rapidWindowMs / 60_000L).toInt()
            maybeFire(
                context = context,
                packageName = newForeground,
                triggerKey = "rapid",
                triggerType = RoastConfigStore.TriggerType.RAPID,
                condition = true,
                msg = MessageContext(count = rapidCount, windowMinutes = max(1, windowMin)),
            )
        }
    }

    fun evaluate(
        context: Context,
        now: Long,
        foreground: String,
        activePackages: Set<String>,
        usageMs: Map<String, Long>,
        blockedApps: Map<String, Int>,
        screenshamPkg: String,
    ) {
        resetDayStateIfNeeded(now)
        if (!RoastConfigStore.hasProfile(context)) return

        val candidates = LinkedHashSet<String>()
        if (foreground.isNotEmpty() && foreground != screenshamPkg) {
            candidates.add(foreground)
        }
        for (pkg in activePackages) {
            if (pkg != screenshamPkg) candidates.add(pkg)
        }

        for (pkg in candidates) {
            if (!isRoastTarget(context, pkg, blockedApps)) continue

            val usedMinutes = (usageMs[pkg] ?: 0L) / 60_000L
            for (threshold in RoastNotificationConfig.usageThresholdsMinutes) {
                maybeFire(
                    context = context,
                    packageName = pkg,
                    triggerKey = "usage_$threshold",
                    triggerType = RoastConfigStore.TriggerType.USAGE,
                    condition = usedMinutes >= threshold,
                    msg = MessageContext(minutes = usedMinutes),
                )
            }

            val state = appStates.getOrPut(pkg) { AppDayState() }
            if (state.sessionStartMs <= 0L) {
                state.sessionStartMs = now
            }
            val sessionMinutes = (now - state.sessionStartMs) / 60_000L
            for (threshold in RoastNotificationConfig.sessionThresholdsMinutes) {
                maybeFire(
                    context = context,
                    packageName = pkg,
                    triggerKey = "session_$threshold",
                    triggerType = RoastConfigStore.TriggerType.SESSION,
                    condition = sessionMinutes >= threshold,
                    msg = MessageContext(minutes = sessionMinutes),
                )
            }

            if (isEarlyMorning(now)) {
                maybeFire(
                    context = context,
                    packageName = pkg,
                    triggerKey = "early_morning",
                    triggerType = RoastConfigStore.TriggerType.EARLY_MORNING,
                    condition = true,
                )
            }
        }
    }

    private fun isEarlyMorning(now: Long): Boolean {
        val hour = Calendar.getInstance().apply { timeInMillis = now }
            .get(Calendar.HOUR_OF_DAY)
        return hour < RoastNotificationConfig.earlyMorningEndHour
    }

    fun createChannel(context: Context) {
        val channel = android.app.NotificationChannel(
            CHANNEL_ID,
            "Roast Notifications",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Funny nudges when you spend too long on apps"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 200, 100, 200)
        }
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    private fun pruneOldOpens(state: AppDayState, now: Long) {
        val cutoff = now - RoastNotificationConfig.rapidWindowMs
        state.openTimestampsMs.removeAll { it < cutoff }
    }

    private fun isRoastTarget(
        context: Context,
        packageName: String,
        blockedApps: Map<String, Int>,
    ): Boolean {
        if (blockedApps.containsKey(packageName)) return true
        return isScrollStyleApp(context, packageName)
    }

    private fun isScrollStyleApp(context: Context, packageName: String): Boolean {
        val pkg = packageName.lowercase()
        val pkgHints = RoastConfigStore.getScrollPackageHints(context)
        val labelHints = RoastConfigStore.getScrollLabelHints(context)
        return pkgHints.any { pkg.contains(it) } ||
            labelHints.any { pkg.contains(it) }
    }

    private fun maybeFire(
        context: Context,
        packageName: String,
        triggerKey: String,
        triggerType: RoastConfigStore.TriggerType,
        condition: Boolean,
        msg: MessageContext = MessageContext(),
    ) {
        if (!condition) return

        val state = appStates.getOrPut(packageName) { AppDayState() }
        if (triggerKey in state.firedTriggers) return

        val now = System.currentTimeMillis()
        if (lastRoastAtMs > 0 && now - lastRoastAtMs < RoastNotificationConfig.cooldownMs) {
            return
        }

        state.firedTriggers.add(triggerKey)
        lastRoastAtMs = now

        val appLabel = getAppLabel(context, packageName)
        val blockedApps = parseBlockedAppsMap(context)
        val isBlocked = blockedApps.containsKey(packageName)
        val body = pickMessage(context, isBlocked, appLabel, triggerType, msg)
        showNotification(context, body)
    }

    private fun getAppLabel(context: Context, packageName: String): String {
        return try {
            context.packageManager.getApplicationLabel(
                context.packageManager.getApplicationInfo(packageName, 0),
            ).toString()
        } catch (_: Exception) {
            packageName
        }
    }

    private fun parseBlockedAppsMap(context: Context): Map<String, Int> {
        val map = HashMap<String, Int>()
        try {
            val obj = org.json.JSONObject(WatchdogConfigStore.getBlockedAppsJson(context))
            for (key in obj.keys()) {
                val mins = obj.getInt(key)
                if (mins > 0) map[key] = mins
            }
        } catch (_: Exception) { }
        return map
    }

    private fun pickMessage(
        context: Context,
        isBlocked: Boolean,
        appLabel: String,
        triggerType: RoastConfigStore.TriggerType,
        msg: MessageContext,
    ): String {
        val name = RoastConfigStore.getName(context).ifEmpty { "you" }
        val goal = RoastConfigStore.getGoal(context).ifEmpty { "your goal" }
        val templates = if (isBlocked) {
            RoastConfigStore.getBlockedTemplates(context)
        } else {
            RoastConfigStore.getUnblockedTemplates(context)
        }

        val combined = (templates.general + templates.forType(triggerType)).distinct()
        val pool = if (combined.isNotEmpty()) combined else templates.general
        var template = pool[Random.nextInt(pool.size)]
        val pipe = template.indexOf('|')
        if (pipe > 0) template = template.substring(pipe + 1)

        return template
            .replace("{name}", name)
            .replace("{goal}", goal)
            .replace("{app}", appLabel)
            .replace("{minutes}", msg.minutes.toString())
            .replace("{count}", msg.count.toString())
            .replace("{window}", msg.windowMinutes.toString())
    }

    private fun showNotification(context: Context, body: String) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pi = PendingIntent.getActivity(
            context,
            roastNotificationCounter,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val modeLabel = if (RoastNotificationConfig.TEST_MODE) " [TEST]" else ""
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("📵 ScreenSham$modeLabel")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        val id = NOTIFICATION_ID_BASE + (roastNotificationCounter++ % 100)
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(id, notification)
    }
}
