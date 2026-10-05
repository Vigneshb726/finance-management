import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android and iOS apps: the built React app (dist/) is bundled inside the app and
 * served locally — there is no `server.url`, so nothing is loaded from the internet.
 * Data lives in an encrypted SQLite database on the device.
 */
const config: CapacitorConfig = {
  appId: 'app.finora.finance',
  appName: 'Finora',
  webDir: 'dist',
  android: {
    // Release builds must not be debuggable through the WebView inspector
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    CapacitorSQLite: {
      // SQLCipher encryption; the passphrase is held by the plugin in the Keychain / Android Keystore
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: true,
      iosKeychainPrefix: 'finora',
      iosBiometric: { biometricAuth: false },
      androidIsEncryption: true,
      androidBiometric: { biometricAuth: false },
    },
  },
};

export default config;
