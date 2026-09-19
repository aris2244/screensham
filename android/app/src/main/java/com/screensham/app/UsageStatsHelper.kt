package com.screensham.app

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import java.util.Calendar
import kotlin.math.ceil

/**
 * Computes per-app foreground time from UsageEvents (more accurate and
 * up-to-date than queryUsageStats INTERVAL_DAILY, which can lag minutes).
 */
object UsageStatsHelper {

    fun todayStartMs(): Long {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    /** Milliseconds of foreground time per package between [startMs] and [endMs]. */
    fun computeForegroundMs(
        usm: UsageStatsManager,
        startMs: Long,
        endMs: Long,
    ): Map<String, Long> {
        val events = usm.queryEvents(startMs, endMs)
        val event = UsageEvents.Event()
        val foregroundSince = HashMap<String, Long>()
        val totals = HashMap<String, Long>()

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            when (event.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED,
                UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    foregroundSince[pkg] = event.timeStamp
                }
                UsageEvents.Event.ACTIVITY_PAUSED,
                UsageEvents.Event.ACTIVITY_STOPPED,
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    val since = foregroundSince.remove(pkg)
                    if (since != null && event.timeStamp > since) {
                        totals[pkg] = (totals[pkg] ?: 0L) + (event.timeStamp - since)
                    }
                }
            }
        }

        // Still in foreground at end of window
        for ((pkg, since) in foregroundSince) {
            if (endMs > since) {
                totals[pkg] = (totals[pkg] ?: 0L) + (endMs - since)
            }
        }

        return totals
    }

    /**
     * Packages with an open foreground session (RESUMED without matching PAUSED).
     * Reliable for long sessions where no new events arrive in short poll windows.
     */
    fun getActiveForegroundPackages(
        usm: UsageStatsManager,
        lookbackMs: Long = 600_000L,
        endMs: Long = System.currentTimeMillis(),
    ): Set<String> {
        val events = usm.queryEvents(endMs - lookbackMs, endMs)
        val event = UsageEvents.Event()
        val openSince = HashMap<String, Long>()

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            when (event.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED,
                UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    openSince[pkg] = event.timeStamp
                }
                UsageEvents.Event.ACTIVITY_PAUSED,
                UsageEvents.Event.ACTIVITY_STOPPED,
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    openSince.remove(pkg)
                }
            }
        }

        return openSince.keys
    }

    /** Today's allowance including Saturday bonus when applicable. */
    fun getTodayAllowanceMinutes(baseMinutes: Int, goesOutSaturday: Boolean): Int {
        val cal = Calendar.getInstance()
        val isSaturday = cal.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY
        val bonus = if (isSaturday && goesOutSaturday) 60 else 0
        return baseMinutes + bonus
    }

    /** Sum of foreground ms for all apps except [excludePackage]. */
    fun totalScreenTimeMs(usageMs: Map<String, Long>, excludePackage: String): Long {
        var total = 0L
        for ((pkg, ms) in usageMs) {
            if (pkg == excludePackage) continue
            total += ms
        }
        return total
    }

    /**
     * Matches HomeScreen circle total: sum of per-app display minutes (each rounded up).
     * Only apps with > 0 display minutes count, same as getTodayAppUsageList.
     */
    fun circleTotalDisplayMinutes(usageMs: Map<String, Long>, excludePackage: String): Int {
        var sum = 0
        for ((pkg, ms) in usageMs) {
            if (pkg == excludePackage) continue
            val mins = msToDisplayMinutes(ms)
            if (mins > 0) sum += mins
        }
        return sum
    }

    /** Rounds up so 30 s of use shows as 1 minute in the UI. */
    fun msToDisplayMinutes(ms: Long): Int {
        if (ms <= 0) return 0
        return ceil(ms / 60000.0).toInt()
    }

    /** Sum of all packages except [excludePackage], in display minutes. */
    fun totalDisplayMinutes(
        usageMs: Map<String, Long>,
        excludePackage: String,
        minMs: Long = 5_000L,
    ): Int {
        var totalMs = 0L
        for ((pkg, ms) in usageMs) {
            if (pkg == excludePackage || ms < minMs) continue
            totalMs += ms
        }
        return msToDisplayMinutes(totalMs)
    }
}
