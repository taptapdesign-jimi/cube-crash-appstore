import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.taptapdesign.cubecrash',
  appName: 'CubeCrash',
  webDir: 'dist',
  // Keep native splash visible until we explicitly hide it (prevents white flash before loader)
  backgroundColor: '#FAFAFA', // 🔥 CRITICAL: #FAFAFA matches launch screen
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 300, // 🔥 SMOOTHER: Longer fade for premium feel
      launchShowDuration: 1200,
      backgroundColor: '#FAFAFA', // 🔥 CRITICAL: #FAFAFA matches launch screen
      showSpinner: false
    }
  },
  ios: {
    orientation: 'portrait'
  }
};

export default config;
