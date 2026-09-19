package com.screensham.app

import android.content.Context

/** Persists watchdog config so blocking survives app close / reboot. */
object WatchdogConfigStore {

    const val DEFAULT_DAILY_ALLOWANCE = 120

    private const val PREFS = "screensham_watchdog"
    private const val KEY_JSON = "blocked_apps_json"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_DAILY_ALLOWANCE = "daily_allowance_minutes"
    private const val KEY_GOES_OUT_SATURDAY = "goes_out_saturday"

    fun saveBlockedAppsJson(context: Context, json: String) {
        prefs(context).edit()
            .putString(KEY_JSON, json)
            .apply()
    }

    fun getBlockedAppsJson(context: Context): String {
        return prefs(context).getString(KEY_JSON, "{}") ?: "{}"
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .apply()
    }

    fun isEnabled(context: Context): Boolean {
        return prefs(context).getBoolean(KEY_ENABLED, false)
    }

    fun saveDailyAllowance(context: Context, minutes: Int) {
        prefs(context).edit()
            .putInt(KEY_DAILY_ALLOWANCE, minutes.coerceAtLeast(1))
            .apply()
    }

    fun getDailyAllowance(context: Context): Int {
        return prefs(context).getInt(KEY_DAILY_ALLOWANCE, DEFAULT_DAILY_ALLOWANCE)
    }

    fun saveGoesOutSaturday(context: Context, goesOut: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_GOES_OUT_SATURDAY, goesOut)
            .apply()
    }

    fun getGoesOutSaturday(context: Context): Boolean {
        return prefs(context).getBoolean(KEY_GOES_OUT_SATURDAY, false)
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
