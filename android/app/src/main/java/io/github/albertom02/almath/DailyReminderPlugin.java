package io.github.albertom02.almath;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "DailyReminder", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class DailyReminderPlugin extends Plugin {
    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", DailyReminderScheduler.permitted(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult");
        } else {
            checkPermission(call);
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        checkPermission(call);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        String completedDay = call.getString("completedDay", "");
        if (hour == null || minute == null || hour < 0 || hour > 23 || minute < 0 || minute > 59
            || (!completedDay.isEmpty() && !completedDay.matches("\\d{4}-\\d{2}-\\d{2}"))) {
            call.reject("Invalid reminder settings.");
            return;
        }
        synchronized (DailyReminderScheduler.class) {
            boolean saved = DailyReminderScheduler.preferences(getContext()).edit()
                .putBoolean("enabled", call.getBoolean("enabled", false))
                .putInt("hour", hour).putInt("minute", minute)
                .putString("completedDay", completedDay)
                .putString("title", call.getString("title", ""))
                .putString("body", call.getString("body", ""))
                .commit();
            if (!saved) { call.reject("Could not save reminder settings."); return; }
            try {
                DailyReminderScheduler.ensureChannel(getContext(), call.getString("channelName", ""));
                DailyReminderScheduler.scheduleNext(getContext());
                call.resolve();
            } catch (RuntimeException failure) {
                call.reject("Could not schedule reminder.", failure);
            }
        }
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent settings;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            settings = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                .setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
        }
        getActivity().startActivity(settings);
        call.resolve();
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra(DailyReminderScheduler.OPEN_EXTRA, false)) {
            intent.removeExtra(DailyReminderScheduler.OPEN_EXTRA);
            notifyListeners("openReminder", new JSObject(), true);
        }
    }
}
