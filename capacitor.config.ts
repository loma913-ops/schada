import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.schada.app',
  appName: 'Schada',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      insetsHandling: 'disable',
      style: 'DEFAULT',
      hidden: false,
    },
  },
};

export default config;
