package io.github.albertom02.almath;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.Calendar;

final class DailyReminderScheduler {
    static final String ALARM_ACTION = "io.github.albertom02.almath.DAILY_REMINDER";
    static final String OPEN_EXTRA = "almath_daily_reminder";
    private static final String CHANNEL = "almath-daily-learning";
    private static final int NOTIFICATION_ID = 4201;

    private DailyReminderScheduler() {}

    static SharedPreferences preferences(Context context) {
        // Only notification settings and day markers live here. Learning progress
        // remains in the existing IndexedDB store and is mirrored by the bridge.
        return context.getSharedPreferences("almath-daily-reminder", Context.MODE_PRIVATE);
    }

    static void ensureChannel(Context context, String name) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_DEFAULT);
            channel.enableVibration(false);
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    static boolean permitted(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = context.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }

    static synchronized void scheduleNext(Context context) {
        SharedPreferences saved = preferences(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        Intent intent = new Intent(context, DailyReminderReceiver.class).setAction(ALARM_ACTION);
        PendingIntent pending = PendingIntent.getBroadcast(context, NOTIFICATION_ID, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (!saved.getBoolean("enabled", false) || !permitted(context)) {
            alarms.cancel(pending);
            NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
            return;
        }
        Calendar now = Calendar.getInstance();
        Calendar next = ReminderTime.next(now, saved.getInt("hour", 19), saved.getInt("minute", 0),
            saved.getString("completedDay", ""), saved.getString("notifiedDay", ""));
        saved.edit().putString("scheduledDay", ReminderTime.day(next))
            .putLong("scheduledAt", next.getTimeInMillis()).commit();
        // A learning nudge does not need exact-alarm access or a background service.
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
        if (ReminderTime.day(now).equals(saved.getString("completedDay", ""))) {
            NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
        }
    }

    static synchronized void deliver(Context context) {
        SharedPreferences saved = preferences(context);
        String today = ReminderTime.day(Calendar.getInstance());
        if (saved.getBoolean("enabled", false) && permitted(context)
            && System.currentTimeMillis() >= saved.getLong("scheduledAt", Long.MAX_VALUE)
            && today.equals(saved.getString("scheduledDay", ""))
            && !today.equals(saved.getString("completedDay", ""))
            && !today.equals(saved.getString("notifiedDay", ""))) {
            Intent open = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(OPEN_EXTRA, true);
            PendingIntent tap = PendingIntent.getActivity(context, NOTIFICATION_ID, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_daily_reminder)
                .setColor(0xFF0F6B46)
                .setContentTitle(saved.getString("title", ""))
                .setContentText(saved.getString("body", ""))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(saved.getString("body", "")))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true);
            try {
                NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification.build());
                saved.edit().putString("notifiedDay", today).commit();
            } catch (SecurityException ignored) {
                // Permission may be revoked between the check and delivery.
            }
        }
        scheduleNext(context);
    }
}
