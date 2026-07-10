import type { CapacitorConfig } from '@capacitor/cli';

// Development workflow default: use dev server unless explicitly disabled for release/prod sync.
const USE_DEV_SERVER = process.env.CAPACITOR_USE_DEV_SERVER !== 'false';

// 🔥 DEV SERVER URL: IP adresa računala za fizički iPhone uređaj
// Za simulator možeš koristiti localhost, ali za fizički uređaj treba IP adresa
const DEV_SERVER_URL = process.env.CAPACITOR_SERVER_URL || 'http://192.168.1.189:5174';

const config: CapacitorConfig = {
  appId: 'com.taptapdesign.cubecrash',
  appName: 'CubeCrash',
  webDir: 'dist',
  // Keep native splash visible until we explicitly hide it (prevents white flash before loader)
  backgroundColor: '#F9F9F9', // 🔥 CRITICAL: #F9F9F9 matches launch screen
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 300, // 🔥 SMOOTHER: Longer fade for premium feel
      launchShowDuration: 1200,
      backgroundColor: '#F9F9F9', // 🔥 CRITICAL: #F9F9F9 matches launch screen
      showSpinner: false
    }
  },
  ios: {
    // iOS specific config
  },
  // Development: use dev server (5174) for live reload and console comparison.
  // Set CAPACITOR_USE_DEV_SERVER=false for App Store/TestFlight/local production builds.
  ...(USE_DEV_SERVER ? {
    server: {
      url: DEV_SERVER_URL,
      cleartext: true // Allow HTTP for local dev server
    }
  } : {})
};

export default config;
