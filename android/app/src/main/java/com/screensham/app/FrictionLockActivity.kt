package com.screensham.app

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen lock that stays on top of the blocked app (e.g. Instagram).
 * Does NOT auto-redirect to ScreenSham — user must tap UNLOCK.
 * If the user tries to leave without unlocking, this activity comes back.
 */
class FrictionLockActivity : Activity() {

    companion object {
        @Volatile var isUnlocking = false
        @Volatile var instance: FrictionLockActivity? = null

        fun finishIfOpen() {
            instance?.runOnUiThread {
                isUnlocking = false
                instance?.finish()
                instance = null
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var blockedPackage = ""
    private var appLabel = "This app"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
        )

        blockedPackage = intent?.getStringExtra(WatchdogService.EXTRA_BLOCKED_PACKAGE) ?: ""
        appLabel = intent?.getStringExtra(WatchdogService.EXTRA_BLOCKED_APP_LABEL) ?: "This app"

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#060000"))
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }

        layout.addView(TextView(this).apply {
            text = "DAILY LIMIT REACHED"
            textSize = 11f
            setTextColor(Color.parseColor("#ef4444"))
            gravity = Gravity.CENTER
            letterSpacing = 0.15f
            typeface = Typeface.DEFAULT_BOLD
        })

        layout.addView(TextView(this).apply {
            text = "$appLabel is blocked."
            textSize = 26f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 24, 0, 12)
        })

        layout.addView(TextView(this).apply {
            text = "Tap below to complete the typing challenge."
            textSize = 15f
            setTextColor(Color.parseColor("#888888"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 48)
        })

        layout.addView(Button(this).apply {
            text = "UNLOCK NOW"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#7f1d1d"))
            setPadding(48, 28, 48, 28)
            setOnClickListener { openFrictionScreen() }
        })

        setContentView(layout)
        instance = this
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun openFrictionScreen() {
        if (blockedPackage.isEmpty()) return
        isUnlocking = true
        WatchdogService.beginFrictionRequest(blockedPackage)
        WatchdogService.emitFrictionTrigger(blockedPackage)
        BlockOverlayManager.hide()

        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra(WatchdogService.EXTRA_SHOW_FRICTION, true)
            putExtra(WatchdogService.EXTRA_BLOCKED_PACKAGE, blockedPackage)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP,
            )
        }

        val launchPi = PendingIntent.getActivity(
            this,
            5,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        try {
            launchPi.send()
        } catch (_: Exception) {
            startActivity(intent)
        }
    }

    override fun onStop() {
        super.onStop()
        if (isUnlocking) return
        if (blockedPackage.isEmpty()) return
        if (!WatchdogService.shouldBlockPackage(blockedPackage)) return

        // User tried to leave without unlocking — bring lock screen back
        handler.postDelayed({
            if (isUnlocking || isFinishing) return@postDelayed
            if (!WatchdogService.shouldBlockPackage(blockedPackage)) return@postDelayed
            startActivity(Intent(this, FrictionLockActivity::class.java).apply {
                putExtra(WatchdogService.EXTRA_BLOCKED_PACKAGE, blockedPackage)
                putExtra(WatchdogService.EXTRA_BLOCKED_APP_LABEL, appLabel)
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP,
                )
            })
        }, 250)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Swallow back — lock stays until challenge is completed
    }
}
