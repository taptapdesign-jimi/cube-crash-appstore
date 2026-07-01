import type { CapacitorConfig } from '@capacitor/cli';

// 🔥 DEVELOPMENT MODE: Set to false to use production bundle instead of dev server
const USE_DEV_SERVER = process.env.CAPACITOR_USE_DEV_SERVER !== 'false'; // Default: true (use dev server)

// 🔥 DEV SERVER URL: IP adresa računala za fizički iPhone uređaj
// Za simulator možeš koristiti localhost, ali za fizički uređaj treba IP adresa
const DEV_SERVER_URL = process.env.CAPACITOR_SERVER_URL || 'http://192.168.1.189:5173';

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
  // 🔥 DEVELOPMENT: Use dev server (5173) for live reload and console comparison
  // App će učitati sa http://192.168.1.189:5173
  // Set CAPACITOR_USE_DEV_SERVER=false to use production bundle instead
  ...(USE_DEV_SERVER ? {
    server: {
      url: DEV_SERVER_URL,
      cleartext: true // Allow HTTP for local dev server
    }
  } : {})
};

export default config;
