package com.stuschwartz.flowsmith;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.wearable.CapabilityClient;
import com.google.android.gms.wearable.CapabilityInfo;
import com.google.android.gms.wearable.DataClient;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMap;
import com.google.android.gms.wearable.MessageClient;
import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.Wearable;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;

@CapacitorPlugin(name = "WatchBridge")
public class WatchBridgePlugin extends Plugin implements MessageClient.OnMessageReceivedListener,
    DataClient.OnDataChangedListener, CapabilityClient.OnCapabilityChangedListener {

    private static final String CAPABILITY = "flowsmith_watch_bridge";
    private static final String STATE_PATH = "/flowsmith/runner/state";
    private static final String COMMAND_PATH = "/flowsmith/runner/command";
    private static final String ACK_PATH = "/flowsmith/runner/ack";

    private MessageClient messageClient;
    private DataClient dataClient;
    private CapabilityClient capabilityClient;

    @Override
    public void load() {
        messageClient = Wearable.getMessageClient(getContext());
        dataClient = Wearable.getDataClient(getContext());
        capabilityClient = Wearable.getCapabilityClient(getContext());
        messageClient.addListener(this);
        dataClient.addListener(this);
        capabilityClient.addListener(this, CAPABILITY);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        capabilityClient.getCapability(CAPABILITY, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener(capability -> call.resolve(connectionState(capability)))
            .addOnFailureListener(error -> call.resolve(connectionState(null)));
    }

    @PluginMethod
    public void sendState(PluginCall call) {
        JSObject state = call.getObject("state");
        if (state == null) {
            call.reject("A runner state message is required.");
            return;
        }

        PutDataMapRequest request = PutDataMapRequest.create(STATE_PATH);
        DataMap dataMap = request.getDataMap();
        dataMap.putString("payload", state.toString());
        request.setUrgent();
        dataClient.putDataItem(request.asPutDataRequest());
        sendToReachableNodes(STATE_PATH, state.toString());
        call.resolve();
    }

    @PluginMethod
    public void sendAcknowledgement(PluginCall call) {
        JSObject acknowledgement = call.getObject("acknowledgement");
        if (acknowledgement == null) {
            call.reject("A command acknowledgement is required.");
            return;
        }

        sendToReachableNodes(ACK_PATH, acknowledgement.toString());
        call.resolve();
    }

    @PluginMethod
    public void requestState(PluginCall call) {
        notifyListeners("connectionChanged", connectionState(null), false);
        call.resolve();
    }

    @Override
    public void onMessageReceived(MessageEvent event) {
        if (!COMMAND_PATH.equals(event.getPath())) return;
        try {
            JSObject command = new JSObject(new String(event.getData(), StandardCharsets.UTF_8));
            notifyListeners("command", command, true);
        } catch (JSONException ignored) {
            // Invalid payloads are rejected by the TypeScript protocol validator when possible.
        }
    }

    @Override
    public void onDataChanged(DataEventBuffer events) {
        notifyListeners("connectionChanged", connectionState(null), false);
    }

    @Override
    public void onCapabilityChanged(CapabilityInfo capabilityInfo) {
        notifyListeners("connectionChanged", connectionState(capabilityInfo), false);
    }

    @Override
    protected void handleOnDestroy() {
        if (messageClient != null) messageClient.removeListener(this);
        if (dataClient != null) dataClient.removeListener(this);
        if (capabilityClient != null) capabilityClient.removeListener(this, CAPABILITY);
        super.handleOnDestroy();
    }

    private void sendToReachableNodes(String path, String payload) {
        capabilityClient.getCapability(CAPABILITY, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener(capability -> {
                for (com.google.android.gms.wearable.Node node : capability.getNodes()) {
                    messageClient.sendMessage(node.getId(), path, payload.getBytes(StandardCharsets.UTF_8));
                }
            });
    }

    private JSObject connectionState(CapabilityInfo capability) {
        boolean paired = capability != null && !capability.getNodes().isEmpty();
        JSObject state = new JSObject();
        state.put("available", true);
        state.put("paired", paired);
        state.put("reachable", paired);
        return state;
    }
}
