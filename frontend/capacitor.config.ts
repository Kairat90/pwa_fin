const config = {
  appId: 'kz.kairat90.pwafin',
  appName: 'FinUchet',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    // Обход CORS WebView (origin https://localhost). UA без кириллицы — см. MainActivity + main.tsx
    CapacitorHttp: {
      enabled: true
    }
  }
}

export default config
