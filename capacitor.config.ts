import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.taptapdesign.cubecrash',
  appName: 'CubeCrash',
  webDir: 'dist',
  // Keep native splash visible until we explicitly hide it (prevents white flash before loader)
  backgroundColor: '#f3eee8',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      launchShowDuration: 1200,
      backgroundColor: '#f3eee8',
      showSpinner: false
    }
  },
  ios: {
    orientation: 'portrait'
  }
};

export default config;
