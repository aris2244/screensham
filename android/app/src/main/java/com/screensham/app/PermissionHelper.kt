package com.screensham.app

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object PermissionHelper {

    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Settings.canDrawOverlays() returns true on some Xiaomi devices even when
     * the MIUI "Display pop-up windows" toggle is still off. Actually try addView.
     */
    fun verifyOverlayWorks(context: Context): Boolean {
        if (!BlockOverlayManager.canDrawOverlays(context)) return false

        val appContext = context.applicationContext
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return BlockOverlayManager.probeOverlay(appContext)
        }

        val latch = CountDownLatch(1)
        var ok = false

        mainHandler.post {
            ok = BlockOverlayManager.probeOverlay(appContext)
            latch.countDown()
        }

        latch.await(3, TimeUnit.SECONDS)
        return ok
    }

    /** Try every known path to open overlay / app permissions. Returns true if an Activity was launched. */
    fun openOverlaySettings(context: ReactApplicationContext): Boolean {
        val pkg = context.packageName
        val pm = context.packageManager
        val activity = context.currentActivity

        val candidates = buildList {
            // MIUI / Redmi / POCO — "Other permissions" screen
            add(
                Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                    putExtra("extra_pkgname", pkg)
                    try {
                        setClassName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.permissions.PermissionsEditorActivity",
                        )
                    } catch (_: Exception) { }
                },
            )
            add(
                Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                    putExtra("extra_pkgname", pkg)
                },
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                add(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$pkg"),
                    ),
                )
                add(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION))
            }
            add(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$pkg")
                },
            )
        }

        for (intent in candidates) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (intent.resolveActivity(pm) == null) continue
            try {
                if (activity != null && !activity.isFinishing) {
                    activity.startActivity(intent)
                } else {
                    context.startActivity(intent)
                }
                return true
            } catch (_: Exception) { }
        }
        return false
    }

    fun openUsageSettings(context: ReactApplicationContext): Boolean {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return launch(context, intent)
    }

    fun hasNotificationPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }

    /** Opens this app's notification settings (Android 8+). */
    fun openNotificationSettings(context: ReactApplicationContext): Boolean {
        val pkg = context.packageName
        val pm = context.packageManager

        val candidates = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                add(
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
                    },
                )
            }
            add(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$pkg")
                },
            )
        }

        return launchFirst(context, candidates, pm)
    }

    private fun launchFirst(
        context: ReactApplicationContext,
        candidates: List<Intent>,
        pm: android.content.pm.PackageManager,
    ): Boolean {
        for (intent in candidates) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (intent.resolveActivity(pm) == null) continue
            if (launch(context, intent)) return true
        }
        return false
    }

    private fun launch(context: ReactApplicationContext, intent: Intent): Boolean {
        return try {
            val activity = context.currentActivity
            if (activity != null && !activity.isFinishing) {
                activity.startActivity(intent)
            } else {
                context.startActivity(intent)
            }
            true
        } catch (_: Exception) {
            false
        }
    }
}
