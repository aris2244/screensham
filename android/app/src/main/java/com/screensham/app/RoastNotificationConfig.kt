package com.screensham.app

/**
 * Roast notification thresholds.
 * [TEST_MODE] = false for production.
 */
object RoastNotificationConfig {

    const val TEST_MODE = false

    /** Min time between any two roast notifications. */
    val cooldownMs: Long
        get() = if (TEST_MODE) 30_000L else 10 * 60_000L

    /** Daily screen-time per app — one roast at each step (every 15 min). */
    val usageThresholdsMinutes: List<Int>
        get() = if (TEST_MODE) {
            listOf(1, 2, 3)
        } else {
            (15..120 step 15).toList()
        }

    /** Total opens today → one roast at each threshold. */
    val openCountThresholds: List<Int>
        get() = if (TEST_MODE) listOf(3, 5) else listOf(5, 8)

    val rapidOpenCount: Int get() = 3

    val rapidWindowMs: Long
        get() = if (TEST_MODE) 3 * 60_000L else 10 * 60_000L

    /** Continuous session without leaving the app. */
    val sessionThresholdsMinutes: List<Int>
        get() = if (TEST_MODE) listOf(1, 2) else listOf(30)

    /** Local hour < this while on a roast app → early-morning roast (once/app/day). */
    val earlyMorningEndHour: Int
        get() = if (TEST_MODE) 12 else 7
}
