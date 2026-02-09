/**
 * Node.js `url` module shim — wraps WHATWG URL + legacy parse/format.
 * @module shims/url
 */

const _URL = globalThis.URL;
const _URLSearchParams = globalThis.URLSearchParams;
export { _URL as URL, _URLSearchParams as URLSearchParams };

export interface UrlObject {
  protocol?: string | null;
  slashes?: boolean | null;
  auth?: string | null;
  host?: string | null;
  hostname?: string | null;
  port?: string | null;
  pathname?: string | null;
  search?: string | null;
  query?: string | Record<string, string> | null;
  hash?: string | null;
  path?: string | null;
  href?: string;
}

export function parse(urlStr: string, parseQuery?: boolean): UrlObject {
  try {
    const u = new URL(urlStr);
    const result: UrlObject = {
      protocol: u.protocol,
      slashes: u.protocol.endsWith(':'),
      auth: u.username ? (u.password ? `${u.username}:${u.password}` : u.username) : null,
      host: u.host,
      hostname: u.hostname,
      port: u.port || null,
      pathname: u.pathname,
      search: u.search || null,
      hash: u.hash || null,
      path: u.pathname + (u.search || ''),
      href: u.href,
    };

    if (parseQuery) {
      const query: Record<string, string> = {};
      u.searchParams.forEach((v, k) => { query[k] = v; });
      result.query = query;
    } else {
      result.query = u.search ? u.search.slice(1) : null;
    }

    return result;
  } catch {
    // Fallback for relative URLs
    return { pathname: urlStr, href: urlStr, protocol: null, host: null, hostname: null, port: null, search: null, hash: null, path: urlStr, query: null, auth: null, slashes: null };
  }
}

export function format(urlObj: UrlObject): string {
  if (urlObj.href) return urlObj.href;

  let result = '';
  if (urlObj.protocol) {
    result += urlObj.protocol;
    if (!result.endsWith(':')) result += ':';
    if (urlObj.slashes) result += '//';
  }

  if (urlObj.auth) result += urlObj.auth + '@';
  if (urlObj.hostname) result += urlObj.hostname;
  if (urlObj.port) result += ':' + urlObj.port;
  if (urlObj.pathname) result += urlObj.pathname;

  if (urlObj.search) {
    result += urlObj.search.startsWith('?') ? urlObj.search : '?' + urlObj.search;
  } else if (urlObj.query) {
    if (typeof urlObj.query === 'string') {
      result += '?' + urlObj.query;
    } else {
      const params = new URLSearchParams(urlObj.query);
      result += '?' + params.toString();
    }
  }

  if (urlObj.hash) {
    result += urlObj.hash.startsWith('#') ? urlObj.hash : '#' + urlObj.hash;
  }

  return result;
}

export function resolve(from: string, to: string): string {
  return new URL(to, from).href;
}

export function pathToFileURL(filepath: string): URL {
  return new URL('file://' + filepath);
}

export function fileURLToPath(url: string | URL): string {
  const u = typeof url === 'string' ? new URL(url) : url;
  if (u.protocol !== 'file:') throw new TypeError('Must be a file URL');
  return u.pathname;
}

const urlModule = {
  URL: _URL, URLSearchParams: _URLSearchParams, parse, format, resolve, pathToFileURL, fileURLToPath,
};

export default urlModule;
