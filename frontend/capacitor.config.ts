import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.artproject.app',
  appName: 'ART PROJECT',
  webDir: 'out',
  plugins: {
    GoogleSignIn: {
      clientId: '888211169337-6u8trsph6578m9e0799rj0vnh5gu59m2.apps.googleusercontent.com',
      scopes: ['email', 'profile']
    }
  }
};

export default config;
