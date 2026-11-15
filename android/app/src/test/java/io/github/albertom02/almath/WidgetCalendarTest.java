package io.github.albertom02.almath;

import static org.junit.Assert.*;
import org.junit.Test;
import java.util.Calendar;
import java.util.TimeZone;

public class WidgetCalendarTest {
    @Test public void streakExpiresAfterMissedDayWithoutOpeningApp() {
        assertEquals(12, WidgetCalendar.currentStreak("2026-10-22", 12, true, "2026-10-22"));
        assertEquals(12, WidgetCalendar.currentStreak("2026-10-22", 12, true, "2026-10-23"));
        assertEquals(0, WidgetCalendar.currentStreak("2026-10-22", 12, true, "2026-10-24"));
        assertEquals(12, WidgetCalendar.currentStreak("2026-10-22", 12, false, "2026-10-22"));
        assertEquals(0, WidgetCalendar.currentStreak("2026-10-22", 12, false, "2026-10-23"));
        assertEquals(0, WidgetCalendar.currentStreak("2026-10-22", 12, true, "2026-10-21"));
        assertEquals(0, WidgetCalendar.currentStreak("", 12, true, "2026-10-22"));
    }

    @Test public void leapDaysAndYearBoundariesUseCalendarArithmetic() {
        assertEquals(3, WidgetCalendar.currentStreak("2028-02-29", 3, true, "2028-03-01"));
        assertEquals(0, WidgetCalendar.currentStreak("2028-02-29", 3, true, "2028-03-02"));
        assertEquals(9, WidgetCalendar.currentStreak("2026-12-31", 9, true, "2027-01-01"));
    }

    @Test public void conceptChangesDailyAndRotatesWhileAppIsClosed() {
        int first = WidgetCalendar.conceptIndex("2026-10-22", 30);
        assertEquals((first + 1) % 30, WidgetCalendar.conceptIndex("2026-10-23", 30));
        assertEquals(first, WidgetCalendar.conceptIndex("2026-11-21", 30));
        assertEquals(0, WidgetCalendar.conceptIndex("2026-10-22", 1));
        assertEquals(-1, WidgetCalendar.conceptIndex("2026-10-22", 0));
    }

    @Test public void nextRefreshStaysAtLocalMidnightAcrossDst() {
        for (int[] date : new int[][] {{2026, 2, 28}, {2026, 9, 24}}) {
            Calendar now = Calendar.getInstance(TimeZone.getTimeZone("Europe/Madrid"));
            now.clear(); now.set(date[0], date[1], date[2], 12, 30);
            Calendar next = WidgetCalendar.nextRefresh(now);
            assertTrue(next.after(now));
            assertEquals(0, next.get(Calendar.HOUR_OF_DAY));
            assertEquals(5, next.get(Calendar.MINUTE));
            assertEquals(date[2] + 1, next.get(Calendar.DAY_OF_MONTH));
            assertEquals("Europe/Madrid", next.getTimeZone().getID());
        }
    }
}
