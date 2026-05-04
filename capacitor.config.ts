import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tribe.app",
  appName: "Tribe",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
