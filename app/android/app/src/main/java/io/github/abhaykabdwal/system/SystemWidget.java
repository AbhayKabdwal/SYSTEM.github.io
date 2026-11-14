package io.github.abhaykabdwal.system;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Home-screen widget: streak, level and today's quest progress. Tap to open the app. */
public class SystemWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context));
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SystemWidget.class));
        for (int id : ids) manager.updateAppWidget(id, build(context));
    }

    private static RemoteViews build(Context context) {
        SharedPreferences p = context.getSharedPreferences(WidgetBridgePlugin.PREFS, Context.MODE_PRIVATE);
        int streak = p.getInt("streak", 0);
        int done = p.getInt("done", 0);
        int total = p.getInt("total", 0);
        String status = p.getString("status", "open");

        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_system);
        v.setTextViewText(R.id.widget_streak, "🔥 " + streak);
        v.setTextViewText(R.id.widget_rank, p.getString("rank", "E") + "-RANK · LV " + p.getInt("level", 1));
        String line;
        if ("verified".equals(status)) line = "✓ QUEST COMPLETE";
        else if ("rest".equals(status)) line = "☾ REST DAY";
        else if ("unverified".equals(status)) line = "◐ ATTACH PROOF";
        else if (total > 0) line = done + " / " + total + " TASKS";
        else line = "QUEST WAITING";
        v.setTextViewText(R.id.widget_quest, line);
        v.setProgressBar(R.id.widget_progress, Math.max(total, 1), Math.min(done, Math.max(total, 1)), false);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }
}
