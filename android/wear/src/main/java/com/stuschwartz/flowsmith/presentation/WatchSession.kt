package com.stuschwartz.flowsmith.presentation

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.CapabilityInfo
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.stuschwartz.flowsmith.R
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

class WatchSession(context: Context) : MessageClient.OnMessageReceivedListener,
    DataClient.OnDataChangedListener, CapabilityClient.OnCapabilityChangedListener {
    private val messages = Wearable.getMessageClient(context)
    private val data = Wearable.getDataClient(context)
    private val capabilities = Wearable.getCapabilityClient(context)
    private val handler = Handler(Looper.getMainLooper())
    private var active = false
    private var phoneNode: String? = null
    private var pendingId: String? = null
    private var pendingState: RunnerState? = null
    var state by mutableStateOf<RunnerState?>(null)
        private set
    var connected by mutableStateOf(false)
        private set
    var pending by mutableStateOf(false)
        private set
    var error by mutableStateOf<Int?>(null)
        private set

    fun start() {
        if (active) return
        active = true
        messages.addListener(this)
        data.addListener(this)
        capabilities.addListener(this, PHONE_CAPABILITY)
        capabilities.getCapability(PHONE_CAPABILITY, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { onCapabilityChanged(it) }
            .addOnFailureListener { if (active) error = R.string.connection_error }
        data.dataItems.addOnSuccessListener { items ->
            try {
                for (item in items) {
                    if (item.uri.path == STATE_PATH) {
                        DataMapItem.fromDataItem(item).dataMap.getString("payload")?.let { applyState(it) }
                    }
                }
            } finally {
                items.release()
            }
        }.addOnFailureListener { if (active) error = R.string.connection_error }
    }

    fun stop() {
        active = false
        connected = false
        phoneNode = null
        clearPending()
        handler.removeCallbacksAndMessages(null)
        messages.removeListener(this)
        data.removeListener(this)
        capabilities.removeListener(this, PHONE_CAPABILITY)
    }

    override fun onCapabilityChanged(info: CapabilityInfo) {
        handler.post {
            if (!active) return@post
            phoneNode = info.nodes.sortedBy { it.id }.firstOrNull()?.id
            connected = phoneNode != null
            if (connected) requestState() else clearPending()
        }
    }

    fun requestState() {
        val node = phoneNode ?: return
        messages.sendMessage(node, REQUEST_PATH, byteArrayOf())
            .addOnFailureListener { if (active) error = R.string.connection_error }
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type == DataEvent.TYPE_CHANGED && event.dataItem.uri.path == STATE_PATH) {
                val payload = DataMapItem.fromDataItem(event.dataItem).dataMap.getString("payload") ?: continue
                handler.post { applyState(payload) }
            }
        }
    }

    override fun onMessageReceived(event: MessageEvent) {
        val payload = String(event.data, Charsets.UTF_8)
        handler.post {
            if (!active || (phoneNode != null && event.sourceNodeId != phoneNode)) return@post
            when (event.path) {
                STATE_PATH -> applyState(payload)
                ACK_PATH -> {
                    val ack = runCatching { JSONObject(payload) }.getOrNull() ?: return@post
                    if (ack.optString("type") != "runner.commandAck" || ack.optInt("protocolVersion") != 1 ||
                        ack.optString("messageId") != pendingId || ack.optString("sessionId") != pendingState?.sessionId) return@post
                    if (!ack.optBoolean("accepted")) {
                        clearPending()
                        error = R.string.command_rejected
                        requestState()
                    }
                }
            }
        }
    }

    private fun applyState(payload: String) {
        if (!active) return
        val next = RunnerState.decode(payload) ?: return
        if (!next.canReplace(state)) return
        state = next
        val waiting = pendingState
        if (waiting != null && (next.sessionId != waiting.sessionId || next.revision > waiting.revision)) clearPending()
    }

    fun send(command: String, expectedSessionId: String? = null) {
        val current = state ?: return
        val node = phoneNode ?: return
        if (!active || !connected || pending) return
        if (expectedSessionId != null && expectedSessionId != current.sessionId) {
            error = R.string.class_changed
            return
        }
        val messageId = UUID.randomUUID().toString()
        val payload = current.command(command, messageId, Instant.now()) ?: return
        pendingId = messageId
        pendingState = current
        pending = true
        error = null
        messages.sendMessage(node, COMMAND_PATH, payload.toString().toByteArray(Charsets.UTF_8))
            .addOnFailureListener {
                if (pendingId == messageId) {
                    clearPending()
                    error = R.string.connection_error
                }
            }
        handler.postDelayed({
            if (pendingId == messageId) {
                clearPending()
                error = R.string.command_timeout
                requestState()
            }
        }, 5000)
    }

    private fun clearPending() {
        pendingId = null
        pendingState = null
        pending = false
    }

    companion object {
        const val PHONE_CAPABILITY = "flowsmith_phone_bridge"
        const val STATE_PATH = "/flowsmith/runner/state"
        const val COMMAND_PATH = "/flowsmith/runner/command"
        const val ACK_PATH = "/flowsmith/runner/ack"
        const val REQUEST_PATH = "/flowsmith/runner/request-state"
    }
}