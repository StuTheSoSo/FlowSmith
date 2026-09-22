package com.stuschwartz.flowsmith.presentation

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class RunnerStateTest {
    private val now = Instant.parse("2026-09-22T12:00:00.250Z")
    private val state = RunnerState("session", 5, now, "running", 0, 2, "Hundred", "Roll Up", 60, 60, now.plusSeconds(60), emptyMap())

    @Test fun countdownUsesPhoneDeadlineAndHoldsWhenPaused() {
        assertEquals(58, state.remaining(now.plusMillis(2250)))
        assertEquals(60, state.remaining(now.minusSeconds(2)))
        assertEquals(0, state.remaining(now.plusSeconds(65)))
        assertEquals(60, state.copy(status = "setup").remaining(now.plusSeconds(65)))
        assertEquals(60, state.copy(status = "paused").remaining(now.plusSeconds(65)))
    }

    @Test fun rejectsDelayedStatesAndInvalidCommands() {
        assertFalse(state.copy(revision = 4).canReplace(state))
        assertFalse(state.copy(sessionId = "old", sentAt = now.minusSeconds(1)).canReplace(state))
        assertTrue(state.copy(sessionId = "new", revision = 0).canReplace(state))
        assertNull(state.command("start", "id", now))
        assertNotNull(state.command("pause", "id", now))
        assertNotNull(state.command("stop", "id", now))
        assertNull(state.copy(status = "completed").command("stop", "id", now))
        val command = state.copy(status = "setup").command("start", "id", now)!!
        assertEquals(5, command.getInt("baseRevision"))
        assertEquals("session", command.getString("sessionId"))
    }

    @Test fun decodesPhonePayloadAndRejectsMalformedOrUnsupportedMessages() {
        val payload = """{"type":"runner.state","protocolVersion":1,"sessionId":"session","revision":5,"sentAt":"2026-09-22T12:00:00.250Z","status":"running","currentIndex":0,"totalExercises":2,"currentExercise":{"name":"Hundred","remainingSeconds":60,"durationSeconds":60},"currentExerciseEndsAt":"2026-09-22T12:01:00.250Z","appearance":{"accent":"#2a8fa5"}}"""
        val decoded = RunnerState.decode(payload)!!
        assertEquals(58, decoded.remaining(now.plusSeconds(2)))
        assertEquals("#2a8fa5", decoded.appearance["accent"])
        assertNull(RunnerState.decode(payload.replace("\"protocolVersion\":1", "\"protocolVersion\":2")))
        assertNull(RunnerState.decode("{}"))
    }
}