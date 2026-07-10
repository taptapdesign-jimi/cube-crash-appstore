export function isNativeDevServerRuntime(): boolean {
  if (typeof window === 'undefined') return false;

  const location = window.location;
  const searchParams = new URLSearchParams(location.search || '');
  const hostname = location.hostname || '';
  const pathname = location.pathname || '';
  const isHttpDevServer = location.protocol === 'http:' || location.protocol === 'https:';
  const isPrivateHost =
    hostname === 'localhost' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  return isHttpDevServer && isPrivateHost && (
    searchParams.has('nativeReload') ||
    pathname.startsWith('/native-dev') ||
    (window as any).__ccNativeDevNoViteClient === true
  );
}

export function isNativeStandaloneRuntime(): boolean {
  if (typeof window === 'undefined') return false;

  const protocol = window.location?.protocol || '';
  const capacitor = (window as any).Capacitor;
  if (protocol === 'capacitor:' || protocol === 'app:') return true;

  try {
    if (typeof capacitor?.isNativePlatform === 'function' && capacitor.isNativePlatform()) {
      return !isNativeDevServerRuntime();
    }
  } catch {}

  return false;
}
