import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.artproject.app',
  appName: 'ART PROJECT',
  webDir: 'out',
  plugins: {
    GoogleSignIn: {
      clientId: '888211169337-8ilrpqid0ijhofcd1t8ijjm17tqa0e6v.apps.googleusercontent.com',
      scopes: ['email', 'profile'],
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
