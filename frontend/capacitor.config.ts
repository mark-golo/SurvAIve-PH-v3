import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ph.survaive.app',
  appName: 'SurvAIve PH',
  webDir: 'dist',

  // ── Server ───────────────────────────────────────────────────────────────────
  // Production: bundled dist/ is served from the WebView (no URL needed).
  // Development: uncomment `url` and set it to your dev machine's LAN IP so
  //              Android can reach Vite's dev server over the same Wi-Fi network.
  //
  // server: {
  //   url: 'http://192.168.x.x:5173',
  //   cleartext: true,           // allows HTTP (not just HTTPS) to the dev server
  // },

  // ── Plugin defaults ───────────────────────────────────────────────────────────
  plugins: {
    Geolocation: {
      // Request precise GPS (required for responder tracking + victim SOS coords)
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#00d4ff',
      sound: 'beep.wav',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // MeshNetwork is a custom Capacitor plugin — no JSON config needed here.
    // See: android/app/src/main/java/ph/survaive/app/MeshNetworkPlugin.kt
  },

  // ── Android-specific ─────────────────────────────────────────────────────────
  android: {
    // Allow HTTP cleartext traffic to the XAMPP local server (no TLS on LAN)
    allowMixedContent: true,
    // Keep WebView background black to match SurvAIve's dark theme
    backgroundColor: '#050a14',
  },
}

export default config
