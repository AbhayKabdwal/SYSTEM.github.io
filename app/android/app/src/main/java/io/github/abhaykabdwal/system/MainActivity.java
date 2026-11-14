package io.github.abhaykabdwal.system;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins must be registered before the bridge starts.
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(HealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
