import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.artproject.app',
  appName: 'ART PROJECT',
  webDir: 'out',
  plugins: {
    GoogleSignIn: {
      clientId: '758449083268-55rok7lteipnqelck99e557b1lkhu5k8.apps.googleusercontent.com',
      scopes: ['email', 'profile']
    }
  }
};

export default config;
