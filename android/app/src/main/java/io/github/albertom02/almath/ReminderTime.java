package io.github.albertom02.almath;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

final class ReminderTime {
    private ReminderTime() {}

    static String day(Calendar date) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setTimeZone(date.getTimeZone());
        return format.format(date.getTime());
    }

    static Calendar next(Calendar now, int hour, int minute, String completedDay, String notifiedDay) {
        Calendar next = (Calendar) now.clone();
        setClock(next, hour, minute);
        String today = day(now);
        if (!next.after(now) || today.equals(completedDay) || today.equals(notifiedDay)) {
            // Calendar days preserve local clock time across daylight-saving changes.
            next = (Calendar) now.clone();
            next.add(Calendar.DATE, 1);
            setClock(next, hour, minute);
        }
        return next;
    }

    private static void setClock(Calendar date, int hour, int minute) {
        date.set(Calendar.HOUR_OF_DAY, hour);
        date.set(Calendar.MINUTE, minute);
        date.set(Calendar.SECOND, 0);
        date.set(Calendar.MILLISECOND, 0);
    }
}
