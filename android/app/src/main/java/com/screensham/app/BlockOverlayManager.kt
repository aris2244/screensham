package com.screensham.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Draws a full-screen lock overlay on top of any app (Instagram, etc.).
 * Requires "Display over other apps" permission — works reliably unlike
 * background Activity starts / full-screen intents on Android 14+.
 */
object BlockOverlayManager {

    private val mainHandler = Handler(Looper.getMainLooper())
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null
    private var showingPackage: String = ""

    fun canDrawOverlays(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
    }

    /**
     * Actually try to draw a 1×1 overlay. Catches Xiaomi false-positives from canDrawOverlays().
     */
    fun probeOverlay(context: Context): Boolean {
        if (!canDrawOverlays(context)) return false
        return try {
            val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val probe = View(context)
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            val params = WindowManager.LayoutParams(
                1,
                1,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                PixelFormat.TRANSLUCENT,
            )
            wm.addView(probe, params)
            wm.removeView(probe)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun isShowing(): Boolean = overlayView != null

    fun isShowingPackage(packageName: String): Boolean {
        return overlayView != null && showingPackage == packageName
    }

    /** Returns true only if the overlay view was actually added to the window. */
    fun show(
        context: Context,
        blockedPackage: String,
        appLabel: String,
        dailyLimitReached: Boolean = false,
    ): Boolean {
        if (isShowingPackage(blockedPackage)) return true

        if (!PermissionHelper.verifyOverlayWorks(context)) {
            BlockStatusStore.setOverlayBlockFailed(context, true)
            return false
        }

        val latch = java.util.concurrent.CountDownLatch(1)
        var ok = false

        mainHandler.post {
            try {
                showInternal(context.applicationContext, blockedPackage, appLabel, dailyLimitReached)
                ok = overlayView != null
                if (!ok) {
                    BlockStatusStore.setOverlayBlockFailed(context, true)
                }
            } catch (_: Exception) {
                ok = false
                BlockStatusStore.setOverlayBlockFailed(context, true)
            }
            latch.countDown()
        }

        latch.await(3, java.util.concurrent.TimeUnit.SECONDS)
        return ok
    }

    fun hide() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            hideInternal()
        } else {
            mainHandler.post { hideInternal() }
        }
    }

    private fun showInternal(
        context: Context,
        blockedPackage: String,
        appLabel: String,
        dailyLimitReached: Boolean,
    ) {
        hideInternal()

        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val layout = buildLayout(context, blockedPackage, appLabel, dailyLimitReached)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_FULLSCREEN or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.OPAQUE,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }

        wm.addView(layout, params)
        layout.requestFocus()
        overlayView = layout
        windowManager = wm
        showingPackage = blockedPackage
    }

    private fun buildLayout(
        context: Context,
        blockedPackage: String,
        appLabel: String,
        dailyLimitReached: Boolean,
    ): LinearLayout {
        val headline = if (dailyLimitReached) {
            "You've used all your screen time today."
        } else {
            "$appLabel is blocked."
        }
        val subtitle = if (dailyLimitReached) {
            "$appLabel is locked until tomorrow. Tap below to complete the typing challenge."
        } else {
            "Tap below to complete the typing challenge."
        }

        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#060000"))
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
            isClickable = true
            isFocusable = true
            isFocusableInTouchMode = true

            addView(TextView(context).apply {
                text = "DAILY LIMIT REACHED"
                textSize = 11f
                setTextColor(Color.parseColor("#ef4444"))
                gravity = Gravity.CENTER
                letterSpacing = 0.15f
                typeface = Typeface.DEFAULT_BOLD
            })

            addView(TextView(context).apply {
                text = headline
                textSize = 26f
                setTextColor(Color.WHITE)
                gravity = Gravity.CENTER
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, 24, 0, 12)
            })

            addView(TextView(context).apply {
                text = subtitle
                textSize = 15f
                setTextColor(Color.parseColor("#888888"))
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 48)
            })

            addView(Button(context).apply {
                text = "UNLOCK NOW"
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.parseColor("#7f1d1d"))
                setPadding(48, 28, 48, 28)
                isClickable = true
                isFocusable = true
                isFocusableInTouchMode = true
                setOnClickListener { openFrictionScreen(context, blockedPackage) }
            })
        }
    }

    private fun openFrictionScreen(context: Context, blockedPackage: String) {
        hide()

        WatchdogService.beginFrictionRequest(blockedPackage)
        WatchdogService.emitFrictionTrigger(blockedPackage)

        val intent = Intent(context, MainActivity::class.java).apply {
            putExtra(WatchdogService.EXTRA_SHOW_FRICTION, true)
            putExtra(WatchdogService.EXTRA_BLOCKED_PACKAGE, blockedPackage)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP,
            )
        }

        // Overlay runs while another app is foreground — direct startActivity is often
        // blocked on Android 10+. PendingIntent.send() from the user's tap is reliable.
        val launchPi = PendingIntent.getActivity(
            context,
            4,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        try {
            launchPi.send()
        } catch (_: Exception) {
            val activity = WatchdogService.reactContext?.currentActivity
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                try {
                    context.startActivity(intent)
                } catch (_: Exception) { }
            }
        }
    }

    private fun hideInternal() {
        try {
            val view = overlayView ?: return
            windowManager?.removeView(view)
        } catch (_: Exception) { }
        overlayView = null
        windowManager = null
        showingPackage = ""
    }
}
