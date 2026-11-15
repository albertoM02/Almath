package io.github.albertom02.almath;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class HomeWidgets {
    static final String OPEN_ACTION = "almath_widget_action";
    static final String OPEN_CONCEPT = "almath_widget_concept";
    private static final int REFRESH_ID = 4301;
    private HomeWidgets() {}

    static SharedPreferences preferences(Context context) {
        // A bounded display cache, never the authoritative learning progress.
        return context.getSharedPreferences("almath-home-widgets", Context.MODE_PRIVATE);
    }

    private static int[] ids(Context c, Class<?> provider) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, provider));
    }

    static synchronized void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids(context, StreakWidgetProvider.class)) update(context, manager, id, false);
        for (int id : ids(context, TheoryWidgetProvider.class)) update(context, manager, id, true);
        schedule(context);
    }

    static void schedule(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent pending = PendingIntent.getBroadcast(context, REFRESH_ID,
            new Intent(context, WidgetRefreshReceiver.class).setAction("io.github.albertom02.almath.WIDGET_REFRESH"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (ids(context, StreakWidgetProvider.class).length + ids(context, TheoryWidgetProvider.class).length == 0) {
            alarms.cancel(pending); return;
        }
        // Inexact and non-waking: no exact-alarm permission or background service.
        // Launcher periodic updates also refresh after sleep or process death.
        alarms.set(AlarmManager.RTC, WidgetCalendar.nextRefresh(Calendar.getInstance()).getTimeInMillis(), pending);
    }

    static synchronized void update(Context context, AppWidgetManager manager, int id, boolean theory) {
        Bundle options = manager.getAppWidgetOptions(id);
        boolean large = theory && options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 280) >= 240;
        RemoteViews views = new RemoteViews(context.getPackageName(), large ? R.layout.widget_theory : R.layout.widget_streak);
        JSONObject snapshot;
        try { snapshot = new JSONObject(preferences(context).getString("snapshot", "{}")); }
        catch (JSONException failure) { snapshot = new JSONObject(); }
        String today = ReminderTime.day(Calendar.getInstance());
        String savedDay = snapshot.optString("day", "");
        boolean sameDay = today.equals(savedDay);
        boolean earned = sameDay && snapshot.optBoolean("earnedToday", false);
        int streak = WidgetCalendar.currentStreak(savedDay, snapshot.optInt("streak", 0), snapshot.optBoolean("earnedToday", false), today);
        views.setTextViewText(R.id.widget_streak_count, String.valueOf(streak));
        views.setTextViewText(R.id.widget_streak_label, context.getString(streak == 1 ? R.string.widget_day_streak : R.string.widget_days_streak));
        views.setTextViewText(R.id.widget_status, context.getString(earned ? R.string.widget_practised : R.string.widget_practise));
        views.setTextViewText(R.id.widget_goal, context.getString(R.string.widget_goal,
            sameDay ? Math.max(0, snapshot.optInt("solved", 0)) : 0, Math.max(1, Math.min(100, snapshot.optInt("target", 5)))));
        views.setContentDescription(R.id.widget_root, context.getString(R.string.widget_accessibility, streak));
        PendingIntent resume = open(context, id, "continue", "");
        views.setOnClickPendingIntent(R.id.widget_root, resume);
        if (large) {
            int widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 280);
            int heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 140);
            JSONArray pool = snapshot.optJSONArray("concepts");
            JSONObject concept = null;
            WidgetTextFitter.Fit fitted = null;
            if (pool != null && pool.length() > 0) {
                String selected = today.equals(preferences(context).getString("conceptDay", ""))
                    ? preferences(context).getString("conceptId", "") : "";
                for (int i = 0; i < pool.length(); i++) {
                    JSONObject candidate = pool.optJSONObject(i);
                    if (candidate != null && selected.equals(candidate.optString("id"))) {
                        fitted = fitConcept(context, widthDp, heightDp, candidate);
                        if (fitted != null) {
                views.setViewVisibility(R.id.widget_excerpt, View.VISIBLE);
                views.setViewVisibility(R.id.widget_continue, View.VISIBLE);
                views.setInt(R.id.widget_concept_title, "setMaxLines", 2);
                views.setInt(R.id.widget_excerpt, "setMaxLines", 8);
                views.setTextViewText(R.id.widget_continue, context.getString(fitted.compactAction ? R.string.widget_compact_action : R.string.widget_continue)); concept = candidate; break; }
                    }
                }
                // A cached concept may no longer fit after a resize, font-size
                // change, or upgrade from the older, longer excerpt cache.
                int first = WidgetCalendar.conceptIndex(today, pool.length());
                for (int i = 0; concept == null && i < pool.length(); i++) {
                    JSONObject candidate = pool.optJSONObject((first + i) % pool.length());
                    if (candidate == null) continue;
                    fitted = fitConcept(context, widthDp, heightDp, candidate);
                    if (fitted != null) concept = candidate;
                }
            }
            if (concept == null) {
                views.setTextViewText(R.id.widget_concept_title, context.getString(R.string.widget_compact_title));
                views.setTextViewText(R.id.widget_excerpt, context.getString(R.string.widget_compact_excerpt));
                fitted = WidgetTextFitter.fit(context, widthDp, heightDp,
                    context.getString(R.string.widget_compact_title),
                    context.getString(R.string.widget_compact_excerpt), "", false);
                views.setOnClickPendingIntent(R.id.widget_theory_panel, resume);
                if (fitted == null) {
                    // Very large accessibility fonts: show a compact tap target,
                    // never a partially visible learning explanation.
                    views.setViewVisibility(R.id.widget_concept_heading, View.GONE);
                    views.setViewVisibility(R.id.widget_excerpt, View.GONE);
                    views.setViewVisibility(R.id.widget_formula, View.GONE);
                    views.setViewVisibility(R.id.widget_continue, View.GONE);
                    views.setTextViewTextSize(R.id.widget_concept_title, android.util.TypedValue.COMPLEX_UNIT_SP, 11);
                }
            } else {
                String conceptId = concept.optString("id", "");
                preferences(context).edit().putString("conceptDay", today).putString("conceptId", conceptId).apply();
                views.setTextViewText(R.id.widget_concept_title, concept.optString("title", ""));
                views.setTextViewText(R.id.widget_excerpt, concept.optString("excerpt", ""));
                views.setTextViewText(R.id.widget_formula, concept.optString("formula", ""));
                views.setOnClickPendingIntent(R.id.widget_theory_panel, open(context, id, "concept", conceptId));
            }
            if (fitted != null) {
                views.setTextViewTextSize(R.id.widget_concept_title, android.util.TypedValue.COMPLEX_UNIT_SP, fitted.titleSp);
                views.setTextViewTextSize(R.id.widget_excerpt, android.util.TypedValue.COMPLEX_UNIT_SP, fitted.bodySp);
                views.setTextViewTextSize(R.id.widget_formula, android.util.TypedValue.COMPLEX_UNIT_SP, fitted.formulaSp);
                views.setViewVisibility(R.id.widget_formula, fitted.showFormula ? View.VISIBLE : View.GONE);
                views.setViewVisibility(R.id.widget_concept_heading, fitted.showHeading ? View.VISIBLE : View.GONE);
            }
            views.setOnClickPendingIntent(R.id.widget_continue, resume);
        }
        manager.updateAppWidget(id, views);
    }

    private static WidgetTextFitter.Fit fitConcept(Context context, int width, int height, JSONObject concept) {
        return WidgetTextFitter.fit(context, width, height, concept.optString("title", ""),
            concept.optString("excerpt", ""), concept.optString("formula", ""), true);
    }

    private static PendingIntent open(Context context, int id, String action, String conceptId) {
        Intent intent = new Intent(context, MainActivity.class)
            .setData(new android.net.Uri.Builder().scheme("almath-widget").authority(context.getPackageName()).appendPath(String.valueOf(id)).appendPath(action).build())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(OPEN_ACTION, action).putExtra(OPEN_CONCEPT, conceptId);
        return PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
