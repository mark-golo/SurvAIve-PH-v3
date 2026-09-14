package ph.survaive.app;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — the single Android Activity that hosts the Capacitor WebView.
 *
 * Plugin registration is handled by Capacitor's auto-discovery via the
 * @CapacitorPlugin annotation on MeshNetworkPlugin.  No manual registerPlugin()
 * call is needed for annotation-based plugins in Capacitor 5+.
 *
 * If auto-discovery does not pick up MeshNetworkPlugin, uncomment the override
 * below and add it explicitly:
 *
 *   @Override
 *   protected void onCreate(Bundle savedInstanceState) {
 *       registerPlugin(MeshNetworkPlugin.class);
 *       super.onCreate(savedInstanceState);
 *   }
 */
public class MainActivity extends BridgeActivity {}
