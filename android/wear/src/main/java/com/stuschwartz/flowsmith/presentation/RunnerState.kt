package com.stuschwartz.flowsmith.presentation

import org.json.JSONObject
import java.time.Instant
import kotlin.math.ceil

data class RunnerState(
    val sessionId: String,
    val revision: Long,
    val sentAt: Instant,
    val status: String,
    val currentIndex: Int,
    val totalExercises: Int,
    val name: String,
    val nextName: String?,
    val remainingSeconds: Int,
    val durationSeconds: Int,
    val endsAt: Instant?,
    val appearance: Map<String, String>
) {
    fun remaining(now: Instant): Int {
        if (status != "running") return remainingSeconds
        val deadline = endsAt ?: sentAt.plusSeconds(remainingSeconds.toLong())
        return ceil((deadline.toEpochMilli() - now.toEpochMilli()) / 1000.0)
            .toInt().coerceIn(0, remainingSeconds)
    }

    fun canReplace(previous: RunnerState?): Boolean = previous == null ||
        (!sentAt.isBefore(previous.sentAt) &&
            (sessionId != previous.sessionId || revision >= previous.revision))

    fun permits(command: String): Boolean = when (command) {
        "start" -> status == "ready" || status == "setup"
        "resume" -> status == "paused"
        "pause" -> status == "running"
        "stop" -> status != "completed"
        "requestState" -> true
        else -> false
    }

    fun command(command: String, messageId: String, now: Instant): JSONObject? {
        if (!permits(command)) return null
        return JSONObject().put("type", "runner.command").put("protocolVersion", 1)
            .put("sessionId", sessionId).put("messageId", messageId)
            .put("sentAt", now.toString()).put("command", command).put("baseRevision", revision)
    }

    companion object {
        fun decode(payload: String): RunnerState? = runCatching {
            val json = JSONObject(payload)
            require(json.getString("type") == "runner.state" && json.getInt("protocolVersion") == 1)
            val status = json.getString("status")
            require(status in setOf("ready", "setup", "running", "paused", "completed"))
            val current = json.getJSONObject("currentExercise")
            val palette = json.optJSONObject("appearance")
            RunnerState(
                sessionId = json.getString("sessionId").also { require(it.isNotBlank()) },
                revision = json.getLong("revision").also { require(it >= 0) },
                sentAt = Instant.parse(json.getString("sentAt")),
                status = status,
                currentIndex = json.getInt("currentIndex").also { require(it >= 0) },
                totalExercises = json.getInt("totalExercises").also { require(it > json.getInt("currentIndex")) },
                name = current.getString("name"),
                nextName = json.optJSONObject("nextExercise")?.optString("name"),
                remainingSeconds = current.getInt("remainingSeconds").also { require(it >= 0) },
                durationSeconds = current.getInt("durationSeconds").also { require(it > 0) },
                endsAt = json.optString("currentExerciseEndsAt").takeIf { it.isNotBlank() && it != "null" }?.let(Instant::parse),
                appearance = listOf("accent", "background", "text", "secondaryText", "timerNormal", "timerWarning", "timerDanger")
                    .mapNotNull { key -> palette?.optString(key)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}")) }?.let { key to it } }.toMap()
            )
        }.getOrNull()
    }
}