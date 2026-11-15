package io.github.albertom02.almath;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class StreakWidgetProvider extends AppWidgetProvider {
    protected boolean showsTheory() { return false; }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) HomeWidgets.update(context, manager, id, showsTheory());
        HomeWidgets.schedule(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        HomeWidgets.update(context, manager, id, showsTheory());
    }

    @Override
    public void onDisabled(Context context) { HomeWidgets.schedule(context); }
}
