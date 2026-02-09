/**
 * Node.js `querystring` module shim.
 * @module shims/querystring
 */

function escape(str: string): string {
  return encodeURIComponent(str);
}

function unescape(str: string): string {
  return decodeURIComponent(str.replace(/\+/g, ' '));
}

function stringify(
  obj: Record<string, unknown>,
  sep: string = '&',
  eq: string = '=',
): string {
  const pairs: string[] = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const encodedKey = escape(key);

    if (Array.isArray(value)) {
      for (const item of value) {
        pairs.push(`${encodedKey}${eq}${escape(String(item))}`);
      }
    } else if (value !== undefined && value !== null) {
      pairs.push(`${encodedKey}${eq}${escape(String(value))}`);
    } else {
      pairs.push(`${encodedKey}${eq}`);
    }
  }
  return pairs.join(sep);
}

function parse(
  str: string,
  sep: string = '&',
  eq: string = '=',
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  if (!str || str.length === 0) return result;

  const pairs = str.split(sep);
  for (const pair of pairs) {
    const idx = pair.indexOf(eq);
    let key: string;
    let value: string;

    if (idx >= 0) {
      key = unescape(pair.slice(0, idx));
      value = unescape(pair.slice(idx + eq.length));
    } else {
      key = unescape(pair);
      value = '';
    }

    if (key in result) {
      const existing = result[key]!;
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

const querystringModule = {
  parse,
  stringify,
  escape,
  unescape,
  encode: stringify,
  decode: parse,
};

export { parse, stringify, escape, unescape };
export const encode = stringify;
export const decode = parse;
export default querystringModule;
