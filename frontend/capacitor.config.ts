import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.artproject.app',
  appName: 'ART PROJECT',
  webDir: 'out',
  plugins: {
    GoogleSignIn: {
      clientId: '146007682845-2vom8oclhq6fu2vhqtikv2tqpfsbhk4m.apps.googleusercontent.com',
      scopes: ['email', 'profile'],
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
