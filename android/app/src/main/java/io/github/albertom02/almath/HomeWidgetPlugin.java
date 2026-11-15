package io.github.albertom02.almath;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

@CapacitorPlugin(name = "HomeWidget")
public class HomeWidgetPlugin extends Plugin {
    private JSObject pending;

    @Override
    public void load() { capture(getActivity().getIntent()); }

    private synchronized void capture(Intent intent) {
        if (intent == null || !intent.hasExtra(HomeWidgets.OPEN_ACTION)) return;
        String action = intent.getStringExtra(HomeWidgets.OPEN_ACTION);
        if ("continue".equals(action) || "concept".equals(action)) {
            pending = new JSObject();
            pending.put("action", action);
            pending.put("conceptId", intent.getStringExtra(HomeWidgets.OPEN_CONCEPT));
        }
        intent.removeExtra(HomeWidgets.OPEN_ACTION);
        intent.removeExtra(HomeWidgets.OPEN_CONCEPT);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        capture(intent);
        notifyListeners("openWidget", new JSObject(), true);
    }

    @PluginMethod
    public synchronized void consumeOpen(PluginCall call) {
        JSObject result = pending == null ? new JSObject() : pending;
        pending = null;
        call.resolve(result);
    }

    @PluginMethod
    public void sync(PluginCall call) {
        JSObject data = call.getData();
        JSONArray concepts = data.optJSONArray("concepts");
        String day = data.optString("day", "");
        if (!day.matches("\\d{4}-\\d{2}-\\d{2}") || WidgetCalendar.ordinal(day) == Long.MIN_VALUE
                || concepts == null || concepts.length() > 30 || data.toString().length() > 32000
                || data.optInt("target", 0) < 1 || data.optInt("target", 0) > 100) {
            call.reject("Invalid widget snapshot."); return;
        }
        if (!HomeWidgets.preferences(getContext()).edit().putString("snapshot", data.toString()).commit()) {
            call.reject("Could not save widget snapshot."); return;
        }
        HomeWidgets.updateAll(getContext());
        call.resolve();
    }
}
