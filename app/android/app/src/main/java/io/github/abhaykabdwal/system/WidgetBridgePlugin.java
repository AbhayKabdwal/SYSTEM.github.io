package io.github.abhaykabdwal.system;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives today's summary from the web app and refreshes the home-screen widget. */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    static final String PREFS = "system_widget";

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        e.putInt("streak", call.getInt("streak", 0));
        e.putInt("level", call.getInt("level", 1));
        e.putString("rank", call.getString("rank", "E"));
        e.putInt("done", call.getInt("done", 0));
        e.putInt("total", call.getInt("total", 0));
        e.putString("status", call.getString("status", "open"));
        e.putString("quest", call.getString("quest", ""));
        e.apply();
        SystemWidget.updateAll(ctx);
        call.resolve(new JSObject());
    }
}
