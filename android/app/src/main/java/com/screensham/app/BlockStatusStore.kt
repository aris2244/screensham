package com.screensham.app

import android.content.Context

/** Persists overlay block failures so JS can show the banner after returning from YouTube. */
object BlockStatusStore {

    private const val PREFS = "screensham_block_status"
    private const val KEY_OVERLAY_BLOCK_FAILED = "overlay_block_failed"

    fun setOverlayBlockFailed(context: Context, failed: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_OVERLAY_BLOCK_FAILED, failed)
            .apply()
    }

    fun hasOverlayBlockFailed(context: Context): Boolean {
        return prefs(context).getBoolean(KEY_OVERLAY_BLOCK_FAILED, false)
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
