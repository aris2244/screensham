package com.screensham.app

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerClient.InstallReferrerResponse
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Reads the Google Play "install referrer" — the string that was appended
 * to the Play Store link the user clicked before installing the app
 * (e.g. "...&referrer=ref%3DABC123").
 *
 * Only works for installs that came from the real Play Store. Free, no
 * account/SDK needed beyond this Google-provided library.
 *
 * Docs: https://developer.android.com/google/play/installreferrer
 */
class InstallReferrerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "InstallReferrer"

    @ReactMethod
    fun getReferrer(promise: Promise) {
        val client = InstallReferrerClient.newBuilder(reactContext).build()
        var resolved = false

        fun finish(value: String?) {
            if (resolved) return
            resolved = true
            promise.resolve(value)
            try {
                client.endConnection()
            } catch (_: Exception) {
                // ignore
            }
        }

        try {
            client.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) {
                    when (responseCode) {
                        InstallReferrerResponse.OK -> {
                            try {
                                val response = client.installReferrer
                                finish(response.installReferrer)
                            } catch (e: Exception) {
                                finish(null)
                            }
                        }
                        // FEATURE_NOT_SUPPORTED, SERVICE_UNAVAILABLE, SERVICE_DISCONNECTED,
                        // DEVELOPER_ERROR, PERMISSION_ERROR — all just mean "no referrer info".
                        else -> finish(null)
                    }
                }

                override fun onInstallReferrerServiceDisconnected() {
                    finish(null)
                }
            })
        } catch (e: Exception) {
            finish(null)
        }
    }
}
