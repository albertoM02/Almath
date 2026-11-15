package io.github.albertom02.almath;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

final class WidgetCalendar {
    private WidgetCalendar() {}

    static long ordinal(String day) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setLenient(false);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        try { return format.parse(day).getTime() / 86_400_000L; }
        catch (ParseException | NullPointerException e) { return Long.MIN_VALUE; }
    }

    static int currentStreak(String savedDay, int savedStreak, boolean earned, String today) {
        long saved = ordinal(savedDay), now = ordinal(today);
        if (saved == Long.MIN_VALUE || now == Long.MIN_VALUE || now < saved) return 0;
        long last = saved - (earned ? 0 : 1);
        return now - last <= 1 ? Math.max(0, savedStreak) : 0;
    }

    static Calendar nextRefresh(Calendar now) {
        Calendar next = (Calendar) now.clone();
        next.add(Calendar.DATE, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 5);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        return next;
    }

    static int conceptIndex(String today, int size) {
        return size > 0 ? (int) Math.floorMod(ordinal(today), (long) size) : -1;
    }
}
