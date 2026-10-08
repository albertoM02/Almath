package io.github.albertom02.almath;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class DailyReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (DailyReminderScheduler.ALARM_ACTION.equals(intent.getAction())) {
            DailyReminderScheduler.deliver(context);
        } else {
            // Boot, APK updates and timezone/clock changes replace the old alarm.
            DailyReminderScheduler.scheduleNext(context);
        }
    }
}
