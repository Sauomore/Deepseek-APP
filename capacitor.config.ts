import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor configuration.
 *
 * `androidScheme: 'https'` gives the WebView the origin `https://localhost`,
 * which is exactly what the DeepSeek API needs for its CORS preflight (verified:
 * the API echoes the requesting origin). That lets the app call
 * `api.deepseek.com` directly with the user's key — no proxy server involved.
 */
const config: CapacitorConfig = {
  appId: 'com.deepseek.mobile',
  appName: 'Deepseek APP',
  webDir: 'dist',
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'localhost',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT',
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
}

export default config
