/**
 * Prototip (/lab) rotası, gerçek ilerleme sağlayıcısının DIŞINDA çalışmalıdır; böylece açılışta
 * diskten ilerleme okunmaz ve yedek kaydı yazılmaz. Yalnızca bayrak açık (derleme "1") VE yol /lab ise
 * sağlayıcı atlanır. Bayraksız yapıda /lab ana sayfaya yönlenir ve sağlayıcı her zaman vardır.
 */
export function isIsolatedLabRoute(flag: string | undefined, pathname: string): boolean {
  return flag === '1' && (pathname === '/lab' || pathname.startsWith('/lab/'));
}
