package io.github.albertom02.almath;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(DailyReminderPlugin.class);
        registerPlugin(ProgressBackupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
