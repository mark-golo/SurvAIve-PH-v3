package ph.survaive.app;

import com.getcapacitor.BridgeActivity;
import ph.survaive.app.plugins.SmsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
