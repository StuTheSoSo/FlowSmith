package com.stuschwartz.flowsmith.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Stop
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import com.stuschwartz.flowsmith.R
import kotlinx.coroutines.delay
import java.time.Instant
import java.util.Locale

class MainActivity : ComponentActivity() {
    private lateinit var session: WatchSession

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = WatchSession(applicationContext)
        setContent { MaterialTheme { RunnerScreen(session, lifecycle) } }
    }

    override fun onStart() {
        super.onStart()
        session.start()
    }

    override fun onStop() {
        session.stop()
        super.onStop()
    }
}

@Composable
private fun RunnerScreen(session: WatchSession, lifecycle: Lifecycle) {
    val state = session.state
    var now by remember { mutableStateOf(Instant.now()) }
    var stopSessionId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(state, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            now = Instant.now()
            while (state?.status == "running") {
                delay(100)
                now = Instant.now()
            }
        }
    }
    fun color(key: String, fallback: Long): Color = state?.appearance?.get(key)
        ?.let { Color(android.graphics.Color.parseColor(it)) } ?: Color(fallback)
    val background = color("background", 0xFF101414)
    val foreground = color("text", 0xFFF4F7F6)
    val accent = color("accent", 0xFF68D3C1)
    val danger = color("timerDanger", 0xFFFF8282)
    val enabled = session.connected && !session.pending

    Column(
        modifier = Modifier.fillMaxSize().background(background).verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (stopSessionId != null) {
            Text(stringResource(R.string.stop_question), color = foreground, textAlign = TextAlign.Center)
            Text(stringResource(R.string.stop_message), color = foreground, fontSize = 12.sp, textAlign = TextAlign.Center)
            Text(stringResource(R.string.stop), color = danger,
                modifier = Modifier.fillMaxWidth().clickable(enabled = enabled, role = Role.Button) {
                    session.send("stop", stopSessionId)
                    stopSessionId = null
                }.padding(12.dp), textAlign = TextAlign.Center)
            Text(stringResource(R.string.cancel), color = foreground,
                modifier = Modifier.fillMaxWidth().clickable(role = Role.Button) { stopSessionId = null }.padding(12.dp),
                textAlign = TextAlign.Center)
        } else if (state == null) {
            Text(stringResource(R.string.app_name), color = foreground, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Text(stringResource(R.string.open_phone), color = foreground, textAlign = TextAlign.Center)
            Control(Icons.Default.Refresh, stringResource(R.string.refresh), session.connected, accent) { session.requestState() }
        } else {
            val remaining = state.remaining(now)
            val ratio = remaining.toDouble() / state.durationSeconds
            val timerColor = when {
                ratio <= 0.15 -> danger
                ratio <= 0.35 -> color("timerWarning", 0xFFF4C56C)
                else -> color("timerNormal", 0xFFF4F7F6)
            }
            Text(String.format(Locale.getDefault(), "%02d:%02d", remaining / 60, remaining % 60),
                color = timerColor, fontSize = 36.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(state.name, color = foreground, fontSize = 16.sp, maxLines = 2,
                overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
            Text(stringResource(when (state.status) {
                "setup" -> R.string.setup
                "paused" -> R.string.paused
                "completed" -> R.string.completed
                "running" -> R.string.running
                else -> R.string.ready
            }), color = foreground, fontSize = 12.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                val go = if (state.status == "paused") "resume" else "start"
                Control(Icons.Default.PlayArrow, stringResource(if (go == "resume") R.string.resume else R.string.go),
                    enabled && state.permits(go), accent) { session.send(go) }
                Control(Icons.Default.Pause, stringResource(R.string.pause), enabled && state.permits("pause"), accent) { session.send("pause") }
                Control(Icons.Default.Stop, stringResource(R.string.stop), enabled && state.permits("stop"), danger) { stopSessionId = state.sessionId }
            }
            Text(state.nextName?.let { stringResource(R.string.next_exercise, it) } ?: stringResource(R.string.last_exercise),
                color = foreground, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
            Text("${state.currentIndex + 1}/${state.totalExercises}", color = foreground, fontSize = 12.sp)
        }
        if (!session.connected) Text(stringResource(R.string.disconnected), color = foreground, fontSize = 12.sp, textAlign = TextAlign.Center)
        if (session.pending) Text(stringResource(R.string.waiting), color = foreground, fontSize = 12.sp)
        session.error?.let { Text(stringResource(it), color = danger, fontSize = 12.sp, textAlign = TextAlign.Center) }
    }
}

@Composable
private fun Control(icon: ImageVector, label: String, enabled: Boolean, tint: Color, action: () -> Unit) {
    Box(
        modifier = Modifier.size(44.dp).clip(CircleShape).background(tint.copy(alpha = if (enabled) 0.18f else 0.06f))
            .semantics { contentDescription = label }.clickable(enabled = enabled, role = Role.Button, onClick = action),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = tint.copy(alpha = if (enabled) 1f else 0.3f), modifier = Modifier.size(24.dp))
    }
}