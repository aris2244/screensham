package com.screensham.app

import android.content.Context
import org.json.JSONObject

/** Persists roast notification profile + message templates from JS. */
object RoastConfigStore {

    private const val PREFS = "screensham_roast"
    private const val KEY_NAME = "user_name"
    private const val KEY_GOAL = "user_goal"
    private const val KEY_TEMPLATES = "templates_json"

    enum class TriggerType {
        GENERAL, USAGE, OPENS, RAPID, SESSION, EARLY_MORNING,
    }

    data class TriggerTemplates(
        val general: List<String>,
        val usage: List<String>,
        val opens: List<String>,
        val rapid: List<String>,
        val session: List<String>,
        val earlyMorning: List<String>,
    ) {
        fun forType(type: TriggerType): List<String> = when (type) {
            TriggerType.GENERAL -> general
            TriggerType.USAGE -> usage
            TriggerType.OPENS -> opens
            TriggerType.RAPID -> rapid
            TriggerType.SESSION -> session
            TriggerType.EARLY_MORNING -> earlyMorning
        }
    }

    private val DEFAULT_BLOCKED = TriggerTemplates(
        general = listOf(
            "{name}, you blocked {app}. Act like it.",
            "Still on {app}? {goal} waits.",
        ),
        usage = listOf(
            "{minutes} min on {app}. You blocked it.",
        ),
        opens = listOf(
            "{count} opens on {app}. Really?",
        ),
        rapid = listOf(
            "{count}x {app} in {window} min. Chill.",
        ),
        session = listOf(
            "{minutes} min on {app} without closing.",
        ),
        earlyMorning = listOf(
            "Scrolling {app} before 7 AM, {name}?",
        ),
    )

    private val DEFAULT_UNBLOCKED = TriggerTemplates(
        general = listOf(
            "Hiding on {app}, {name}? Cute.",
            "No block on {app}. Bold.",
        ),
        usage = listOf(
            "{minutes} min on {app}. Block it?",
        ),
        opens = listOf(
            "{app} open #{count}. Classic.",
        ),
        rapid = listOf(
            "Slow down, {name}. {app} again.",
        ),
        session = listOf(
            "{minutes} min on {app} without closing.",
        ),
        earlyMorning = listOf(
            "Doomscrolling {app} before 7 AM, {name}?",
        ),
    )

    private val DEFAULT_SCROLL_PKG = listOf(
        "instagram", "tiktok", "zhiliaoapp", "youtube", "snapchat",
        "twitter", "reddit", "facebook", "fb.", "threads", "pinterest", "linkedin",
    )

    private val DEFAULT_SCROLL_LABEL = listOf(
        "instagram", "tiktok", "youtube", "snapchat",
        "twitter", "reddit", "facebook", "threads", "pinterest",
    )

    fun saveProfile(context: Context, name: String, goal: String) {
        prefs(context).edit()
            .putString(KEY_NAME, name.trim())
            .putString(KEY_GOAL, goal.trim())
            .apply()
    }

    fun saveTemplatesJson(context: Context, json: String) {
        prefs(context).edit()
            .putString(KEY_TEMPLATES, json)
            .apply()
    }

    fun hasProfile(context: Context): Boolean {
        return getName(context).isNotEmpty()
    }

    fun getName(context: Context): String {
        return prefs(context).getString(KEY_NAME, "") ?: ""
    }

    fun getGoal(context: Context): String {
        return prefs(context).getString(KEY_GOAL, "") ?: ""
    }

    fun getBlockedTemplates(context: Context): TriggerTemplates {
        return parseTriggerTemplates(context, "blocked", DEFAULT_BLOCKED)
    }

    fun getUnblockedTemplates(context: Context): TriggerTemplates {
        return parseTriggerTemplates(context, "unblockedScroll", DEFAULT_UNBLOCKED)
    }

    fun getScrollPackageHints(context: Context): List<String> {
        return parseHintArray(context, "scrollPackageHints", DEFAULT_SCROLL_PKG)
    }

    fun getScrollLabelHints(context: Context): List<String> {
        return parseHintArray(context, "scrollLabelHints", DEFAULT_SCROLL_LABEL)
    }

    private fun parseTriggerTemplates(
        context: Context,
        rootKey: String,
        fallback: TriggerTemplates,
    ): TriggerTemplates {
        val raw = prefs(context).getString(KEY_TEMPLATES, null) ?: return fallback
        return try {
            val root = JSONObject(raw)
            val obj = root.optJSONObject(rootKey)
            if (obj == null) {
                // Legacy flat array format
                val legacy = parseStringArray(root, rootKey)
                if (legacy.isNotEmpty()) {
                    return fallback.copy(general = legacy)
                }
                return fallback
            }
            TriggerTemplates(
                general = parseStringArray(obj, "general").ifEmpty { fallback.general },
                usage = parseStringArray(obj, "usage").ifEmpty { fallback.usage },
                opens = parseStringArray(obj, "opens").ifEmpty { fallback.opens },
                rapid = parseStringArray(obj, "rapid").ifEmpty { fallback.rapid },
                session = parseStringArray(obj, "session").ifEmpty { fallback.session },
                earlyMorning = parseStringArray(obj, "earlyMorning").ifEmpty { fallback.earlyMorning },
            )
        } catch (_: Exception) {
            fallback
        }
    }

    private fun parseStringArray(obj: JSONObject, key: String): List<String> {
        val arr = obj.optJSONArray(key) ?: return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            arr.optString(i).takeIf { it.isNotEmpty() }
        }
    }

    private fun parseHintArray(
        context: Context,
        key: String,
        fallback: List<String>,
    ): List<String> {
        val raw = prefs(context).getString(KEY_TEMPLATES, null) ?: return fallback
        return try {
            parseStringArray(JSONObject(raw), key).ifEmpty { fallback }
        } catch (_: Exception) {
            fallback
        }
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
