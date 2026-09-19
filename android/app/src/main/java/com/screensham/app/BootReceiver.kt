package com.screensham.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restart blocking after phone reboot or app update. */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return
        }

        if (WatchdogConfigStore.isEnabled(context)) {
            WatchdogStarter.start(context)
        }
    }
}
