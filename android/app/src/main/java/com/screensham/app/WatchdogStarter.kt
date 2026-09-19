package com.screensham.app

import android.content.Context
import android.content.Intent

object WatchdogStarter {

    fun start(
        context: Context,
        blockedAppsJson: String? = null,
        dailyAllowanceMinutes: Int? = null,
        goesOutSaturday: Boolean? = null,
    ) {
        val appContext = context.applicationContext
        val json = blockedAppsJson?.takeIf { it.isNotEmpty() }
            ?: WatchdogConfigStore.getBlockedAppsJson(appContext)

        val hasBlockedApps = json != "{}" && json.isNotEmpty()
        val hasRoastProfile = RoastConfigStore.hasProfile(appContext)
        if (!hasBlockedApps && !hasRoastProfile) return

        if (blockedAppsJson != null) {
            WatchdogConfigStore.saveBlockedAppsJson(appContext, blockedAppsJson)
        }
        if (dailyAllowanceMinutes != null) {
            WatchdogConfigStore.saveDailyAllowance(appContext, dailyAllowanceMinutes)
        }
        if (goesOutSaturday != null) {
            WatchdogConfigStore.saveGoesOutSaturday(appContext, goesOutSaturday)
        }
        WatchdogConfigStore.setEnabled(appContext, true)

        val intent = Intent(appContext, WatchdogService::class.java).apply {
            putExtra(WatchdogService.EXTRA_BLOCKED_APPS_JSON, json)
            putExtra(
                WatchdogService.EXTRA_DAILY_ALLOWANCE,
                WatchdogConfigStore.getDailyAllowance(appContext),
            )
            putExtra(
                WatchdogService.EXTRA_GOES_OUT_SATURDAY,
                WatchdogConfigStore.getGoesOutSaturday(appContext),
            )
        }
        appContext.startForegroundService(intent)
    }

    fun canStart(context: Context): Boolean {
        return PermissionHelper.verifyOverlayWorks(context.applicationContext)
    }

    fun stop(context: Context) {
        val appContext = context.applicationContext
        WatchdogConfigStore.setEnabled(appContext, false)
        appContext.stopService(Intent(appContext, WatchdogService::class.java))
    }
}
