(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.1 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.4.1',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],4:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],5:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":3,"./encode":4}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var punycode = require('punycode');
var util = require('./util');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

},{"./util":7,"punycode":2,"querystring":5}],7:[function(require,module,exports){
'use strict';

module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};

},{}],8:[function(require,module,exports){
/**
 * Modules
 */

var has = require('@f/has')
var defaultUnits = require('@f/css-default-units')

/**
 * Expose applyStyles
 */

module.exports = applyStyles

/**
 * Constants
 */

var floatProp = 'cssFloat'
var emptyObj = {}

/**
 * applyStyles
 */

function applyStyles (node, styles, prevStyles) {
  var nodeStyle = node.style

  styles = styles || emptyObj

  if (prevStyles) {
    for (var key in prevStyles) {
      if (has(key, prevStyles) && !has(key, styles)) {
        if (key === 'float') key = floatProp
        nodeStyle[key] = ''
      }
    }
  }

  for (var key in styles) {
    if (has(key, styles)) {
      var val = defaultUnits(key, styles[key])
      if (key === 'float') key = floatProp
      nodeStyle[key] = (val === null || val === undefined) ? '' : val
    }
  }
}

},{"@f/css-default-units":21,"@f/has":44}],9:[function(require,module,exports){
/**
 * Expse equal
 */

module.exports = equal['default'] = equal

/**
 * Check if two arrays are equal.
 * @param  {Array} a array 1
 * @param  {Array} b array 2
 * @return {Boolean}
 */

function equal (a, b) {
  var aLen = a.length
  var bLen = b.length

  if (aLen === bLen) {
    for (var i = 0; i < aLen; ++i) {
      if (a[i] !== b[i]) {
        return false
      }
    }

    return true
  }

  return false
}

},{}],10:[function(require,module,exports){
/**
 * Modules
 */

var reduce = require('@f/reduce-array')
var has = require('@f/has')

/**
 * Expose brackets
 */

module.exports = brackets

/**
 * Brackets
 */

function brackets (obj, path, value) {
  return reduce(function (acc, key, idx, parts) {
    if (idx === parts.length - 1) {
      if (key === '') acc.push(value)
      else acc[key] = value
      return obj
    } else if (key === '') {
      var end = acc[acc.length - 1]

      if (!end || hasPath(end, parts, idx + 1)) {
        end = {}
        acc.push(end)
      }

      return end
    } else {
      return has(key, acc)
        ? acc[key]
        : (acc[key] = isArrayKey(parts[idx + 1]) ? [] : {})
    }
  }, obj, parse(path))
}

/**
 * Helpers
 */

function hasPath (obj, keys, n) {
  var p = obj

  for (var i = n; i < keys.length; i++) {
    var key = keys[i]
    if (!has(key, p)) return false
    p = p[key]
  }

  return true
}

function isArrayKey (key) {
  return key === '' || typeof key === 'number'
}

function parse (path) {
  var parts = path.split('[')

  // Cleaner to implement with map of course, but this
  // avoids allocating the extra array
  for (var i = 0; i < parts.length; i++) {
    var s = parts[i]
    parts[i] = s[s.length - 1] === ']' ? s.slice(0, -1) : s
    parts[i] = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i]
  }

  return parts
}

},{"@f/has":44,"@f/reduce-array":81}],11:[function(require,module,exports){
/**
 * Modules
 */

/**
 * Expose canSelectText
 */

module.exports = canSelectText['default'] = canSelectText

/**
 * Selectable element regex
 */

var selectable = /^text|search|password|tel|url$/

/**
 * canSelectText
 */

function canSelectText (node) {
  return node.tagName === 'INPUT' && selectable.test(node.type)
}

},{}],12:[function(require,module,exports){
/**
 * Expose capitalize
 */

module.exports = capitalize

/**
 * capitalize
 */

function capitalize (str) {
  return str[0].toUpperCase() + str.slice(1)
}

},{}],13:[function(require,module,exports){
/**
 * Modules
 */

var forEach = require('@f/foreach')

/**
 * Expose cloneObj
 */

module.exports = cloneObj['default'] = cloneObj

/**
 * Clone an object.
 * @param  {Object} obj Object to Clone
 * @return {Object}
 */

function cloneObj (obj) {
  var newObj = {}

  forEach(function (val, key) {
    newObj[key] = val
  }, obj)

  return newObj
}

},{"@f/foreach":37}],14:[function(require,module,exports){
/**
 * Modules
 */

var cloneObj = require('@f/clone-obj')
var cloneArray = require('@f/slice')
var isArray = require('@f/is-array')

/**
 * Expose cloneShallow
 */

module.exports = cloneShallow

/**
 * Clone object or array shallow
 * @param  {Object|Array} a object to copy
 * @return {Object|Array}
 */

function cloneShallow (a) {
  return isArray()
    ? cloneArray(a)
    : cloneObj(a)
}

},{"@f/clone-obj":13,"@f/is-array":52,"@f/slice":91}],15:[function(require,module,exports){
/**
 * Modules
 */

var toArray = require('@f/to-array')

/**
 * Expose composeReducers
 */

module.exports = composeReducers['default'] = composeReducers

/**
 * composeReducers
 */

function composeReducers (/* arguments */) {
  var args = toArray(arguments)
  var len = args.length

  return function (state, action) {
    for (var i = 0; i < len; ++i) {
      state = args[i](state, action)
    }

    return state
  }
}

},{"@f/to-array":97}],16:[function(require,module,exports){
/**
 * Modules
 */

var reduce = require('@f/reduce-array')
var identity = require('@f/identity')

/**
 * Expose compose
 */

module.exports = compose

/**
 * Accumulate function compositions.
 * f . g . h ...
 */

function compose () {
  var args = new Array(arguments.length === 0 ? 0 : arguments.length - 1)
  for (var i = 1; i < arguments.length; i++) { args[i-1] = arguments[i] }

  return reduce(
    composeTwo,
    arguments[0] || identity,
    args
  )
}

/**
 * Compose `f` with `g`
 * f . g
 */

function composeTwo (f, g) {
  return function () {
    return f.call(this, g.apply(this, arguments))
  }
}

},{"@f/identity":48,"@f/reduce-array":81}],17:[function(require,module,exports){
/**
 * Expose computePlacement
 */

module.exports = computePlacement

/**
 * computePlacement
 */

function computePlacement (placement, nodeDims, nearRect, opts) {
  opts = opts || {}

  var relative = opts.relative
  var space = opts.space || 0

  var width = nodeDims.width
  var height = nodeDims.height

  var top = relative ? 0 : nearRect.top
  var left = relative ? 0 : nearRect.left
  var vmid = top + (nearRect.height / 2 - height / 2)
  var hmid = left + (nearRect.width / 2 - width / 2)

  switch (placement) {
    case 'left':
      return {
        left: left - (width + space),
        top: vmid
      }
    case 'right':
      return {
        left: left + nearRect.width + space,
        top: vmid
      }
    case 'top':
      return {
        left: hmid,
        top: top - (height + space)
      }
    case 'bottom':
      return {
        left: hmid,
        top: top + nearRect.height + space
      }
  }
}

},{}],18:[function(require,module,exports){
/**
 * Expose containsElement
 */

module.exports = containsElement

/**
 * containsElement
 */

function containsElement (parent, child) {
  while (child && child !== parent)
    child = child.parentNode

  return !!child
}

},{}],19:[function(require,module,exports){
/**
 * Expose createAction
 */

module.exports = createAction['default'] = createAction

/**
 * createAction
 */

function createAction (type, payload, meta) {
  function actionCreator () {
    return {
      type: type,
      payload: payload ? payload.apply(this, arguments) : arguments[0],
      meta: meta ? meta.apply(this, arguments) : meta
    }
  }

  actionCreator.type = type
  actionCreator.toString = toString

  return actionCreator
}

// Allow the function to be used as an object
// key for your reducer maps, obviating the
// need for the additional variable.
function toString () {
  return this.type
}

},{}],20:[function(require,module,exports){
/**
 * Modules
 */

var isSvg = require('@f/is-svg')
var svgNs = require('@f/svg-namespace')

/**
 * Expose createElement
 */

module.exports = createElement['default'] = createElement

/**
 * createElement
 */

function createElement (tag) {
  return isSvg(tag)
    ? document.createElementNS(svgNs, tag)
    : document.createElement(tag)
}

},{"@f/is-svg":62,"@f/svg-namespace":96}],21:[function(require,module,exports){
/**
 * Modules
 */

var unitless = require('@f/css-unitless')

/**
 * Expose cssDefaultUnits
 */

module.exports = cssDefaultUnits

/**
 * cssDefaultUnits
 */

function cssDefaultUnits (key, value) {
  // Skip known unitless properties
  if (unitless[key]) return value
  // Skip non-numerical values
  if (isNaN(value) || value === '' || value === null) return value

  return value + 'px'
}

},{"@f/css-unitless":22}],22:[function(require,module,exports){
/**
 * Modules
 */

var hyphenate = require('@f/hyphenate')

/**
 * Unitless CSS properties
 */

var props = [
  'animationIterationCount',
  'boxFlex',
  'boxFlexGroup',
  'boxOrdinalGroup',
  'columns',
  'columnCount',
  'fillOpacity',
  'flex',
  'flexGrow',
  'flexPositive',
  'flexNegative',
  'flexOrder',
  'flexShrink',
  'fontWeight',
  'lineHeight',
  'lineClamp',
  'opacity',
  'order',
  'orphans',
  'stopOpacity',
  'strokeDashOffset',
  'strokeOpacity',
  'strokeWidth',
  'tabSize',
  'widows',
  'zIndex',
  'zoom'
]

/**
 * Expose cssUnitlessProps
 */

module.exports = props
  .reduce(function (acc, prop) {
    acc[prop] = true
    acc[hyphenate(prop)] = true
    return acc
  }, {})

},{"@f/hyphenate":47}],23:[function(require,module,exports){
/**
 * Expose debounce
 */

module.exports = debounce

/**
 * Debounce
 */

function debounce (fn, time) {
  var pending = false

  return function () {
    if (!pending) {
      pending = true
      setTimeout(run, time)
    }
  }

  function run () {
    pending = false
    fn()
  }
}

},{}],24:[function(require,module,exports){
/**
 * Imports
 */

var forEach = require('@f/foreach')

/**
 * defaults
 */

function defaults (obj, def) {
  forEach(maybeSetProp, def)
  return obj

  function maybeSetProp (val, key) {
    if (obj[key] === undefined) {
      obj[key] = val
    }
  }
}

/**
 * Exports
 */

module.exports = defaults

},{"@f/foreach":37}],25:[function(require,module,exports){
/**
 * domEvents
 */

var domEvents = [
  'abort',
  'animationend',
  'animationiteration',
  'animationstart',
  'blur',
  'canplay',
  'canplaythrough',
  'change',
  'click',
  'contextmenu',
  'copy',
  'cut',
  'dblclick',
  'drag',
  'dragend',
  'dragenter',
  'dragexit',
  'dragleave',
  'dragover',
  'dragstart',
  'drop',
  'durationchange',
  'emptied',
  'encrypted',
  'ended',
  'error',
  'focus',
  'focusin',
  'focusout',
  'hashchange',
  'input',
  'invalid',
  'keydown',
  'keypress',
  'keyup',
  'load',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'mousedown',
  'mouseenter',
  'mouseleave',
  'mousemove',
  'mouseout',
  'mouseover',
  'mouseup',
  'paste',
  'pause',
  'play',
  'playing',
  'popstate',
  'progress',
  'ratechange',
  'reset',
  'resize',
  'scroll',
  'seeked',
  'seeking',
  'select',
  'stalled',
  'submit',
  'suspend',
  'timeupdate',
  'touchcancel',
  'touchend',
  'touchmove',
  'touchstart',
  'transitionend',
  'unload',
  'volumechange',
  'waiting',
  'wheel'
]

/**
 * Expose domEvents
 */

module.exports = domEvents

},{}],26:[function(require,module,exports){
/**
 * Modules
 */

var isDomLoaded = require('@f/is-dom-loaded')

/**
 * Expose domready
 */

module.exports = domready

/**
 * Check whether the DOM is ready already, and setup
 * a listener if necessary
 */

var fns = []

if (!isDomLoaded()) {
  document.addEventListener('DOMContentLoaded', function listener () {
    document.removeEventListener('DOMContentLoaded', listener)

    if (!isDomLoaded()) {
      window.addEventListener('load', function loadListener () {
        onLoad()
        window.removeEventListener('load', loadListener)
      })
    } else {
      onLoad()
    }
  })
}

function onLoad () {
  fns.forEach(function (fn) { fn() })
  fns.length = 0
}

/**
 * domready
 */

function domready (fn) {
  isDomLoaded() ? setTimeout(fn) : fns.push(fn)
}

},{"@f/is-dom-loaded":53}],27:[function(require,module,exports){
/**
 * Expose elementRect
 */

module.exports = elementRect

/**
 * elementRect
 */

function elementRect (node, offsetParent) {
  if (offsetParent === true) offsetParent = node.offsetParent

  var rect = node.getBoundingClientRect()
  var prect = offsetParent
    ? offsetParent.getBoundingClientRect()
    : {left: 0, top: 0}

  return {
    left: rect.left - prect.left,
    top: rect.top - prect.top,
    width: rect.width,
    height: rect.height
  }
}

},{}],28:[function(require,module,exports){
/**
 * Expose emptyElement
 */

module.exports = emptyElement

/**
 * emptyElement
 */

function emptyElement (el) {
  var node

  while (node = el.firstChild) {
    el.removeChild(node)
  }

  return el
}

},{}],29:[function(require,module,exports){
arguments[4][9][0].apply(exports,arguments)
},{"dup":9}],30:[function(require,module,exports){
/**
 * Expose equal
 */

module.exports = equal['default'] = equal

/**
 * Check if two objects are equal.
 * @param  {Object} a object 1
 * @param  {Object} b object 2
 * @return {Boolean}
 */

function equal (a, b) {
  var aKeys = Object.keys(a)
  var bKeys = Object.keys(b)
  var aLen = aKeys.length
  var bLen = bKeys.length

  if (aLen === bLen) {
    for (var i = 0; i < aLen; ++i) {
      var key = aKeys[i]

      if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key) || a[key] !== b[key]) {
        return false
      }
    }

    return true
  }

  return false
}

},{}],31:[function(require,module,exports){
/**
 * Modules
 */

var isObject = require('@f/is-object')
var isArray = require('@f/is-array')
var equalArray = require('@f/equal-array')
var equalObj = require('@f/equal-obj')

/**
 * Expose equal
 */

module.exports = equal

/**
 * equal
 */

function equal (a, b) {
  if (isObject(a) && isObject(b)) return equalObj(a, b)
  if (isArray(a) && isArray(b)) return equalArray(a, b)

  return a === b
}

},{"@f/equal-array":29,"@f/equal-obj":30,"@f/is-array":52,"@f/is-object":60}],32:[function(require,module,exports){
/**
 * Modules
 */

var isFunction = require('@f/is-function')
var isObject = require('@f/is-object')
var keychord = require('@f/keychord')
var isArray = require('@f/is-array')
var over = require('@f/maybe-over')
var map = require('@f/map')

/**
 * Expose eventHandler
 */

module.exports = eventHandler

/**
 * eventHandler
 */

function eventHandler (fn) {
  if (isFunction(fn)) return fn
  if (isArray(fn)) return combine(map(eventHandler, fn))
  if (isObject(fn)) return match(map(eventHandler, fn))
}

/**
 * Match an event handler to conditions generated
 * from the event
 */

function match (obj) {
  return function (e) {
    var chord = eventKey(e)
    var fn = obj[chord]

    if (isFunction(fn)) {
      return fn(e)
    }
  }
}

/**
 * Map a list of handlers over the event
 */

function combine (fns) {
  return function (e) {
    return over(e, fns)
  }
}

/**
 * Generate a string key for an event. Right now this is just equivalent
 * to keychord, but later we could add special keys for other conditions.
 */

function eventKey (e) {
  return keychord(e)
}

},{"@f/is-array":52,"@f/is-function":55,"@f/is-object":60,"@f/keychord":66,"@f/map":71,"@f/maybe-over":72}],33:[function(require,module,exports){
/**
 * Modules
 */

var forEach = require('@f/foreach-obj')

/**
 * Expose extend
 */

module.exports = extend

/**
 * Extend
 */

function extend (dst) {
  for (var i = 1; i < arguments.length; i++) {
    extendTwo(dst, arguments[i])
  }

  return dst
}

function extendTwo (dst, src) {
  forEach(function (val, key) {
    dst[key] = val
  }, src)
}

},{"@f/foreach-obj":36}],34:[function(require,module,exports){
/**
 * Expose focusElement
 */

module.exports = focusElement

/**
 * focusElement
 */

 function focusElement (node) {
   if (node.ownerDocument.activeElement !== node) {
     node.focus()
   }
 }

},{}],35:[function(require,module,exports){
/**
 * Expose forEach
 */

module.exports = forEach['default'] = forEach

/**
 * forEach
 */

function forEach (fn, arr) {
  if (!arr) return

  for (var i = 0, len = arr.length; i < len; ++i) {
    fn.call(this, arr[i], i)
  }
}

},{}],36:[function(require,module,exports){
/**
 * Expose forEach
 */

module.exports = forEach

/**
 * forEach
 */

function forEach (fn, obj) {
  if (!obj) return

  var keys = Object.keys(obj)

  for (var i = 0, len = keys.length; i < len; ++i) {
    var key = keys[i]
    fn.call(this, obj[key], key, i)
  }
}

},{}],37:[function(require,module,exports){
/**
 * Modules
 */

var isObject = require('@f/is-object')
var isArray = require('@f/is-array')
var forEachObj = require('@f/foreach-obj')
var forEachArr = require('@f/foreach-array')

/**
 * Expose foreach
 */

module.exports = forEach['default'] = forEach

/**
 * For each
 * @param  {Function} fn  iterator
 * @param  {Object}   obj object to iterate over
 */

function forEach (fn, a) {
  if (isArray(a)) return forEachArr.call(this, fn, a)
  if (isObject(a)) return forEachObj.call(this, fn, a)
}

},{"@f/foreach-array":35,"@f/foreach-obj":36,"@f/is-array":52,"@f/is-object":60}],38:[function(require,module,exports){
/**
 * Modules
 */

var formElements = require('@f/form-elements')
var slice = require('@f/slice')

/**
 * Constants
 */

var selector = formElements.join(',')

/**
 * Expose formControls
 */

module.exports = formControls

/**
 * formControls
 */

function formControls (form) {
  return slice(form.elements || form.querySelectorAll(selector))
}

},{"@f/form-elements":39,"@f/slice":91}],39:[function(require,module,exports){
/**
 * Form elements
 */

var formElements = [
  'button',
  'fieldset',
  'input',
  'keygen',
  'object',
  'output',
  'select',
  'textarea'
]

/**
 * Expose formElements
 */

module.exports = formElements

},{}],40:[function(require,module,exports){
/**
 * Imports
 */

var iteratorSymbol = require('@f/iterator-symbol')

/**
 * Expose generator
 */

exports.Object = Generator
exports.Function = GeneratorFunction
exports.FunctionPrototype = GeneratorFunctionPrototype

/**
 * Generator
 */

function Generator () {}
function GeneratorFunction () {}
function GeneratorFunctionPrototype () {}

var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype
GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype
GeneratorFunctionPrototype.constructor = GeneratorFunction
GeneratorFunction.displayName = 'GeneratorFunction'

Gp[iteratorSymbol] = function () {
  return this
}

Gp.toString = function () {
  return '[object Generator]'
}

},{"@f/iterator-symbol":65}],41:[function(require,module,exports){
/**
 * Modules
 */

var isString = require('@f/is-string')

/**
 * Expose getProp
 */

module.exports = getProp['default'] = getProp

/**
 * Get propert
 * @param  {Array|String} path path to property
 * @param  {Object} obj object to retrieve property from
 * @return {Mixed} property
 */

function getProp (path, obj) {
  if (isString(path)) {
    path = path.split('.')
  }

  for (var i = 0, len = path.length; i < len && obj; ++i) {
    obj = obj[path[i]]
  }

  return obj
}

},{"@f/is-string":61}],42:[function(require,module,exports){
/**
 * Expose getValue
 */

module.exports = getValue

/**
 * getValue
 */

function getValue (el) {
  switch (type(el)) {
    case 'checkbox':
    case 'radio':
      return el.checked
        ? checkValue(el.getAttribute('value'))
        : false
    case 'select':
      for (var i = 0, len = el.options.length; i < len; i++) {
        var opt = el.options[i]
        if (opt.selected) return opt.value
      }
    default:
      return el.value
  }
}

/**
 * Helpers
 */

function checkValue (value) {
  return null === value ? true : value
}

function type (el) {
  return el.nodeName === 'INPUT'
    ? el.type
    : el.nodeName.toLowerCase()
}

},{}],43:[function(require,module,exports){
/**
 * Modules
 */

var composeReducers = require('@f/compose-reducers')
var isUndefined = require('@f/is-undefined')

/**
 * Expose handleActions
 */

module.exports = handleActions['default'] = handleActions

/**
 * handleActions
 */

function handleActions (map, defaultState) {
  return composeReducers.apply(null, Object
    .keys(map)
    .map(function (type) {
      if (!type) throw new Error('@f/handle-actions: null/undefined passed as an action type. Did you declare your action types below the reducer map?')
      return scopeReducer(type, map[type], defaultState)
    }))
}

function scopeReducer (type, reducer, defaultState) {
  return function (state, action) {
    return action.type === type
      ? reducer(state, action.payload)
      : (isUndefined(state) ? defaultState : state)
  }
}

},{"@f/compose-reducers":15,"@f/is-undefined":63}],44:[function(require,module,exports){
/**
 * Expose has
 */

module.exports = has['default'] = has

/**
 * Vars
 */

var hasOwn = Object.prototype.hasOwnProperty

/**
 * has
 */

function has (prop, obj) {
  return hasOwn.call(obj, prop)
}

},{}],45:[function(require,module,exports){
/**
 * Expose hashStr
 */

module.exports = hashStr

/**
 * hashStr
 */

function hashStr (str) {
  var hash = 0

  for (var i = 0, len = str.length; i < len; ++i) {
      var c = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + c
      hash |= 0
  }

  return hash
}

},{}],46:[function(require,module,exports){
/**
 * Shorthand for true to make the file a bit smaller
 */

var t = true

/**
 * Expose HTML attributes
 */

module.exports = {
  abbr: t,
  accept: t,
  'accept-charset': t,
  accesskey: t,
  action: t,
  allowfullscreen: t,
  allowtransparency: t,
  alt: t,
  async: t,
  autocomplete: t,
  autofocus: t,
  autoplay: t,
  cellpadding: t,
  cellspacing: t,
  challenge: t,
  charset: t,
  checked: t,
  cite: t,
  class: t,
  class: t,
  cols: t,
  colspan: t,
  command: t,
  content: t,
  contenteditable: t,
  contextmenu: t,
  controls: t,
  coords: t,
  crossorigin: t,
  data: t,
  datetime: t,
  default: t,
  defer: t,
  dir: t,
  disabled: t,
  download: t,
  draggable: t,
  dropzone: t,
  enctype: t,
  for: t,
  form: t,
  formaction: t,
  formenctype: t,
  formmethod: t,
  formnovalidate: t,
  formtarget: t,
  frameBorder: t,
  headers: t,
  height: t,
  hidden: t,
  high: t,
  href: t,
  hreflang: t,
  for: t,
  'http-equiv': t,
  icon: t,
  id: t,
  inputmode: t,
  ismap: t,
  itemid: t,
  itemprop: t,
  itemref: t,
  itemscope: t,
  itemtype: t,
  kind: t,
  label: t,
  lang: t,
  list: t,
  loop: t,
  manifest: t,
  max: t,
  maxlength: t,
  media: t,
  mediagroup: t,
  method: t,
  min: t,
  minlength: t,
  multiple: t,
  muted: t,
  name: t,
  novalidate: t,
  open: t,
  optimum: t,
  pattern: t,
  ping: t,
  placeholder: t,
  poster: t,
  preload: t,
  radiogroup: t,
  readonly: t,
  rel: t,
  required: t,
  role: t,
  rows: t,
  rowspan: t,
  sandbox: t,
  scope: t,
  scoped: t,
  scrolling: t,
  seamless: t,
  selected: t,
  shape: t,
  size: t,
  sizes: t,
  sortable: t,
  span: t,
  spellcheck: t,
  src: t,
  srcdoc: t,
  srcset: t,
  start: t,
  step: t,
  style: t,
  tabindex: t,
  target: t,
  title: t,
  translate: t,
  type: t,
  typemustmatch: t,
  usemap: t,
  value: t,
  width: t,
  wmode: t,
  wrap: t
}

},{}],47:[function(require,module,exports){
/**
 * Expose hyphenate
 */

module.exports = hyphenate

/**
 * Constants
 */

var upperCasePattern = /([A-Z])/g

/**
 * hyphenate
 */

function hyphenate (str) {
  return str.replace(upperCasePattern, dashLower)
}

function dashLower (c) {
  return '-' + c.toLowerCase()
}

},{}],48:[function(require,module,exports){
/**
 * Modules
 */

/**
 * Expose identity
 */

module.exports = identity['default'] = identity

/**
 * A function that returns its first arg.
 * @param  {Any} val
 * @return {Any} val
 */
function identity (val) {
  return val
}

},{}],49:[function(require,module,exports){
/**
 * Modules
 */

var reduce = require('@f/reduce-array')
var identity = require('@f/identity')

/**
 * Expose index
 */

module.exports = index

/**
 * index
 */

function index (keyFn, itemFn, list) {
  if (arguments.length === 2) {
    list = itemFn
    itemFn = identity
  }

  if (arguments.length === 1) {
    list = keyFn
    keyFn = identity
    itemFn = identity
  }

  return reduce(function (map, item, idx) {
    map[keyFn(item)] = itemFn(item, idx)
    return map
  }, {}, list)
}

},{"@f/identity":48,"@f/reduce-array":81}],50:[function(require,module,exports){
/**
 * Expose inputAttrs
 */

module.exports = [
  'type',
  'accept',
  'accesskey',
  'autocapitalize',
  'autocomplete',
  'autocorrect',
  'autofocus',
  'autosave',
  'checked',
  'disabled',
  'form',
  'formaction',
  'formenctype',
  'formmethod',
  'formnovalidate',
  'formtarget',
  'height',
  'incremental',
  'inputmode',
  'list',
  'max',
  'maxlength',
  'min',
  'minlength',
  'multiple',
  'name',
  'pattern',
  'placeholder',
  'readonly',
  'required',
  'results',
  'selectionDirection',
  'size',
  'spellcheck',
  'src',
  'step',
  'tabindex',
  'usemap',
  'value',
  'width'
]

},{}],51:[function(require,module,exports){
/**
 * Expose insertElement
 */

module.exports = insertElement['default'] = insertElement

/**
 * insertElement
 */

function insertElement (parent, node, pos) {
  return parent.insertBefore(node, parent.childNodes[pos] || null)
}

},{}],52:[function(require,module,exports){
/**
 * Expose isArray
 */

module.exports = isArray['default'] = isArray

/**
 * isArray
 */

function isArray (val) {
  return Array.isArray(val)
}

},{}],53:[function(require,module,exports){
/**
 * Expose isDomLoaded
 */

module.exports = isDomLoaded

/**
 * isDomLoaded
 */

function isDomLoaded () {
  return document.readyState === 'complete' || (document.readyState !== 'loading' && !document.documentElement.doScroll)
}

},{}],54:[function(require,module,exports){
/**
 * Constants
 */

var types = /^(?:submit|button|image|reset|file)$/i
var names = /^(?:input|select|textarea|keygen)$/i
var check = /^(?:checkbox|radio)$/i

/**
 * Expose isSubmittable
 */

module.exports = isSubmittable

/**
 * isSubmittable
 */

function isSubmittable (el) {
  return !el.disabled
    && el.name
    && !types.test(el.type)
    && names.test(el.nodeName)
    && (!check.test(el.type) || el.checked)
}

},{}],55:[function(require,module,exports){
/**
 * Modules
 */

/**
 * Expose isFunction
 */

module.exports = isFunction['default'] = isFunction

/**
 * isFunction
 */

function isFunction (value) {
  return typeof value === 'function'
}

},{}],56:[function(require,module,exports){
/**
 * Modules
 */

var isFunction = require('@f/is-function')

/**
 * Expose isFunctor
 */

module.exports = isFunctor

/**
 * isFunctor
 */

function isFunctor (val) {
  return val && isFunction(val.map)
}

},{"@f/is-function":55}],57:[function(require,module,exports){
/**
 * Imports
 */

var isFunction = require('@f/is-function')

/**
 * Expose isGenerator
 */

module.exports = isGenerator['default'] = isGenerator

/**
 * Check if `fn` is a generator function.
 *
 * @param {Mixed} fn
 * @return {Boolean}
 */

function isGenerator (fn) {
  var ctor = isFunction(fn) && fn.constructor
  if (!ctor) return false
  return ctor.name === 'GeneratorFunction' || ctor.displayName === 'GeneratorFunction'
}

},{"@f/is-function":55}],58:[function(require,module,exports){
/**
 * Modules
 */

var isFunction = require('@f/is-function')

/**
 * Expose isIterator
 */

module.exports = isIterator['default'] = isIterator

/**
 * Check if iterator
 * @param  {Mixed}  obj Object to check interface of.
 * @return {Boolean}
 */

function isIterator (obj, strict) {
  return !!obj &&
    isFunction(obj.next) &&
    (obj.throw ? isFunction(obj.throw) : !strict)
}

},{"@f/is-function":55}],59:[function(require,module,exports){
/**
 * Modules
 */

/**
 * Expose isNumber
 */

module.exports = isNumber['default'] = isNumber

/**
 * isNumber
 */

function isNumber (value) {
  return typeof value === 'number'
}

},{}],60:[function(require,module,exports){
/**
 * Modules
 */

var isFunction = require('@f/is-function')

/**
 * Expose isObject
 */

module.exports = isObject

/**
 * Constants
 */

var objString = toString(Object)

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject (val) {
  return !!val && (val.constructor === Object || isObjectString(val.constructor))
}

function isObjectString (val) {
  return !!val && isFunction(val) && toString(val) === objString
}

function toString (val) {
  return Function.prototype.toString.call(val)
}

},{"@f/is-function":55}],61:[function(require,module,exports){
/**
 * Expose isString
 */

module.exports = isString['default'] = isString

/**
 * Check if string
 * @param  {Mixed}  value
 * @return {Boolean}
 */
function isString (value) {
  return typeof value === 'string'
}

},{}],62:[function(require,module,exports){
/**
 * Modules
 */

var svgElements = require('@f/svg-elements')
var has = require('@f/has')

/**
 * Expose isSvg
 */

module.exports = isSvg['default'] = isSvg

/**
 * Vars
 */

var svgMap = svgElements
  .reduce(function (acc, name) {
    acc[name] = true
    return acc
  }, {})

/**
 * isSvg
 */

function isSvg (name) {
  return has(name, svgMap)
}

},{"@f/has":44,"@f/svg-elements":95}],63:[function(require,module,exports){
/**
 * Expose isUndefined
 */

module.exports = isUndefined['default'] = isUndefined

/**
 * Check if undefined.
 * @param  {Mixed}  value
 * @return {Boolean}
 */

function isUndefined (value) {
  return typeof value === 'undefined'
}

},{}],64:[function(require,module,exports){
/**
 * Expose isValidAttr
 */

module.exports = isValidAttr

/**
 * isValidAttr
 */

function isValidAttr (val) {
  switch (typeof val) {
    case 'string':
    case 'number':
      return true
    case 'boolean':
      return val
    default:
      return false
  }
}

},{}],65:[function(require,module,exports){
/**
 * Expose iteratorSymbol
 */

module.exports = typeof Symbol === "function"
 && Symbol.iterator
 || "@@iterator"

},{}],66:[function(require,module,exports){
/**
 * Modules
 */

var keycodes = require('@f/keycodes')

/**
 * Expose keychord
 */

module.exports = keychord['default'] = keychord

/**
 * keychord
 */

function keychord (e) {
  var chord = []

  if (e.ctrlKey) chord.push('ctrl')
  if (e.altKey) chord.push('alt')
  if (e.metaKey) chord.push('command')
  if (e.shiftKey) chord.push('shift')

  var name = keycodes[e.which]
  if (chord.indexOf(name) === -1) {
    chord.push(name)
  }

  return chord.join('+')
}

},{"@f/keycodes":67}],67:[function(require,module,exports){
/**
 * Expose keycodes
 */

var keycodes = module.exports = {
  8: 'backspace',
  9: 'tab',
  13: 'enter',
  16: 'shift',
  17: 'ctrl',
  18: 'alt',
  19: 'pause',
  20: 'caps_lock',
  27: 'esc',
  32: 'space',
  33: 'page_up',
  34: 'page_down',
  35: 'end',
  36: 'home',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  45: 'insert',
  46: 'delete',
  91: 'command',
  93: 'right_click',
  106: 'numpad_*',
  107: 'numpad_+',
  109: 'numpad_-',
  110: 'numpad_.',
  111: 'numpad_/',
  144: 'num_lock',
  145: 'scroll_lock',
  182: 'my_computer',
  183: 'my_calculator',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'"
}

// lower case chars
for (var i = 97; i < 123; i++) {
  keycodes[i - 32] = String.fromCharCode(i)
}

// numbers
for (var j = 48; j < 58; j++) {
  keycodes[j] = j - 48
}

// function keys
for (var k = 1; k < 13; k++) {
  keycodes[k + 111] = 'f' + k
}

// numpad keys
for (var l = 0; l < 10; l++) {
  keycodes[l + 96] = 'numpad_' + l
}

},{}],68:[function(require,module,exports){
/**
 * Expose map
 */

module.exports = map['default'] = map

/**
 * Map array
 * @param  {Function} fn
 * @param  {Array} arr
 * @return {Array}
 */

function map (fn, arr) {
  var len = arr.length
  var result = new Array(len)
  var self = this

  for (var i = 0; i < len; ++i) {
    result[i] = fn.call(self, arr[i], i)
  }

  return result
}

},{}],69:[function(require,module,exports){
/**
 * Modules
 */

var toGenerator = require('@f/to-generator')
var slice = require('@f/slice')
var isFunction = require('@f/is-function')
var isIterator = require('@f/is-iterator')

/**
 * Expose mapGen
 */

module.exports = map['default'] = map

/**
 * Map over generator
 * @param  {Function} fn
 * @param  {Generator} gen
 * @return {Generator}
 */

function map (fn, gen) {
  var ctx = this
  return toGenerator(function () {
    var self = this
    var it = isFunction(gen) ? gen.apply(ctx, slice(arguments)) : gen
    var i = 0

    if (!isIterator(it, true)) {
      throw TypeError('`gen` must return an iterator or be an iterator.')
    }

    self.next = next
    self.throw = error

    function next (arg) {
      return map(it.next(arg))
    }

    function error (err) {
      return map(it.throw(err))
    }

    function map (next) {
      if (next.done) return next
      try {
        next.value = fn.call(ctx, next.value, i++)
      } catch (e) {
        return error(e)
      }
      return next
    }
  })
}

},{"@f/is-function":55,"@f/is-iterator":58,"@f/slice":91,"@f/to-generator":98}],70:[function(require,module,exports){
/**
 * Expose mapObj
 */

module.exports = map

/**
 * Map obj
 * @param  {Function} fn  map
 * @param  {Object}   obj object over which to map
 * @param  {Object}   ctx context used to map call
 * @return {Object}
 */

function map (fn, obj) {
  var result = {}
  var keys = Object.keys(obj)

  for (var i = 0, len = keys.length; i < len; ++i) {
    var key = keys[i]
    result[key] = fn.call(this, obj[key], key)
  }

  return result
}

},{}],71:[function(require,module,exports){
/**
 * Modules
 */

var isArray = require('@f/is-array')
var mapArray = require('@f/map-array')
var isObject = require('@f/is-object')
var mapObj = require('@f/map-obj')
var isGenerator = require('@f/is-generator')
var mapGen = require('@f/map-gen')
var isIterator = require('@f/is-iterator')
var isFunctor = require('@f/is-functor')

/**
 * Expose map
 */

module.exports = map['default'] = map

/**
 * Map container
 * @param  {Function} fn
 * @param  {Mixed}   val val to map
 * @return {Mixed}   same type as val
 */

function map (fn, val) {
  if (isFunctor(val)) {
    // use faster map for arrays
    if (isArray(val) && val.map === Array.prototype.map) {
      return mapArray(fn, val)
    } else {
      return val.map(fn)
    }
  }
  if (isGenerator(val) || isIterator(val)) return mapGen(fn, val)
  if (isObject(val)) return mapObj(fn, val)
  throw new TypeError('You may only map an array, an object, a generator, or a functor, but the following `val` was passed: "' + String(val) + '"')
}

},{"@f/is-array":52,"@f/is-functor":56,"@f/is-generator":57,"@f/is-iterator":58,"@f/is-object":60,"@f/map-array":68,"@f/map-gen":69,"@f/map-obj":70}],72:[function(require,module,exports){
/**
 * Modules
 */

var isFunction = require('@f/is-function')
var map = require('@f/map-array')

/**
 * Expose maybeOver
 */

module.exports = maybeOver

/**
 * maybeOver
 */

function maybeOver (value, fns) {
  return map(function (maybeFn) {
    return isFunction(maybeFn)
      ? maybeFn(value)
      : maybeFn
  }, fns)
}

},{"@f/is-function":55,"@f/map-array":68}],73:[function(require,module,exports){
/**
 * Exports
 */

module.exports = noop['default'] = noop

/**
 * Noop
 */

function noop () {}

},{}],74:[function(require,module,exports){
/**
 * objectEqual
 */

function objectEqual (a, b) {
  var aKeys = Object.keys(a)
  var bKeys = Object.keys(b)
  var aLen = aKeys.length
  var bLen = bKeys.length

  if (aLen === bLen) {
    for (var i = 0; i < aLen; ++i) {
      var key = aKeys[i]

      if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key) || a[key] !== b[key]) {
        return false
      }
    }

    return true
  }

  return false
}

/**
 * Exports
 */

module.exports = objectEqual

},{}],75:[function(require,module,exports){
/**
 * Expose offsetParent
 */

module.exports = offsetParent

/**
 * offsetParent
 */

function offsetParent (node) {
  while ((node = node.parentNode) && node !== document.body) {
    var pos = node.style.position

    if (pos === 'relative' || pos === 'fixed' || pos === 'absolute') {
      break
    }
  }

  return node
}

},{}],76:[function(require,module,exports){
/**
 * Imports
 */

var isFunction = require('@f/is-function')
var forEach = require('@f/foreach-obj')
var isObject = require('@f/is-object')
var identity = require('@f/identity')
var isArray = require('@f/is-array')
var index = require('@f/index')

/**
 * Object omit wrapper that curries
 * and indexes if possible
 */

function omit (keys, obj) {
  if (arguments.length === 1) {
    if (isArray(keys)) {
      keys = index(identity, T, keys)
    }

    return function (obj) {
      return internalOmit.call(this, keys, obj)
    }
  }

  return internalOmit.call(this, keys, obj)
}

/**
 * Omit implementation
 */

function internalOmit (keys, obj) {
  var result = {}

  if (isArray(keys)) {
    forEach(function (val, key) {
      if (keys.indexOf(key) === -1) {
        result[key] = val
      }
    }, obj)
  } else if (isObject(keys)) {
    forEach(function (val, key) {
      if (!keys[key]) {
        result[key] = val
      }
    }, obj)
  } else if (isFunction(keys)) {
    var self = this
    forEach(function (val, key) {
      if (!keys.call(self, key)) {
        result[key] = val
      }
    }, obj)
  } else {
    forEach(function (val, key) {
      if (keys !== key) {
        result[key] = val
      }
    }, obj)
  }

  return result
}

/**
 * Helpers
 */

function T () { return true }

/**
 * Exports
 */

module.exports = omit

},{"@f/foreach-obj":36,"@f/identity":48,"@f/index":49,"@f/is-array":52,"@f/is-function":55,"@f/is-object":60}],77:[function(require,module,exports){
/**
 * Expose pick
 */

module.exports = pick

/**
 * Return partial copy of object containing specified subset of keys.
 * @param  {Array} keys
 * @param  {Object} obj  Source
 * @return {Object}
 */

function pick (keys, obj) {
  if ('function' === typeof keys) return pickPredicate(keys, obj)
  if (Array.isArray(keys)) return pickList.apply(null, arguments)
}

function pickPredicate (fn, obj) {
  var copy = {}
  var keys = Object.keys(obj)

  for (var i = 0, len = keys.length; i < len; ++i) {
    var key = keys[i]
    var val = obj[key]

    if (fn(val, key)) {
      copy[key] = val
    }
  }

  return copy
}

function pickList (keys, a, b, c, d, e) {
  if (arguments.length > 6) return pickListLong.apply(null, arguments)

  var copy = {}

  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i]

    if (typeof a[key] !== 'undefined') copy[key] = a[key]
    else if (b && typeof b[key] !== 'undefined') copy[key] = b[key]
    else if (c && typeof c[key] !== 'undefined') copy[key] = c[key]
    else if (d && typeof d[key] !== 'undefined') copy[key] = d[key]
    else if (e && typeof e[key] !== 'undefined') copy[key] = e[key]
  }

  return copy
}

function pickListLong (keys /*, objs */) {
  var objs = []
  for (var i = 1; i < arguments.length; i++) { objs.push(arguments[i]) }

  var copy = {}

  for (var j = 0; j < keys.length; j++) {
    var key = keys[j]

    for (var k = 0; k < objs.length; k++) {
      var obj = objs[k]
      var val = obj[key]

      if (typeof val !== 'undefined') {
        copy[key] = obj[key]
        break
      }
    }
  }

  return copy
}

},{}],78:[function(require,module,exports){
/**
 * Expose popcount
 */

module.exports = popcount

/**
 * popcount
 */

function popcount (x, n) {
  if (n !== undefined) {
    x &= (1 << n) - 1
  }

  x -= x >> 1 & 0x55555555
  x = (x & 0x33333333) + (x >> 2 & 0x33333333)
  x = x + (x >> 4) & 0x0f0f0f0f
  x += x >> 8
  x += x >> 16

  return x & 0x7f
}

},{}],79:[function(require,module,exports){
/**
 * Modules
 */

var getRect = require('@f/element-rect')
var applyStyles = require('@f/apply-styles')
var offsetParent = require('@f/offset-parent')
var computePlacement = require('@f/compute-placement')

/**
 * Expose positionElement
 */

module.exports = positionElement

/**
 * positionElement
 */

function positionElement (node, placement, opts) {
  opts = opts || {}

  var near = opts.near || offsetParent(node)
  var nodeDims = getRect(node)
  var nearRect = getRect(near, true)
  var pos = computePlacement(placement, nodeDims, nearRect, {relative: !opts.near, space: opts.space})

  applyStyles(node, pos)
}

},{"@f/apply-styles":8,"@f/compute-placement":17,"@f/element-rect":27,"@f/offset-parent":75}],80:[function(require,module,exports){
/**
 * Modules
 */

var map = require('@f/map-array')

/**
 * Expose queue
 */

module.exports = queue

/**
 * queue
 */

function queue () {
  var fns = []

  return {
    add: function (fn) { fns.push(fn) },
    flush: function () {
      var result = map(function (fn) { return fn() }, fns)
      fns = []
      return result
    }
  }
}

},{"@f/map-array":68}],81:[function(require,module,exports){
/**
 * Modules
 */

/**
 * Expose reduceArray
 */

module.exports = reduceArray['default'] = reduceArray

/**
 * reduceArray
 */

function reduceArray (cb, init, arr) {
  var len = arr.length
  var acc = init
  if (!arr.length) return init

  for (var i = 0; i < len; i++) {
    acc = cb(acc, arr[i], i, arr)
  }

  return acc
}

},{}],82:[function(require,module,exports){
/**
 * Expose reduceObj
 */

module.exports = reduceObj

/**
 * reduceObj
 */

function reduceObj (fn, acc, obj) {
  if (!obj) return acc

  var keys = Object.keys(obj)

  for (var i = 0, len = keys.length; i < len; ++i) {
    var key = keys[i]
    acc = fn(acc, obj[key], key, obj)
  }

  return acc
}

},{}],83:[function(require,module,exports){
/**
 * Modules
 */

var reduceArray = require('@f/reduce-array')
var reduceObj = require('@f/reduce-obj')
var isObject = require('@f/is-object')
var isArray = require('@f/is-array')

/**
 * Expose reduce
 */

module.exports = reduce

/**
 * reduce
 */

function reduce (fn, acc, container) {
  if (isArray(container)) return reduceArray(fn, acc, container)
  if (isObject(container)) return reduceObj(fn, acc, container)

  return acc
}

},{"@f/is-array":52,"@f/is-object":60,"@f/reduce-array":81,"@f/reduce-obj":82}],84:[function(require,module,exports){
/**
 * Expose removeElement
 */

module.exports = removeElement['default'] = removeElement

/**
 * removeElement
 */

function removeElement (node) {
  return node.parentNode.removeChild(node)
}

},{}],85:[function(require,module,exports){
/**
 * Expose replaceElement
 */

module.exports = replaceElement['default'] = replaceElement

/**
 * replaceElement
 */

function replaceElement (newNode, oldNode) {
  return oldNode.parentNode.replaceChild(newNode, oldNode)
}

},{}],86:[function(require,module,exports){
/**
 * Modules
 */

var brackets = require('@f/brackets')
var getValue = require('@f/get-value')
var reduce = require('@f/reduce-array')
var controls = require('@f/form-controls')
var submittable = require('@f/is-element-submittable')

/**
 * Expose serialize
 */

module.exports = serialize

/**
 * Serialize form
 */

function serialize (form) {
  return reduce(function (acc, ctrl) {
    return submittable(ctrl)
      ? brackets(acc, ctrl.name, getValue(ctrl))
      : acc
  }, {}, controls(form))
}

},{"@f/brackets":10,"@f/form-controls":38,"@f/get-value":42,"@f/is-element-submittable":54,"@f/reduce-array":81}],87:[function(require,module,exports){
/**
 * Modules
 */

var svgAttributeNamespace = require('@f/svg-attribute-namespace')

/**
 * Expose setAttribute
 */

module.exports = setAttribute['default'] = setAttribute

/**
 * setAttribute
 */

function setAttribute (node, name, value) {
  var ns = svgAttributeNamespace(name)
  return ns
    ? node.setAttributeNS(ns, name, value)
    : node.setAttribute(name, value)
}

},{"@f/svg-attribute-namespace":93}],88:[function(require,module,exports){
/**
 * Modules
 */

var clone = require('@f/clone-shallow')
var isFunction = require('@f/is-function')
var isString = require('@f/is-string')
var isNumber = require('@f/is-number')

/**
 * Expose setProp
 */

module.exports = setProp['default'] = setProp

/**
 * setProp
 */

function setProp (path, obj, value) {
  // Fast-path single key array paths
  if (isNumber(path)) return set(obj, path, value)
  if (isString(path)) path = path.split('.')

  return setPropInternal(path, obj, value, 0)
}

function setPropInternal (path, obj, value, idx) {
  if (path.length === idx) {
    return value
  }

  // Create things as we go down if they don't exist
  obj = obj || {}

  var key = path[idx]
  return set(obj, key, setPropInternal(path, obj[key], value, ++idx))
}

function set (obj, key, value) {
  var newObj = clone(obj)
  newObj[key] = isFunction(value) ? value(obj[key]) : value
  return newObj
}

},{"@f/clone-shallow":14,"@f/is-function":55,"@f/is-number":59,"@f/is-string":61}],89:[function(require,module,exports){
/**
 * Modules
 */

var extend = require('@f/extend')

/**
 * Expose setProto
 */

module.exports = setProto['default'] = setProto

/**
 * Give `obj` a new prototype.
 * @param {Object} proto `obj` new prototype.
 * @param {Object} obj The object which is to have its prototype set.
 */

function setProto (proto, obj) {
  if (!hasProto(obj)) {
    extend(obj, proto)
  } else if (Object.setPrototypeOf) {
    Object.setPrototypeOf(obj, proto)
  } else {
    obj.__proto__ = proto
  }

  return obj
}

function hasProto (obj) {
  return '__proto__' in obj
}

},{"@f/extend":33}],90:[function(require,module,exports){
/**
 * Modules
 */

var canSelectText = require('@f/can-select-text')

/**
 * Expose setValue
 */

module.exports = setValue['default'] = setValue

/**
 * setValue
 */

function setValue (node, value) {
  if (node.ownerDocument.activeElement === node && canSelectText(node)) {
    var start = node.selectionStart
    var end = node.selectionEnd
    node.value = value
    node.setSelectionRange(start, end)
  } else {
    node.value = value
  }
}

},{"@f/can-select-text":11}],91:[function(require,module,exports){
/**
 * Expose slice
 */

module.exports = slice

/**
 * slice
 */

function slice (array, begin, end) {
  begin = begin || 0
  end = end || array.length

  var arr = new Array(array.length)
  for (var i = begin; i < end; ++i) {
    arr[i - begin] = array[i]
  }
  return arr
}

},{}],92:[function(require,module,exports){
/**
 * Modules
 */

/**
 * Expose splice
 */

module.exports = splice

/**
 * splice
 */

function splice (arr, idx, n /*, items */) {
  var result = []
  var nItems = arguments.length - 3

  if (idx < 0) idx = arr.length + idx
  if (idx > arr.length) idx = arr.length

  for (var i = 0; i < idx; ++i) {
    result.push(arr[i])
  }

  for (var j = 0; j < nItems; j++) {
    result.push(arguments[j + 3])
  }

  for (var k = idx + n; k < arr.length; ++k) {
    result.push(arr[k])
  }

  return result
}

},{}],93:[function(require,module,exports){
/**
 * Modules
 */

var namespaces = require('@f/svg-attribute-namespaces')

/**
 * Exports
 */

module.exports = svgAttributeNamespace['default'] = svgAttributeNamespace

/**
 * Get namespace of svg attribute
 *
 * @param {String} attributeName
 * @return {String} namespace
 */

function svgAttributeNamespace (attributeName) {
  // if no prefix separator in attributeName, then no namespace
  if (attributeName.indexOf(':') === -1) return null

  // get prefix from attributeName
  var prefix = attributeName.split(':', 1)[0]

  // if prefix in supported prefixes
  if (namespaces.hasOwnProperty(prefix)) {
    // then namespace of prefix
    return namespaces[prefix]
  } else {
    // else unsupported prefix
    throw new Error('svg-attribute-namespace: prefix "' + prefix + '" is not supported by SVG.')
  }
}

},{"@f/svg-attribute-namespaces":94}],94:[function(require,module,exports){
/*
 * Supported SVG attribute namespaces by prefix.
 *
 * References:
 * - http://www.w3.org/TR/SVGTiny12/attributeTable.html
 * - http://www.w3.org/TR/SVG/attindex.html
 * - http://www.w3.org/TR/DOM-Level-2-Core/core.html#ID-ElSetAttrNS
 */

var svgAttributeNamespaces = {
  ev: 'http://www.w3.org/2001/xml-events',
  xlink: 'http://www.w3.org/1999/xlink',
  xml: 'http://www.w3.org/XML/1998/namespace',
  xmlns: 'http://www.w3.org/2000/xmlns/'
}

/**
 * Expose svgAttributeNamespaces
 */

module.exports = svgAttributeNamespaces

},{}],95:[function(require,module,exports){
/**
 * svgElements
 */

var svgElements = 'animate circle defs ellipse g line linearGradient mask path pattern polygon polyline radialGradient rect stop svg text tspan'.split(' ')

/**
 * Expose svgElements
 */

module.exports = svgElements['default'] = svgElements

},{}],96:[function(require,module,exports){
/**
 * Svg namespace
 */

var svgNamespace = 'http://www.w3.org/2000/svg'

/**
 * Expose svgNamespace
 */

module.exports = svgNamespace['default'] = svgNamespace

},{}],97:[function(require,module,exports){
/**
 * Expose toArray
 */

module.exports = toArray['default'] = toArray

/**
 * Convert to an array from array like
 * @param  {ArrayLike} arr
 * @return {Array}
 */

function toArray (arr) {
  var len = arr.length
  var idx = -1

  var array = new Array(len)
  while (++idx < len) {
    array[idx] = arr[idx]
  }
  return array
}

},{}],98:[function(require,module,exports){
/**
 * Modules
 */

var slice = require('@f/slice')
var setProto = require('@f/set-proto')
var isFunction = require('@f/is-function')
var Generator = require('@f/generator')
var isGenerator = require('@f/is-generator')

/**
 * Vars
 */

var bind = Function.prototype.bind

/**
 * Expose toGenerator
 */

module.exports = toGenerator['default'] = toGenerator

/**
 * Make constructor look like a generator
 * @param  {Function} fn [description]
 * @return {Function}
 */

function toGenerator (fn) {
  if (isGenerator(fn)) return fn
  if (!isFunction(fn)) throw new TypeError('`fn` must be a function, got: ' + String(fn))

  function Gen () {
    var args = slice(arguments)
    if (!(this instanceof Gen)) {
      return new (bind.apply(Gen, [null].concat(args)))
    }
    return fn.apply(this, args)
  }

  setProto(Generator.FunctionPrototype, Gen)
  Gen.prototype = Object.create(Generator.Object.prototype)

  return Gen
}

},{"@f/generator":40,"@f/is-function":55,"@f/is-generator":57,"@f/set-proto":89,"@f/slice":91}],99:[function(require,module,exports){
module.exports = after

function after(count, callback, err_cb) {
    var bail = false
    err_cb = err_cb || noop
    proxy.count = count

    return (count === 0) ? callback() : proxy

    function proxy(err, result) {
        if (proxy.count <= 0) {
            throw new Error('after called too many times')
        }
        --proxy.count

        // after first error, rest are passed to err_cb
        if (err) {
            bail = true
            callback(err)
            // future error callbacks will go to error handler
            callback = err_cb
        } else if (proxy.count === 0 && !bail) {
            callback(null, result)
        }
    }
}

function noop() {}

},{}],100:[function(require,module,exports){
/**
 * An abstraction for slicing an arraybuffer even when
 * ArrayBuffer.prototype.slice is not supported
 *
 * @api public
 */

module.exports = function(arraybuffer, start, end) {
  var bytes = arraybuffer.byteLength;
  start = start || 0;
  end = end || bytes;

  if (arraybuffer.slice) { return arraybuffer.slice(start, end); }

  if (start < 0) { start += bytes; }
  if (end < 0) { end += bytes; }
  if (end > bytes) { end = bytes; }

  if (start >= bytes || start >= end || bytes === 0) {
    return new ArrayBuffer(0);
  }

  var abv = new Uint8Array(arraybuffer);
  var result = new Uint8Array(end - start);
  for (var i = start, ii = 0; i < end; i++, ii++) {
    result[ii] = abv[i];
  }
  return result.buffer;
};

},{}],101:[function(require,module,exports){

/**
 * Expose `Backoff`.
 */

module.exports = Backoff;

/**
 * Initialize backoff timer with `opts`.
 *
 * - `min` initial timeout in milliseconds [100]
 * - `max` max timeout [10000]
 * - `jitter` [0]
 * - `factor` [2]
 *
 * @param {Object} opts
 * @api public
 */

function Backoff(opts) {
  opts = opts || {};
  this.ms = opts.min || 100;
  this.max = opts.max || 10000;
  this.factor = opts.factor || 2;
  this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
  this.attempts = 0;
}

/**
 * Return the backoff duration.
 *
 * @return {Number}
 * @api public
 */

Backoff.prototype.duration = function(){
  var ms = this.ms * Math.pow(this.factor, this.attempts++);
  if (this.jitter) {
    var rand =  Math.random();
    var deviation = Math.floor(rand * this.jitter * ms);
    ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
  }
  return Math.min(ms, this.max) | 0;
};

/**
 * Reset the number of attempts.
 *
 * @api public
 */

Backoff.prototype.reset = function(){
  this.attempts = 0;
};

/**
 * Set the minimum duration
 *
 * @api public
 */

Backoff.prototype.setMin = function(min){
  this.ms = min;
};

/**
 * Set the maximum duration
 *
 * @api public
 */

Backoff.prototype.setMax = function(max){
  this.max = max;
};

/**
 * Set the jitter
 *
 * @api public
 */

Backoff.prototype.setJitter = function(jitter){
  this.jitter = jitter;
};


},{}],102:[function(require,module,exports){
/*
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */
(function(chars){
  "use strict";

  exports.encode = function(arraybuffer) {
    var bytes = new Uint8Array(arraybuffer),
    i, len = bytes.length, base64 = "";

    for (i = 0; i < len; i+=3) {
      base64 += chars[bytes[i] >> 2];
      base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
      base64 += chars[bytes[i + 2] & 63];
    }

    if ((len % 3) === 2) {
      base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + "==";
    }

    return base64;
  };

  exports.decode =  function(base64) {
    var bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }

    var arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i+=4) {
      encoded1 = chars.indexOf(base64[i]);
      encoded2 = chars.indexOf(base64[i+1]);
      encoded3 = chars.indexOf(base64[i+2]);
      encoded4 = chars.indexOf(base64[i+3]);

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
  };
})("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");

},{}],103:[function(require,module,exports){
/**
 * Imports
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _catchLinks = require('catch-links');

var _catchLinks2 = _interopRequireDefault(_catchLinks);

/**
 * Bind
 */

function bindUrl(_ref, cb) {
  var wnd = _ref.wnd;
  var root = _ref.root;

  if (root === undefined) {
    root = wnd;
  }

  (0, _catchLinks2['default'])(root, pushState);
  wnd.addEventListener('popstate', update);

  // Initialize
  update();

  function update() {
    var _wnd$location = wnd.location;
    var pathname = _wnd$location.pathname;
    var search = _wnd$location.search;

    cb([pathname, search].filter(Boolean).join(''));
  }

  function pushState(url) {
    wnd.history.pushState({}, '', url);
    cb(url);
  }
}

/**
 * Exports
 */

exports['default'] = bindUrl;
module.exports = exports['default'];
},{"catch-links":106}],104:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Use typed arrays if we can
 */

var FastArray = typeof Uint32Array === 'undefined' ? Array : Uint32Array;

/**
 * Bit vector
 */

function createBv(sizeInBits) {
  return new FastArray(Math.ceil(sizeInBits / 32));
}

function setBit(v, idx) {
  var r = idx % 32;
  var pos = (idx - r) / 32;

  v[pos] |= 1 << r;
}

function clearBit(v, idx) {
  var r = idx % 32;
  var pos = (idx - r) / 32;

  v[pos] &= ~(1 << r);
}

function getBit(v, idx) {
  var r = idx % 32;
  var pos = (idx - r) / 32;

  return !!(v[pos] & 1 << r);
}

/**
 * Exports
 */

exports.createBv = createBv;
exports.setBit = setBit;
exports.clearBit = clearBit;
exports.getBit = getBit;
},{}],105:[function(require,module,exports){
(function (global){
/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder
  || global.WebKitBlobBuilder
  || global.MSBlobBuilder
  || global.MozBlobBuilder;

/**
 * Check if Blob constructor is supported
 */

var blobSupported = (function() {
  try {
    var a = new Blob(['hi']);
    return a.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if Blob constructor supports ArrayBufferViews
 * Fails in Safari 6, so we need to map to ArrayBuffers there.
 */

var blobSupportsArrayBufferView = blobSupported && (function() {
  try {
    var b = new Blob([new Uint8Array([1,2])]);
    return b.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if BlobBuilder is supported
 */

var blobBuilderSupported = BlobBuilder
  && BlobBuilder.prototype.append
  && BlobBuilder.prototype.getBlob;

/**
 * Helper function that maps ArrayBufferViews to ArrayBuffers
 * Used by BlobBuilder constructor and old browsers that didn't
 * support it in the Blob constructor.
 */

function mapArrayBufferViews(ary) {
  for (var i = 0; i < ary.length; i++) {
    var chunk = ary[i];
    if (chunk.buffer instanceof ArrayBuffer) {
      var buf = chunk.buffer;

      // if this is a subarray, make a copy so we only
      // include the subarray region from the underlying buffer
      if (chunk.byteLength !== buf.byteLength) {
        var copy = new Uint8Array(chunk.byteLength);
        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
        buf = copy.buffer;
      }

      ary[i] = buf;
    }
  }
}

function BlobBuilderConstructor(ary, options) {
  options = options || {};

  var bb = new BlobBuilder();
  mapArrayBufferViews(ary);

  for (var i = 0; i < ary.length; i++) {
    bb.append(ary[i]);
  }

  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
};

function BlobConstructor(ary, options) {
  mapArrayBufferViews(ary);
  return new Blob(ary, options || {});
};

module.exports = (function() {
  if (blobSupported) {
    return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
  } else if (blobBuilderSupported) {
    return BlobBuilderConstructor;
  } else {
    return undefined;
  }
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],106:[function(require,module,exports){
var url = require('url');

module.exports = function (root, cb) {
    root.addEventListener('click', function (ev) {
        if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.defaultPrevented) {
            return true;
        }
        
        var anchor = null;
        for (var n = ev.target; n.parentNode; n = n.parentNode) {
            if (n.nodeName === 'A') {
                anchor = n;
                break;
            }
        }
        if (!anchor) return true;
        
        var href = anchor.getAttribute('href');
        var u = url.parse(anchor.getAttribute('href'));
        
        if (u.host && u.host !== location.host) return true;
        
        ev.preventDefault();
        
        var base = location.protocol + '//' + location.host;
        
        cb(url.resolve(location.pathname, u.path || '') + (u.hash || ''));
        return false;
    });
};

},{"url":6}],107:[function(require,module,exports){
/*!
  Copyright (c) 2016 Jed Watson.
  Licensed under the MIT License (MIT), see
  http://jedwatson.github.io/classnames
*/
/* global define */

(function () {
	'use strict';

	var hasOwn = {}.hasOwnProperty;

	function classNames () {
		var classes = [];

		for (var i = 0; i < arguments.length; i++) {
			var arg = arguments[i];
			if (!arg) continue;

			var argType = typeof arg;

			if (argType === 'string' || argType === 'number') {
				classes.push(arg);
			} else if (Array.isArray(arg)) {
				classes.push(classNames.apply(null, arg));
			} else if (argType === 'object') {
				for (var key in arg) {
					if (hasOwn.call(arg, key) && arg[key]) {
						classes.push(key);
					}
				}
			}
		}

		return classes.join(' ');
	}

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = classNames;
	} else if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
		// register as 'classnames', consistent with npm package name
		define('classnames', [], function () {
			return classNames;
		});
	} else {
		window.classNames = classNames;
	}
}());

},{}],108:[function(require,module,exports){
/* MIT license */

module.exports = {
  rgb2hsl: rgb2hsl,
  rgb2hsv: rgb2hsv,
  rgb2hwb: rgb2hwb,
  rgb2cmyk: rgb2cmyk,
  rgb2keyword: rgb2keyword,
  rgb2xyz: rgb2xyz,
  rgb2lab: rgb2lab,
  rgb2lch: rgb2lch,

  hsl2rgb: hsl2rgb,
  hsl2hsv: hsl2hsv,
  hsl2hwb: hsl2hwb,
  hsl2cmyk: hsl2cmyk,
  hsl2keyword: hsl2keyword,

  hsv2rgb: hsv2rgb,
  hsv2hsl: hsv2hsl,
  hsv2hwb: hsv2hwb,
  hsv2cmyk: hsv2cmyk,
  hsv2keyword: hsv2keyword,

  hwb2rgb: hwb2rgb,
  hwb2hsl: hwb2hsl,
  hwb2hsv: hwb2hsv,
  hwb2cmyk: hwb2cmyk,
  hwb2keyword: hwb2keyword,

  cmyk2rgb: cmyk2rgb,
  cmyk2hsl: cmyk2hsl,
  cmyk2hsv: cmyk2hsv,
  cmyk2hwb: cmyk2hwb,
  cmyk2keyword: cmyk2keyword,

  keyword2rgb: keyword2rgb,
  keyword2hsl: keyword2hsl,
  keyword2hsv: keyword2hsv,
  keyword2hwb: keyword2hwb,
  keyword2cmyk: keyword2cmyk,
  keyword2lab: keyword2lab,
  keyword2xyz: keyword2xyz,

  xyz2rgb: xyz2rgb,
  xyz2lab: xyz2lab,
  xyz2lch: xyz2lch,

  lab2xyz: lab2xyz,
  lab2rgb: lab2rgb,
  lab2lch: lab2lch,

  lch2lab: lch2lab,
  lch2xyz: lch2xyz,
  lch2rgb: lch2rgb
}


function rgb2hsl(rgb) {
  var r = rgb[0]/255,
      g = rgb[1]/255,
      b = rgb[2]/255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      delta = max - min,
      h, s, l;

  if (max == min)
    h = 0;
  else if (r == max)
    h = (g - b) / delta;
  else if (g == max)
    h = 2 + (b - r) / delta;
  else if (b == max)
    h = 4 + (r - g)/ delta;

  h = Math.min(h * 60, 360);

  if (h < 0)
    h += 360;

  l = (min + max) / 2;

  if (max == min)
    s = 0;
  else if (l <= 0.5)
    s = delta / (max + min);
  else
    s = delta / (2 - max - min);

  return [h, s * 100, l * 100];
}

function rgb2hsv(rgb) {
  var r = rgb[0],
      g = rgb[1],
      b = rgb[2],
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      delta = max - min,
      h, s, v;

  if (max == 0)
    s = 0;
  else
    s = (delta/max * 1000)/10;

  if (max == min)
    h = 0;
  else if (r == max)
    h = (g - b) / delta;
  else if (g == max)
    h = 2 + (b - r) / delta;
  else if (b == max)
    h = 4 + (r - g) / delta;

  h = Math.min(h * 60, 360);

  if (h < 0)
    h += 360;

  v = ((max / 255) * 1000) / 10;

  return [h, s, v];
}

function rgb2hwb(rgb) {
  var r = rgb[0],
      g = rgb[1],
      b = rgb[2],
      h = rgb2hsl(rgb)[0],
      w = 1/255 * Math.min(r, Math.min(g, b)),
      b = 1 - 1/255 * Math.max(r, Math.max(g, b));

  return [h, w * 100, b * 100];
}

function rgb2cmyk(rgb) {
  var r = rgb[0] / 255,
      g = rgb[1] / 255,
      b = rgb[2] / 255,
      c, m, y, k;

  k = Math.min(1 - r, 1 - g, 1 - b);
  c = (1 - r - k) / (1 - k) || 0;
  m = (1 - g - k) / (1 - k) || 0;
  y = (1 - b - k) / (1 - k) || 0;
  return [c * 100, m * 100, y * 100, k * 100];
}

function rgb2keyword(rgb) {
  return reverseKeywords[JSON.stringify(rgb)];
}

function rgb2xyz(rgb) {
  var r = rgb[0] / 255,
      g = rgb[1] / 255,
      b = rgb[2] / 255;

  // assume sRGB
  r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : (r / 12.92);
  g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : (g / 12.92);
  b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : (b / 12.92);

  var x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
  var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
  var z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

  return [x * 100, y *100, z * 100];
}

function rgb2lab(rgb) {
  var xyz = rgb2xyz(rgb),
        x = xyz[0],
        y = xyz[1],
        z = xyz[2],
        l, a, b;

  x /= 95.047;
  y /= 100;
  z /= 108.883;

  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);

  l = (116 * y) - 16;
  a = 500 * (x - y);
  b = 200 * (y - z);

  return [l, a, b];
}

function rgb2lch(args) {
  return lab2lch(rgb2lab(args));
}

function hsl2rgb(hsl) {
  var h = hsl[0] / 360,
      s = hsl[1] / 100,
      l = hsl[2] / 100,
      t1, t2, t3, rgb, val;

  if (s == 0) {
    val = l * 255;
    return [val, val, val];
  }

  if (l < 0.5)
    t2 = l * (1 + s);
  else
    t2 = l + s - l * s;
  t1 = 2 * l - t2;

  rgb = [0, 0, 0];
  for (var i = 0; i < 3; i++) {
    t3 = h + 1 / 3 * - (i - 1);
    t3 < 0 && t3++;
    t3 > 1 && t3--;

    if (6 * t3 < 1)
      val = t1 + (t2 - t1) * 6 * t3;
    else if (2 * t3 < 1)
      val = t2;
    else if (3 * t3 < 2)
      val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
    else
      val = t1;

    rgb[i] = val * 255;
  }

  return rgb;
}

function hsl2hsv(hsl) {
  var h = hsl[0],
      s = hsl[1] / 100,
      l = hsl[2] / 100,
      sv, v;

  if(l === 0) {
      // no need to do calc on black
      // also avoids divide by 0 error
      return [0, 0, 0];
  }

  l *= 2;
  s *= (l <= 1) ? l : 2 - l;
  v = (l + s) / 2;
  sv = (2 * s) / (l + s);
  return [h, sv * 100, v * 100];
}

function hsl2hwb(args) {
  return rgb2hwb(hsl2rgb(args));
}

function hsl2cmyk(args) {
  return rgb2cmyk(hsl2rgb(args));
}

function hsl2keyword(args) {
  return rgb2keyword(hsl2rgb(args));
}


function hsv2rgb(hsv) {
  var h = hsv[0] / 60,
      s = hsv[1] / 100,
      v = hsv[2] / 100,
      hi = Math.floor(h) % 6;

  var f = h - Math.floor(h),
      p = 255 * v * (1 - s),
      q = 255 * v * (1 - (s * f)),
      t = 255 * v * (1 - (s * (1 - f))),
      v = 255 * v;

  switch(hi) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    case 5:
      return [v, p, q];
  }
}

function hsv2hsl(hsv) {
  var h = hsv[0],
      s = hsv[1] / 100,
      v = hsv[2] / 100,
      sl, l;

  l = (2 - s) * v;
  sl = s * v;
  sl /= (l <= 1) ? l : 2 - l;
  sl = sl || 0;
  l /= 2;
  return [h, sl * 100, l * 100];
}

function hsv2hwb(args) {
  return rgb2hwb(hsv2rgb(args))
}

function hsv2cmyk(args) {
  return rgb2cmyk(hsv2rgb(args));
}

function hsv2keyword(args) {
  return rgb2keyword(hsv2rgb(args));
}

// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
function hwb2rgb(hwb) {
  var h = hwb[0] / 360,
      wh = hwb[1] / 100,
      bl = hwb[2] / 100,
      ratio = wh + bl,
      i, v, f, n;

  // wh + bl cant be > 1
  if (ratio > 1) {
    wh /= ratio;
    bl /= ratio;
  }

  i = Math.floor(6 * h);
  v = 1 - bl;
  f = 6 * h - i;
  if ((i & 0x01) != 0) {
    f = 1 - f;
  }
  n = wh + f * (v - wh);  // linear interpolation

  switch (i) {
    default:
    case 6:
    case 0: r = v; g = n; b = wh; break;
    case 1: r = n; g = v; b = wh; break;
    case 2: r = wh; g = v; b = n; break;
    case 3: r = wh; g = n; b = v; break;
    case 4: r = n; g = wh; b = v; break;
    case 5: r = v; g = wh; b = n; break;
  }

  return [r * 255, g * 255, b * 255];
}

function hwb2hsl(args) {
  return rgb2hsl(hwb2rgb(args));
}

function hwb2hsv(args) {
  return rgb2hsv(hwb2rgb(args));
}

function hwb2cmyk(args) {
  return rgb2cmyk(hwb2rgb(args));
}

function hwb2keyword(args) {
  return rgb2keyword(hwb2rgb(args));
}

function cmyk2rgb(cmyk) {
  var c = cmyk[0] / 100,
      m = cmyk[1] / 100,
      y = cmyk[2] / 100,
      k = cmyk[3] / 100,
      r, g, b;

  r = 1 - Math.min(1, c * (1 - k) + k);
  g = 1 - Math.min(1, m * (1 - k) + k);
  b = 1 - Math.min(1, y * (1 - k) + k);
  return [r * 255, g * 255, b * 255];
}

function cmyk2hsl(args) {
  return rgb2hsl(cmyk2rgb(args));
}

function cmyk2hsv(args) {
  return rgb2hsv(cmyk2rgb(args));
}

function cmyk2hwb(args) {
  return rgb2hwb(cmyk2rgb(args));
}

function cmyk2keyword(args) {
  return rgb2keyword(cmyk2rgb(args));
}


function xyz2rgb(xyz) {
  var x = xyz[0] / 100,
      y = xyz[1] / 100,
      z = xyz[2] / 100,
      r, g, b;

  r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
  g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
  b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

  // assume sRGB
  r = r > 0.0031308 ? ((1.055 * Math.pow(r, 1.0 / 2.4)) - 0.055)
    : r = (r * 12.92);

  g = g > 0.0031308 ? ((1.055 * Math.pow(g, 1.0 / 2.4)) - 0.055)
    : g = (g * 12.92);

  b = b > 0.0031308 ? ((1.055 * Math.pow(b, 1.0 / 2.4)) - 0.055)
    : b = (b * 12.92);

  r = Math.min(Math.max(0, r), 1);
  g = Math.min(Math.max(0, g), 1);
  b = Math.min(Math.max(0, b), 1);

  return [r * 255, g * 255, b * 255];
}

function xyz2lab(xyz) {
  var x = xyz[0],
      y = xyz[1],
      z = xyz[2],
      l, a, b;

  x /= 95.047;
  y /= 100;
  z /= 108.883;

  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);

  l = (116 * y) - 16;
  a = 500 * (x - y);
  b = 200 * (y - z);

  return [l, a, b];
}

function xyz2lch(args) {
  return lab2lch(xyz2lab(args));
}

function lab2xyz(lab) {
  var l = lab[0],
      a = lab[1],
      b = lab[2],
      x, y, z, y2;

  if (l <= 8) {
    y = (l * 100) / 903.3;
    y2 = (7.787 * (y / 100)) + (16 / 116);
  } else {
    y = 100 * Math.pow((l + 16) / 116, 3);
    y2 = Math.pow(y / 100, 1/3);
  }

  x = x / 95.047 <= 0.008856 ? x = (95.047 * ((a / 500) + y2 - (16 / 116))) / 7.787 : 95.047 * Math.pow((a / 500) + y2, 3);

  z = z / 108.883 <= 0.008859 ? z = (108.883 * (y2 - (b / 200) - (16 / 116))) / 7.787 : 108.883 * Math.pow(y2 - (b / 200), 3);

  return [x, y, z];
}

function lab2lch(lab) {
  var l = lab[0],
      a = lab[1],
      b = lab[2],
      hr, h, c;

  hr = Math.atan2(b, a);
  h = hr * 360 / 2 / Math.PI;
  if (h < 0) {
    h += 360;
  }
  c = Math.sqrt(a * a + b * b);
  return [l, c, h];
}

function lab2rgb(args) {
  return xyz2rgb(lab2xyz(args));
}

function lch2lab(lch) {
  var l = lch[0],
      c = lch[1],
      h = lch[2],
      a, b, hr;

  hr = h / 360 * 2 * Math.PI;
  a = c * Math.cos(hr);
  b = c * Math.sin(hr);
  return [l, a, b];
}

function lch2xyz(args) {
  return lab2xyz(lch2lab(args));
}

function lch2rgb(args) {
  return lab2rgb(lch2lab(args));
}

function keyword2rgb(keyword) {
  return cssKeywords[keyword];
}

function keyword2hsl(args) {
  return rgb2hsl(keyword2rgb(args));
}

function keyword2hsv(args) {
  return rgb2hsv(keyword2rgb(args));
}

function keyword2hwb(args) {
  return rgb2hwb(keyword2rgb(args));
}

function keyword2cmyk(args) {
  return rgb2cmyk(keyword2rgb(args));
}

function keyword2lab(args) {
  return rgb2lab(keyword2rgb(args));
}

function keyword2xyz(args) {
  return rgb2xyz(keyword2rgb(args));
}

var cssKeywords = {
  aliceblue:  [240,248,255],
  antiquewhite: [250,235,215],
  aqua: [0,255,255],
  aquamarine: [127,255,212],
  azure:  [240,255,255],
  beige:  [245,245,220],
  bisque: [255,228,196],
  black:  [0,0,0],
  blanchedalmond: [255,235,205],
  blue: [0,0,255],
  blueviolet: [138,43,226],
  brown:  [165,42,42],
  burlywood:  [222,184,135],
  cadetblue:  [95,158,160],
  chartreuse: [127,255,0],
  chocolate:  [210,105,30],
  coral:  [255,127,80],
  cornflowerblue: [100,149,237],
  cornsilk: [255,248,220],
  crimson:  [220,20,60],
  cyan: [0,255,255],
  darkblue: [0,0,139],
  darkcyan: [0,139,139],
  darkgoldenrod:  [184,134,11],
  darkgray: [169,169,169],
  darkgreen:  [0,100,0],
  darkgrey: [169,169,169],
  darkkhaki:  [189,183,107],
  darkmagenta:  [139,0,139],
  darkolivegreen: [85,107,47],
  darkorange: [255,140,0],
  darkorchid: [153,50,204],
  darkred:  [139,0,0],
  darksalmon: [233,150,122],
  darkseagreen: [143,188,143],
  darkslateblue:  [72,61,139],
  darkslategray:  [47,79,79],
  darkslategrey:  [47,79,79],
  darkturquoise:  [0,206,209],
  darkviolet: [148,0,211],
  deeppink: [255,20,147],
  deepskyblue:  [0,191,255],
  dimgray:  [105,105,105],
  dimgrey:  [105,105,105],
  dodgerblue: [30,144,255],
  firebrick:  [178,34,34],
  floralwhite:  [255,250,240],
  forestgreen:  [34,139,34],
  fuchsia:  [255,0,255],
  gainsboro:  [220,220,220],
  ghostwhite: [248,248,255],
  gold: [255,215,0],
  goldenrod:  [218,165,32],
  gray: [128,128,128],
  green:  [0,128,0],
  greenyellow:  [173,255,47],
  grey: [128,128,128],
  honeydew: [240,255,240],
  hotpink:  [255,105,180],
  indianred:  [205,92,92],
  indigo: [75,0,130],
  ivory:  [255,255,240],
  khaki:  [240,230,140],
  lavender: [230,230,250],
  lavenderblush:  [255,240,245],
  lawngreen:  [124,252,0],
  lemonchiffon: [255,250,205],
  lightblue:  [173,216,230],
  lightcoral: [240,128,128],
  lightcyan:  [224,255,255],
  lightgoldenrodyellow: [250,250,210],
  lightgray:  [211,211,211],
  lightgreen: [144,238,144],
  lightgrey:  [211,211,211],
  lightpink:  [255,182,193],
  lightsalmon:  [255,160,122],
  lightseagreen:  [32,178,170],
  lightskyblue: [135,206,250],
  lightslategray: [119,136,153],
  lightslategrey: [119,136,153],
  lightsteelblue: [176,196,222],
  lightyellow:  [255,255,224],
  lime: [0,255,0],
  limegreen:  [50,205,50],
  linen:  [250,240,230],
  magenta:  [255,0,255],
  maroon: [128,0,0],
  mediumaquamarine: [102,205,170],
  mediumblue: [0,0,205],
  mediumorchid: [186,85,211],
  mediumpurple: [147,112,219],
  mediumseagreen: [60,179,113],
  mediumslateblue:  [123,104,238],
  mediumspringgreen:  [0,250,154],
  mediumturquoise:  [72,209,204],
  mediumvioletred:  [199,21,133],
  midnightblue: [25,25,112],
  mintcream:  [245,255,250],
  mistyrose:  [255,228,225],
  moccasin: [255,228,181],
  navajowhite:  [255,222,173],
  navy: [0,0,128],
  oldlace:  [253,245,230],
  olive:  [128,128,0],
  olivedrab:  [107,142,35],
  orange: [255,165,0],
  orangered:  [255,69,0],
  orchid: [218,112,214],
  palegoldenrod:  [238,232,170],
  palegreen:  [152,251,152],
  paleturquoise:  [175,238,238],
  palevioletred:  [219,112,147],
  papayawhip: [255,239,213],
  peachpuff:  [255,218,185],
  peru: [205,133,63],
  pink: [255,192,203],
  plum: [221,160,221],
  powderblue: [176,224,230],
  purple: [128,0,128],
  rebeccapurple: [102, 51, 153],
  red:  [255,0,0],
  rosybrown:  [188,143,143],
  royalblue:  [65,105,225],
  saddlebrown:  [139,69,19],
  salmon: [250,128,114],
  sandybrown: [244,164,96],
  seagreen: [46,139,87],
  seashell: [255,245,238],
  sienna: [160,82,45],
  silver: [192,192,192],
  skyblue:  [135,206,235],
  slateblue:  [106,90,205],
  slategray:  [112,128,144],
  slategrey:  [112,128,144],
  snow: [255,250,250],
  springgreen:  [0,255,127],
  steelblue:  [70,130,180],
  tan:  [210,180,140],
  teal: [0,128,128],
  thistle:  [216,191,216],
  tomato: [255,99,71],
  turquoise:  [64,224,208],
  violet: [238,130,238],
  wheat:  [245,222,179],
  white:  [255,255,255],
  whitesmoke: [245,245,245],
  yellow: [255,255,0],
  yellowgreen:  [154,205,50]
};

var reverseKeywords = {};
for (var key in cssKeywords) {
  reverseKeywords[JSON.stringify(cssKeywords[key])] = key;
}

},{}],109:[function(require,module,exports){
var conversions = require("./conversions");

var convert = function() {
   return new Converter();
}

for (var func in conversions) {
  // export Raw versions
  convert[func + "Raw"] =  (function(func) {
    // accept array or plain args
    return function(arg) {
      if (typeof arg == "number")
        arg = Array.prototype.slice.call(arguments);
      return conversions[func](arg);
    }
  })(func);

  var pair = /(\w+)2(\w+)/.exec(func),
      from = pair[1],
      to = pair[2];

  // export rgb2hsl and ["rgb"]["hsl"]
  convert[from] = convert[from] || {};

  convert[from][to] = convert[func] = (function(func) { 
    return function(arg) {
      if (typeof arg == "number")
        arg = Array.prototype.slice.call(arguments);
      
      var val = conversions[func](arg);
      if (typeof val == "string" || val === undefined)
        return val; // keyword

      for (var i = 0; i < val.length; i++)
        val[i] = Math.round(val[i]);
      return val;
    }
  })(func);
}


/* Converter does lazy conversion and caching */
var Converter = function() {
   this.convs = {};
};

/* Either get the values for a space or
  set the values for a space, depending on args */
Converter.prototype.routeSpace = function(space, args) {
   var values = args[0];
   if (values === undefined) {
      // color.rgb()
      return this.getValues(space);
   }
   // color.rgb(10, 10, 10)
   if (typeof values == "number") {
      values = Array.prototype.slice.call(args);        
   }

   return this.setValues(space, values);
};
  
/* Set the values for a space, invalidating cache */
Converter.prototype.setValues = function(space, values) {
   this.space = space;
   this.convs = {};
   this.convs[space] = values;
   return this;
};

/* Get the values for a space. If there's already
  a conversion for the space, fetch it, otherwise
  compute it */
Converter.prototype.getValues = function(space) {
   var vals = this.convs[space];
   if (!vals) {
      var fspace = this.space,
          from = this.convs[fspace];
      vals = convert[fspace][space](from);

      this.convs[space] = vals;
   }
  return vals;
};

["rgb", "hsl", "hsv", "cmyk", "keyword"].forEach(function(space) {
   Converter.prototype[space] = function(vals) {
      return this.routeSpace(space, arguments);
   }
});

module.exports = convert;
},{"./conversions":108}],110:[function(require,module,exports){
module.exports = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};
},{}],111:[function(require,module,exports){
/* MIT license */
var colorNames = require('color-name');

module.exports = {
   getRgba: getRgba,
   getHsla: getHsla,
   getRgb: getRgb,
   getHsl: getHsl,
   getHwb: getHwb,
   getAlpha: getAlpha,

   hexString: hexString,
   rgbString: rgbString,
   rgbaString: rgbaString,
   percentString: percentString,
   percentaString: percentaString,
   hslString: hslString,
   hslaString: hslaString,
   hwbString: hwbString,
   keyword: keyword
}

function getRgba(string) {
   if (!string) {
      return;
   }
   var abbr =  /^#([a-fA-F0-9]{3})$/,
       hex =  /^#([a-fA-F0-9]{6})$/,
       rgba = /^rgba?\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*(?:,\s*([+-]?[\d\.]+)\s*)?\)$/,
       per = /^rgba?\(\s*([+-]?[\d\.]+)\%\s*,\s*([+-]?[\d\.]+)\%\s*,\s*([+-]?[\d\.]+)\%\s*(?:,\s*([+-]?[\d\.]+)\s*)?\)$/,
       keyword = /(\D+)/;

   var rgb = [0, 0, 0],
       a = 1,
       match = string.match(abbr);
   if (match) {
      match = match[1];
      for (var i = 0; i < rgb.length; i++) {
         rgb[i] = parseInt(match[i] + match[i], 16);
      }
   }
   else if (match = string.match(hex)) {
      match = match[1];
      for (var i = 0; i < rgb.length; i++) {
         rgb[i] = parseInt(match.slice(i * 2, i * 2 + 2), 16);
      }
   }
   else if (match = string.match(rgba)) {
      for (var i = 0; i < rgb.length; i++) {
         rgb[i] = parseInt(match[i + 1]);
      }
      a = parseFloat(match[4]);
   }
   else if (match = string.match(per)) {
      for (var i = 0; i < rgb.length; i++) {
         rgb[i] = Math.round(parseFloat(match[i + 1]) * 2.55);
      }
      a = parseFloat(match[4]);
   }
   else if (match = string.match(keyword)) {
      if (match[1] == "transparent") {
         return [0, 0, 0, 0];
      }
      rgb = colorNames[match[1]];
      if (!rgb) {
         return;
      }
   }

   for (var i = 0; i < rgb.length; i++) {
      rgb[i] = scale(rgb[i], 0, 255);
   }
   if (!a && a != 0) {
      a = 1;
   }
   else {
      a = scale(a, 0, 1);
   }
   rgb[3] = a;
   return rgb;
}

function getHsla(string) {
   if (!string) {
      return;
   }
   var hsl = /^hsla?\(\s*([+-]?\d+)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?[\d\.]+)\s*)?\)/;
   var match = string.match(hsl);
   if (match) {
      var alpha = parseFloat(match[4]);
      var h = scale(parseInt(match[1]), 0, 360),
          s = scale(parseFloat(match[2]), 0, 100),
          l = scale(parseFloat(match[3]), 0, 100),
          a = scale(isNaN(alpha) ? 1 : alpha, 0, 1);
      return [h, s, l, a];
   }
}

function getHwb(string) {
   if (!string) {
      return;
   }
   var hwb = /^hwb\(\s*([+-]?\d+)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?[\d\.]+)\s*)?\)/;
   var match = string.match(hwb);
   if (match) {
    var alpha = parseFloat(match[4]);
      var h = scale(parseInt(match[1]), 0, 360),
          w = scale(parseFloat(match[2]), 0, 100),
          b = scale(parseFloat(match[3]), 0, 100),
          a = scale(isNaN(alpha) ? 1 : alpha, 0, 1);
      return [h, w, b, a];
   }
}

function getRgb(string) {
   var rgba = getRgba(string);
   return rgba && rgba.slice(0, 3);
}

function getHsl(string) {
  var hsla = getHsla(string);
  return hsla && hsla.slice(0, 3);
}

function getAlpha(string) {
   var vals = getRgba(string);
   if (vals) {
      return vals[3];
   }
   else if (vals = getHsla(string)) {
      return vals[3];
   }
   else if (vals = getHwb(string)) {
      return vals[3];
   }
}

// generators
function hexString(rgb) {
   return "#" + hexDouble(rgb[0]) + hexDouble(rgb[1])
              + hexDouble(rgb[2]);
}

function rgbString(rgba, alpha) {
   if (alpha < 1 || (rgba[3] && rgba[3] < 1)) {
      return rgbaString(rgba, alpha);
   }
   return "rgb(" + rgba[0] + ", " + rgba[1] + ", " + rgba[2] + ")";
}

function rgbaString(rgba, alpha) {
   if (alpha === undefined) {
      alpha = (rgba[3] !== undefined ? rgba[3] : 1);
   }
   return "rgba(" + rgba[0] + ", " + rgba[1] + ", " + rgba[2]
           + ", " + alpha + ")";
}

function percentString(rgba, alpha) {
   if (alpha < 1 || (rgba[3] && rgba[3] < 1)) {
      return percentaString(rgba, alpha);
   }
   var r = Math.round(rgba[0]/255 * 100),
       g = Math.round(rgba[1]/255 * 100),
       b = Math.round(rgba[2]/255 * 100);

   return "rgb(" + r + "%, " + g + "%, " + b + "%)";
}

function percentaString(rgba, alpha) {
   var r = Math.round(rgba[0]/255 * 100),
       g = Math.round(rgba[1]/255 * 100),
       b = Math.round(rgba[2]/255 * 100);
   return "rgba(" + r + "%, " + g + "%, " + b + "%, " + (alpha || rgba[3] || 1) + ")";
}

function hslString(hsla, alpha) {
   if (alpha < 1 || (hsla[3] && hsla[3] < 1)) {
      return hslaString(hsla, alpha);
   }
   return "hsl(" + hsla[0] + ", " + hsla[1] + "%, " + hsla[2] + "%)";
}

function hslaString(hsla, alpha) {
   if (alpha === undefined) {
      alpha = (hsla[3] !== undefined ? hsla[3] : 1);
   }
   return "hsla(" + hsla[0] + ", " + hsla[1] + "%, " + hsla[2] + "%, "
           + alpha + ")";
}

// hwb is a bit different than rgb(a) & hsl(a) since there is no alpha specific syntax
// (hwb have alpha optional & 1 is default value)
function hwbString(hwb, alpha) {
   if (alpha === undefined) {
      alpha = (hwb[3] !== undefined ? hwb[3] : 1);
   }
   return "hwb(" + hwb[0] + ", " + hwb[1] + "%, " + hwb[2] + "%"
           + (alpha !== undefined && alpha !== 1 ? ", " + alpha : "") + ")";
}

function keyword(rgb) {
  return reverseNames[rgb.slice(0, 3)];
}

// helpers
function scale(num, min, max) {
   return Math.min(Math.max(min, num), max);
}

function hexDouble(num) {
  var str = num.toString(16).toUpperCase();
  return (str.length < 2) ? "0" + str : str;
}


//create a list of reverse color names
var reverseNames = {};
for (var name in colorNames) {
   reverseNames[colorNames[name]] = name;
}

},{"color-name":110}],112:[function(require,module,exports){
/* MIT license */
var convert = require('color-convert');
var string = require('color-string');

var Color = function (obj) {
	if (obj instanceof Color) {
		return obj;
	}
	if (!(this instanceof Color)) {
		return new Color(obj);
	}

	this.values = {
		rgb: [0, 0, 0],
		hsl: [0, 0, 0],
		hsv: [0, 0, 0],
		hwb: [0, 0, 0],
		cmyk: [0, 0, 0, 0],
		alpha: 1
	};

	// parse Color() argument
	var vals;
	if (typeof obj === 'string') {
		vals = string.getRgba(obj);
		if (vals) {
			this.setValues('rgb', vals);
		} else if (vals = string.getHsla(obj)) {
			this.setValues('hsl', vals);
		} else if (vals = string.getHwb(obj)) {
			this.setValues('hwb', vals);
		} else {
			throw new Error('Unable to parse color from string "' + obj + '"');
		}
	} else if (typeof obj === 'object') {
		vals = obj;
		if (vals.r !== undefined || vals.red !== undefined) {
			this.setValues('rgb', vals);
		} else if (vals.l !== undefined || vals.lightness !== undefined) {
			this.setValues('hsl', vals);
		} else if (vals.v !== undefined || vals.value !== undefined) {
			this.setValues('hsv', vals);
		} else if (vals.w !== undefined || vals.whiteness !== undefined) {
			this.setValues('hwb', vals);
		} else if (vals.c !== undefined || vals.cyan !== undefined) {
			this.setValues('cmyk', vals);
		} else {
			throw new Error('Unable to parse color from object ' + JSON.stringify(obj));
		}
	}
};

Color.prototype = {
	rgb: function () {
		return this.setSpace('rgb', arguments);
	},
	hsl: function () {
		return this.setSpace('hsl', arguments);
	},
	hsv: function () {
		return this.setSpace('hsv', arguments);
	},
	hwb: function () {
		return this.setSpace('hwb', arguments);
	},
	cmyk: function () {
		return this.setSpace('cmyk', arguments);
	},

	rgbArray: function () {
		return this.values.rgb;
	},
	hslArray: function () {
		return this.values.hsl;
	},
	hsvArray: function () {
		return this.values.hsv;
	},
	hwbArray: function () {
		if (this.values.alpha !== 1) {
			return this.values.hwb.concat([this.values.alpha]);
		}
		return this.values.hwb;
	},
	cmykArray: function () {
		return this.values.cmyk;
	},
	rgbaArray: function () {
		var rgb = this.values.rgb;
		return rgb.concat([this.values.alpha]);
	},
	hslaArray: function () {
		var hsl = this.values.hsl;
		return hsl.concat([this.values.alpha]);
	},
	alpha: function (val) {
		if (val === undefined) {
			return this.values.alpha;
		}
		this.setValues('alpha', val);
		return this;
	},

	red: function (val) {
		return this.setChannel('rgb', 0, val);
	},
	green: function (val) {
		return this.setChannel('rgb', 1, val);
	},
	blue: function (val) {
		return this.setChannel('rgb', 2, val);
	},
	hue: function (val) {
		if (val) {
			val %= 360;
			val = val < 0 ? 360 + val : val;
		}
		return this.setChannel('hsl', 0, val);
	},
	saturation: function (val) {
		return this.setChannel('hsl', 1, val);
	},
	lightness: function (val) {
		return this.setChannel('hsl', 2, val);
	},
	saturationv: function (val) {
		return this.setChannel('hsv', 1, val);
	},
	whiteness: function (val) {
		return this.setChannel('hwb', 1, val);
	},
	blackness: function (val) {
		return this.setChannel('hwb', 2, val);
	},
	value: function (val) {
		return this.setChannel('hsv', 2, val);
	},
	cyan: function (val) {
		return this.setChannel('cmyk', 0, val);
	},
	magenta: function (val) {
		return this.setChannel('cmyk', 1, val);
	},
	yellow: function (val) {
		return this.setChannel('cmyk', 2, val);
	},
	black: function (val) {
		return this.setChannel('cmyk', 3, val);
	},

	hexString: function () {
		return string.hexString(this.values.rgb);
	},
	rgbString: function () {
		return string.rgbString(this.values.rgb, this.values.alpha);
	},
	rgbaString: function () {
		return string.rgbaString(this.values.rgb, this.values.alpha);
	},
	percentString: function () {
		return string.percentString(this.values.rgb, this.values.alpha);
	},
	hslString: function () {
		return string.hslString(this.values.hsl, this.values.alpha);
	},
	hslaString: function () {
		return string.hslaString(this.values.hsl, this.values.alpha);
	},
	hwbString: function () {
		return string.hwbString(this.values.hwb, this.values.alpha);
	},
	keyword: function () {
		return string.keyword(this.values.rgb, this.values.alpha);
	},

	rgbNumber: function () {
		return (this.values.rgb[0] << 16) | (this.values.rgb[1] << 8) | this.values.rgb[2];
	},

	luminosity: function () {
		// http://www.w3.org/TR/WCAG20/#relativeluminancedef
		var rgb = this.values.rgb;
		var lum = [];
		for (var i = 0; i < rgb.length; i++) {
			var chan = rgb[i] / 255;
			lum[i] = (chan <= 0.03928) ? chan / 12.92 : Math.pow(((chan + 0.055) / 1.055), 2.4);
		}
		return 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
	},

	contrast: function (color2) {
		// http://www.w3.org/TR/WCAG20/#contrast-ratiodef
		var lum1 = this.luminosity();
		var lum2 = color2.luminosity();
		if (lum1 > lum2) {
			return (lum1 + 0.05) / (lum2 + 0.05);
		}
		return (lum2 + 0.05) / (lum1 + 0.05);
	},

	level: function (color2) {
		var contrastRatio = this.contrast(color2);
		if (contrastRatio >= 7.1) {
			return 'AAA';
		}

		return (contrastRatio >= 4.5) ? 'AA' : '';
	},

	dark: function () {
		// YIQ equation from http://24ways.org/2010/calculating-color-contrast
		var rgb = this.values.rgb;
		var yiq = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
		return yiq < 128;
	},

	light: function () {
		return !this.dark();
	},

	negate: function () {
		var rgb = [];
		for (var i = 0; i < 3; i++) {
			rgb[i] = 255 - this.values.rgb[i];
		}
		this.setValues('rgb', rgb);
		return this;
	},

	lighten: function (ratio) {
		this.values.hsl[2] += this.values.hsl[2] * ratio;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	darken: function (ratio) {
		this.values.hsl[2] -= this.values.hsl[2] * ratio;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	saturate: function (ratio) {
		this.values.hsl[1] += this.values.hsl[1] * ratio;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	desaturate: function (ratio) {
		this.values.hsl[1] -= this.values.hsl[1] * ratio;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	whiten: function (ratio) {
		this.values.hwb[1] += this.values.hwb[1] * ratio;
		this.setValues('hwb', this.values.hwb);
		return this;
	},

	blacken: function (ratio) {
		this.values.hwb[2] += this.values.hwb[2] * ratio;
		this.setValues('hwb', this.values.hwb);
		return this;
	},

	greyscale: function () {
		var rgb = this.values.rgb;
		// http://en.wikipedia.org/wiki/Grayscale#Converting_color_to_grayscale
		var val = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
		this.setValues('rgb', [val, val, val]);
		return this;
	},

	clearer: function (ratio) {
		this.setValues('alpha', this.values.alpha - (this.values.alpha * ratio));
		return this;
	},

	opaquer: function (ratio) {
		this.setValues('alpha', this.values.alpha + (this.values.alpha * ratio));
		return this;
	},

	rotate: function (degrees) {
		var hue = this.values.hsl[0];
		hue = (hue + degrees) % 360;
		hue = hue < 0 ? 360 + hue : hue;
		this.values.hsl[0] = hue;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	/**
	 * Ported from sass implementation in C
	 * https://github.com/sass/libsass/blob/0e6b4a2850092356aa3ece07c6b249f0221caced/functions.cpp#L209
	 */
	mix: function (mixinColor, weight) {
		var color1 = this;
		var color2 = mixinColor;
		var p = weight === undefined ? 0.5 : weight;

		var w = 2 * p - 1;
		var a = color1.alpha() - color2.alpha();

		var w1 = (((w * a === -1) ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
		var w2 = 1 - w1;

		return this
			.rgb(
				w1 * color1.red() + w2 * color2.red(),
				w1 * color1.green() + w2 * color2.green(),
				w1 * color1.blue() + w2 * color2.blue()
			)
			.alpha(color1.alpha() * p + color2.alpha() * (1 - p));
	},

	toJSON: function () {
		return this.rgb();
	},

	clone: function () {
		return new Color(this.rgb());
	}
};

Color.prototype.getValues = function (space) {
	var vals = {};

	for (var i = 0; i < space.length; i++) {
		vals[space.charAt(i)] = this.values[space][i];
	}

	if (this.values.alpha !== 1) {
		vals.a = this.values.alpha;
	}

	// {r: 255, g: 255, b: 255, a: 0.4}
	return vals;
};

Color.prototype.setValues = function (space, vals) {
	var spaces = {
		rgb: ['red', 'green', 'blue'],
		hsl: ['hue', 'saturation', 'lightness'],
		hsv: ['hue', 'saturation', 'value'],
		hwb: ['hue', 'whiteness', 'blackness'],
		cmyk: ['cyan', 'magenta', 'yellow', 'black']
	};

	var maxes = {
		rgb: [255, 255, 255],
		hsl: [360, 100, 100],
		hsv: [360, 100, 100],
		hwb: [360, 100, 100],
		cmyk: [100, 100, 100, 100]
	};

	var i;
	var alpha = 1;
	if (space === 'alpha') {
		alpha = vals;
	} else if (vals.length) {
		// [10, 10, 10]
		this.values[space] = vals.slice(0, space.length);
		alpha = vals[space.length];
	} else if (vals[space.charAt(0)] !== undefined) {
		// {r: 10, g: 10, b: 10}
		for (i = 0; i < space.length; i++) {
			this.values[space][i] = vals[space.charAt(i)];
		}

		alpha = vals.a;
	} else if (vals[spaces[space][0]] !== undefined) {
		// {red: 10, green: 10, blue: 10}
		var chans = spaces[space];

		for (i = 0; i < space.length; i++) {
			this.values[space][i] = vals[chans[i]];
		}

		alpha = vals.alpha;
	}

	this.values.alpha = Math.max(0, Math.min(1, (alpha === undefined ? this.values.alpha : alpha)));

	if (space === 'alpha') {
		return false;
	}

	var capped;

	// cap values of the space prior converting all values
	for (i = 0; i < space.length; i++) {
		capped = Math.max(0, Math.min(maxes[space][i], this.values[space][i]));
		this.values[space][i] = Math.round(capped);
	}

	// convert to all the other color spaces
	for (var sname in spaces) {
		if (sname !== space) {
			this.values[sname] = convert[space][sname](this.values[space]);
		}

		// cap values
		for (i = 0; i < sname.length; i++) {
			capped = Math.max(0, Math.min(maxes[sname][i], this.values[sname][i]));
			this.values[sname][i] = Math.round(capped);
		}
	}

	return true;
};

Color.prototype.setSpace = function (space, args) {
	var vals = args[0];

	if (vals === undefined) {
		// color.rgb()
		return this.getValues(space);
	}

	// color.rgb(10, 10, 10)
	if (typeof vals === 'number') {
		vals = Array.prototype.slice.call(args);
	}

	this.setValues(space, vals);
	return this;
};

Color.prototype.setChannel = function (space, index, val) {
	if (val === undefined) {
		// color.red()
		return this.values[space][index];
	} else if (val === this.values[space][index]) {
		// color.red(color.red())
		return this;
	}

	// color.red(100)
	this.values[space][index] = val;
	this.setValues(space, this.values[space]);

	return this;
};

module.exports = Color;

},{"color-convert":109,"color-string":111}],113:[function(require,module,exports){
/**
 * Slice reference.
 */

var slice = [].slice;

/**
 * Bind `obj` to `fn`.
 *
 * @param {Object} obj
 * @param {Function|String} fn or string
 * @return {Function}
 * @api public
 */

module.exports = function(obj, fn){
  if ('string' == typeof fn) fn = obj[fn];
  if ('function' != typeof fn) throw new Error('bind() requires a function');
  var args = slice.call(arguments, 2);
  return function(){
    return fn.apply(obj, args.concat(slice.call(arguments)));
  }
};

},{}],114:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],115:[function(require,module,exports){

module.exports = function(a, b){
  var fn = function(){};
  fn.prototype = b.prototype;
  a.prototype = new fn;
  a.prototype.constructor = a;
};
},{}],116:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":117}],117:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":164}],118:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.delegateGlobal = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _proxyEvent = require('./proxy-event');

var _proxyEvent2 = _interopRequireDefault(_proxyEvent);

var _domEvents = require('@f/dom-events');

var _domEvents2 = _interopRequireDefault(_domEvents);

var _foreach = require('@f/foreach');

var _foreach2 = _interopRequireDefault(_foreach);

var _compose = require('@f/compose');

var _compose2 = _interopRequireDefault(_compose);

var _evStore = require('ev-store');

var _evStore2 = _interopRequireDefault(_evStore);

var _mapArray = require('@f/map-array');

var _mapArray2 = _interopRequireDefault(_mapArray);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * Imports
                                                                                                                                                                                                     */

/**
 * Delegator
 */

function delegant(rootNode) {
  var fn = arguments.length <= 1 || arguments[1] === undefined ? function (v) {
    return v;
  } : arguments[1];

  return _compose2.default.apply(undefined, _toConsumableArray((0, _mapArray2.default)(bind, _domEvents2.default)));

  function bind(name) {
    var handler = listener(name);
    rootNode.addEventListener(name, handler, true);
    return function () {
      return rootNode.removeEventListener(name, handler, true);
    };
  }

  function listener(name) {
    return function (e) {
      return bubble(name, e.target, e);
    };
  }

  function bubble(name, target, e) {
    var es = (0, _evStore2.default)(target);
    var handler = es[name];

    if (handler) {
      var _ret = function () {
        var event = new _proxyEvent2.default(e);
        event.currentTarget = target;

        'function' === typeof handler ? fn(handler(event)) : (0, _foreach2.default)(function (handler) {
          return fn(handler(event));
        }, handler);

        if (event._stopPropagation || event._stopImmediatePropagation) {
          return {
            v: undefined
          };
        }
      }();

      if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
    }

    if (target.parentNode && target !== rootNode && e.bubbles) {
      bubble(name, target.parentNode, e);
    }
  }
}

function delegateGlobal(node, fn) {
  var store = (0, _evStore2.default)(node);
  return _compose2.default.apply(undefined, _toConsumableArray((0, _mapArray2.default)(bind, _domEvents2.default)));

  function bind(name) {
    var handler = listener(name);
    node.addEventListener(name, handler, true);
    return function () {
      return node.removeEventListener(name, handler, true);
    };
  }

  function listener(name) {
    return function (e) {
      return (0, _foreach2.default)(function (handle) {
        return fn(handle(e));
      }, store[name]);
    };
  }
}

/**
 * Exports
 */

exports.default = delegant;
exports.delegateGlobal = delegateGlobal;
},{"./proxy-event":119,"@f/compose":16,"@f/dom-events":25,"@f/foreach":37,"@f/map-array":68,"ev-store":138}],119:[function(require,module,exports){
"use strict";

/**
 * Note: This code copied from: https://github.com/Raynos/dom-delegator/blob/master/proxy-event.js
 */

var inherits = require("inherits");

var ALL_PROPS = ["altKey", "bubbles", "cancelable", "ctrlKey", "eventPhase", "metaKey", "relatedTarget", "shiftKey", "target", "timeStamp", "type", "view", "which"];
var KEY_PROPS = ["char", "charCode", "key", "keyCode"];
var MOUSE_PROPS = ["button", "buttons", "clientX", "clientY", "layerX", "layerY", "offsetX", "offsetY", "pageX", "pageY", "screenX", "screenY", "toElement"];

var rkeyEvent = /^key|input/;
var rmouseEvent = /^(?:mouse|pointer|contextmenu)|click/;

module.exports = ProxyEvent;

function ProxyEvent(ev) {
    if (!(this instanceof ProxyEvent)) {
        return new ProxyEvent(ev);
    }

    if (rkeyEvent.test(ev.type)) {
        return new KeyEvent(ev);
    } else if (rmouseEvent.test(ev.type)) {
        return new MouseEvent(ev);
    }

    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i];
        this[propKey] = ev[propKey];
    }

    this._rawEvent = ev;
    this._bubbles = false;
}

ProxyEvent.prototype.preventDefault = function () {
    this._rawEvent.preventDefault();
};

ProxyEvent.prototype.startPropagation = function () {
    this._bubbles = true;
};

ProxyEvent.prototype.stopPropagation = function () {
    this._stopPropagation = true;
};

ProxyEvent.prototype.stopImmediatePropagation = function () {
    this._stopImmediatePropagation = true;
};

function MouseEvent(ev) {
    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i];
        this[propKey] = ev[propKey];
    }

    for (var j = 0; j < MOUSE_PROPS.length; j++) {
        var mousePropKey = MOUSE_PROPS[j];
        this[mousePropKey] = ev[mousePropKey];
    }

    this._rawEvent = ev;
}

inherits(MouseEvent, ProxyEvent);

function KeyEvent(ev) {
    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i];
        this[propKey] = ev[propKey];
    }

    for (var j = 0; j < KEY_PROPS.length; j++) {
        var keyPropKey = KEY_PROPS[j];
        this[keyPropKey] = ev[keyPropKey];
    }

    this._rawEvent = ev;
}

inherits(KeyEvent, ProxyEvent);
},{"inherits":146}],120:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.REMOVE = exports.MOVE = exports.UPDATE = exports.CREATE = undefined;

var _bitVector = require('bit-vector');

/**
 * Actions
 */

var CREATE = 0; /**
                 * Imports
                 */

var UPDATE = 1;
var MOVE = 2;
var REMOVE = 3;

/**
 * dift
 */

function dift(prev, next, effect, key) {
  var pStartIdx = 0;
  var nStartIdx = 0;
  var pEndIdx = prev.length - 1;
  var nEndIdx = next.length - 1;
  var pStartItem = prev[pStartIdx];
  var nStartItem = next[nStartIdx];

  // List head is the same
  while (pStartIdx <= pEndIdx && nStartIdx <= nEndIdx && equal(pStartItem, nStartItem)) {
    effect(UPDATE, pStartItem, nStartItem, nStartIdx);
    pStartItem = prev[++pStartIdx];
    nStartItem = next[++nStartIdx];
  }

  // The above case is orders of magnitude more common than the others, so fast-path it
  if (nStartIdx > nEndIdx && pStartIdx > pEndIdx) {
    return;
  }

  var pEndItem = prev[pEndIdx];
  var nEndItem = next[nEndIdx];
  var movedFromFront = 0;

  // Reversed
  while (pStartIdx <= pEndIdx && nStartIdx <= nEndIdx && equal(pStartItem, nEndItem)) {
    effect(MOVE, pStartItem, nEndItem, pEndIdx - movedFromFront + 1);
    pStartItem = prev[++pStartIdx];
    nEndItem = next[--nEndIdx];
    ++movedFromFront;
  }

  // Reversed the other way (in case of e.g. reverse and append)
  while (pEndIdx >= pStartIdx && nStartIdx <= nEndIdx && equal(nStartItem, pEndItem)) {
    effect(MOVE, pEndItem, nStartItem, nStartIdx);
    pEndItem = prev[--pEndIdx];
    nStartItem = next[++nStartIdx];
    --movedFromFront;
  }

  // List tail is the same
  while (pEndIdx >= pStartIdx && nEndIdx >= nStartIdx && equal(pEndItem, nEndItem)) {
    effect(UPDATE, pEndItem, nEndItem, nEndIdx);
    pEndItem = prev[--pEndIdx];
    nEndItem = next[--nEndIdx];
  }

  if (pStartIdx > pEndIdx) {
    while (nStartIdx <= nEndIdx) {
      effect(CREATE, null, nStartItem, nStartIdx);
      nStartItem = next[++nStartIdx];
    }

    return;
  }

  if (nStartIdx > nEndIdx) {
    while (pStartIdx <= pEndIdx) {
      effect(REMOVE, pStartItem);
      pStartItem = prev[++pStartIdx];
    }

    return;
  }

  var created = 0;
  var pivotDest = null;
  var pivotIdx = pStartIdx - movedFromFront;
  var keepBase = pStartIdx;
  var keep = (0, _bitVector.createBv)(pEndIdx - pStartIdx);

  var prevMap = keyMap(prev, pStartIdx, pEndIdx + 1, key);

  for (; nStartIdx <= nEndIdx; nStartItem = next[++nStartIdx]) {
    var oldIdx = prevMap[key(nStartItem)];

    if (isUndefined(oldIdx)) {
      effect(CREATE, null, nStartItem, pivotIdx++);
      ++created;
    } else if (pStartIdx !== oldIdx) {
      (0, _bitVector.setBit)(keep, oldIdx - keepBase);
      effect(MOVE, prev[oldIdx], nStartItem, pivotIdx++);
    } else {
      pivotDest = nStartIdx;
    }
  }

  if (pivotDest !== null) {
    (0, _bitVector.setBit)(keep, 0);
    effect(MOVE, prev[pStartIdx], next[pivotDest], pivotDest);
  }

  // If there are no creations, then you have to
  // remove exactly max(prevLen - nextLen, 0) elements in this
  // diff. You have to remove one more for each element
  // that was created. This means once we have
  // removed that many, we can stop.
  var necessaryRemovals = prev.length - next.length + created;
  for (var removals = 0; removals < necessaryRemovals; pStartItem = prev[++pStartIdx]) {
    if (!(0, _bitVector.getBit)(keep, pStartIdx - keepBase)) {
      effect(REMOVE, pStartItem);
      ++removals;
    }
  }

  function equal(a, b) {
    return key(a) === key(b);
  }
}

function isUndefined(val) {
  return typeof val === 'undefined';
}

function keyMap(items, start, end, key) {
  var map = {};

  for (var i = start; i < end; ++i) {
    map[key(items[i])] = i;
  }

  return map;
}

/**
 * Exports
 */

exports.default = dift;
exports.CREATE = CREATE;
exports.UPDATE = UPDATE;
exports.MOVE = MOVE;
exports.REMOVE = REMOVE;
},{"bit-vector":104}],121:[function(require,module,exports){

module.exports =  require('./lib/');

},{"./lib/":122}],122:[function(require,module,exports){

module.exports = require('./socket');

/**
 * Exports parser
 *
 * @api public
 *
 */
module.exports.parser = require('engine.io-parser');

},{"./socket":123,"engine.io-parser":131}],123:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var transports = require('./transports');
var Emitter = require('component-emitter');
var debug = require('debug')('engine.io-client:socket');
var index = require('indexof');
var parser = require('engine.io-parser');
var parseuri = require('parseuri');
var parsejson = require('parsejson');
var parseqs = require('parseqs');

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Noop function.
 *
 * @api private
 */

function noop(){}

/**
 * Socket constructor.
 *
 * @param {String|Object} uri or options
 * @param {Object} options
 * @api public
 */

function Socket(uri, opts){
  if (!(this instanceof Socket)) return new Socket(uri, opts);

  opts = opts || {};

  if (uri && 'object' == typeof uri) {
    opts = uri;
    uri = null;
  }

  if (uri) {
    uri = parseuri(uri);
    opts.hostname = uri.host;
    opts.secure = uri.protocol == 'https' || uri.protocol == 'wss';
    opts.port = uri.port;
    if (uri.query) opts.query = uri.query;
  } else if (opts.host) {
    opts.hostname = parseuri(opts.host).host;
  }

  this.secure = null != opts.secure ? opts.secure :
    (global.location && 'https:' == location.protocol);

  if (opts.hostname && !opts.port) {
    // if no port is specified manually, use the protocol default
    opts.port = this.secure ? '443' : '80';
  }

  this.agent = opts.agent || false;
  this.hostname = opts.hostname ||
    (global.location ? location.hostname : 'localhost');
  this.port = opts.port || (global.location && location.port ?
       location.port :
       (this.secure ? 443 : 80));
  this.query = opts.query || {};
  if ('string' == typeof this.query) this.query = parseqs.decode(this.query);
  this.upgrade = false !== opts.upgrade;
  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
  this.forceJSONP = !!opts.forceJSONP;
  this.jsonp = false !== opts.jsonp;
  this.forceBase64 = !!opts.forceBase64;
  this.enablesXDR = !!opts.enablesXDR;
  this.timestampParam = opts.timestampParam || 't';
  this.timestampRequests = opts.timestampRequests;
  this.transports = opts.transports || ['polling', 'websocket'];
  this.readyState = '';
  this.writeBuffer = [];
  this.policyPort = opts.policyPort || 843;
  this.rememberUpgrade = opts.rememberUpgrade || false;
  this.binaryType = null;
  this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
  this.perMessageDeflate = false !== opts.perMessageDeflate ? (opts.perMessageDeflate || {}) : false;

  if (true === this.perMessageDeflate) this.perMessageDeflate = {};
  if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
    this.perMessageDeflate.threshold = 1024;
  }

  // SSL options for Node.js client
  this.pfx = opts.pfx || null;
  this.key = opts.key || null;
  this.passphrase = opts.passphrase || null;
  this.cert = opts.cert || null;
  this.ca = opts.ca || null;
  this.ciphers = opts.ciphers || null;
  this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? null : opts.rejectUnauthorized;

  // other options for Node.js client
  var freeGlobal = typeof global == 'object' && global;
  if (freeGlobal.global === freeGlobal) {
    if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
      this.extraHeaders = opts.extraHeaders;
    }
  }

  this.open();
}

Socket.priorWebsocketSuccess = false;

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Protocol version.
 *
 * @api public
 */

Socket.protocol = parser.protocol; // this is an int

/**
 * Expose deps for legacy compatibility
 * and standalone browser access.
 */

Socket.Socket = Socket;
Socket.Transport = require('./transport');
Socket.transports = require('./transports');
Socket.parser = require('engine.io-parser');

/**
 * Creates transport of the given type.
 *
 * @param {String} transport name
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name) {
  debug('creating transport "%s"', name);
  var query = clone(this.query);

  // append engine.io protocol identifier
  query.EIO = parser.protocol;

  // transport name
  query.transport = name;

  // session id if we already have one
  if (this.id) query.sid = this.id;

  var transport = new transports[name]({
    agent: this.agent,
    hostname: this.hostname,
    port: this.port,
    secure: this.secure,
    path: this.path,
    query: query,
    forceJSONP: this.forceJSONP,
    jsonp: this.jsonp,
    forceBase64: this.forceBase64,
    enablesXDR: this.enablesXDR,
    timestampRequests: this.timestampRequests,
    timestampParam: this.timestampParam,
    policyPort: this.policyPort,
    socket: this,
    pfx: this.pfx,
    key: this.key,
    passphrase: this.passphrase,
    cert: this.cert,
    ca: this.ca,
    ciphers: this.ciphers,
    rejectUnauthorized: this.rejectUnauthorized,
    perMessageDeflate: this.perMessageDeflate,
    extraHeaders: this.extraHeaders
  });

  return transport;
};

function clone (obj) {
  var o = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      o[i] = obj[i];
    }
  }
  return o;
}

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */
Socket.prototype.open = function () {
  var transport;
  if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') != -1) {
    transport = 'websocket';
  } else if (0 === this.transports.length) {
    // Emit error on next tick so it can be listened to
    var self = this;
    setTimeout(function() {
      self.emit('error', 'No transports available');
    }, 0);
    return;
  } else {
    transport = this.transports[0];
  }
  this.readyState = 'opening';

  // Retry with the next transport if the transport is disabled (jsonp: false)
  try {
    transport = this.createTransport(transport);
  } catch (e) {
    this.transports.shift();
    this.open();
    return;
  }

  transport.open();
  this.setTransport(transport);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Socket.prototype.setTransport = function(transport){
  debug('setting transport %s', transport.name);
  var self = this;

  if (this.transport) {
    debug('clearing existing transport %s', this.transport.name);
    this.transport.removeAllListeners();
  }

  // set up transport
  this.transport = transport;

  // set up transport listeners
  transport
  .on('drain', function(){
    self.onDrain();
  })
  .on('packet', function(packet){
    self.onPacket(packet);
  })
  .on('error', function(e){
    self.onError(e);
  })
  .on('close', function(){
    self.onClose('transport close');
  });
};

/**
 * Probes a transport.
 *
 * @param {String} transport name
 * @api private
 */

Socket.prototype.probe = function (name) {
  debug('probing transport "%s"', name);
  var transport = this.createTransport(name, { probe: 1 })
    , failed = false
    , self = this;

  Socket.priorWebsocketSuccess = false;

  function onTransportOpen(){
    if (self.onlyBinaryUpgrades) {
      var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
      failed = failed || upgradeLosesBinary;
    }
    if (failed) return;

    debug('probe transport "%s" opened', name);
    transport.send([{ type: 'ping', data: 'probe' }]);
    transport.once('packet', function (msg) {
      if (failed) return;
      if ('pong' == msg.type && 'probe' == msg.data) {
        debug('probe transport "%s" pong', name);
        self.upgrading = true;
        self.emit('upgrading', transport);
        if (!transport) return;
        Socket.priorWebsocketSuccess = 'websocket' == transport.name;

        debug('pausing current transport "%s"', self.transport.name);
        self.transport.pause(function () {
          if (failed) return;
          if ('closed' == self.readyState) return;
          debug('changing transport and sending upgrade packet');

          cleanup();

          self.setTransport(transport);
          transport.send([{ type: 'upgrade' }]);
          self.emit('upgrade', transport);
          transport = null;
          self.upgrading = false;
          self.flush();
        });
      } else {
        debug('probe transport "%s" failed', name);
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('upgradeError', err);
      }
    });
  }

  function freezeTransport() {
    if (failed) return;

    // Any callback called by transport should be ignored since now
    failed = true;

    cleanup();

    transport.close();
    transport = null;
  }

  //Handle any error that happens while probing
  function onerror(err) {
    var error = new Error('probe error: ' + err);
    error.transport = transport.name;

    freezeTransport();

    debug('probe transport "%s" failed because of error: %s', name, err);

    self.emit('upgradeError', error);
  }

  function onTransportClose(){
    onerror("transport closed");
  }

  //When the socket is closed while we're probing
  function onclose(){
    onerror("socket closed");
  }

  //When the socket is upgraded while we're probing
  function onupgrade(to){
    if (transport && to.name != transport.name) {
      debug('"%s" works - aborting "%s"', to.name, transport.name);
      freezeTransport();
    }
  }

  //Remove all listeners on the transport and on self
  function cleanup(){
    transport.removeListener('open', onTransportOpen);
    transport.removeListener('error', onerror);
    transport.removeListener('close', onTransportClose);
    self.removeListener('close', onclose);
    self.removeListener('upgrading', onupgrade);
  }

  transport.once('open', onTransportOpen);
  transport.once('error', onerror);
  transport.once('close', onTransportClose);

  this.once('close', onclose);
  this.once('upgrading', onupgrade);

  transport.open();

};

/**
 * Called when connection is deemed open.
 *
 * @api public
 */

Socket.prototype.onOpen = function () {
  debug('socket open');
  this.readyState = 'open';
  Socket.priorWebsocketSuccess = 'websocket' == this.transport.name;
  this.emit('open');
  this.flush();

  // we check for `readyState` in case an `open`
  // listener already closed the socket
  if ('open' == this.readyState && this.upgrade && this.transport.pause) {
    debug('starting upgrade probes');
    for (var i = 0, l = this.upgrades.length; i < l; i++) {
      this.probe(this.upgrades[i]);
    }
  }
};

/**
 * Handles a packet.
 *
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

    this.emit('packet', packet);

    // Socket is live - any packet counts
    this.emit('heartbeat');

    switch (packet.type) {
      case 'open':
        this.onHandshake(parsejson(packet.data));
        break;

      case 'pong':
        this.setPing();
        this.emit('pong');
        break;

      case 'error':
        var err = new Error('server error');
        err.code = packet.data;
        this.onError(err);
        break;

      case 'message':
        this.emit('data', packet.data);
        this.emit('message', packet.data);
        break;
    }
  } else {
    debug('packet received with socket readyState "%s"', this.readyState);
  }
};

/**
 * Called upon handshake completion.
 *
 * @param {Object} handshake obj
 * @api private
 */

Socket.prototype.onHandshake = function (data) {
  this.emit('handshake', data);
  this.id = data.sid;
  this.transport.query.sid = data.sid;
  this.upgrades = this.filterUpgrades(data.upgrades);
  this.pingInterval = data.pingInterval;
  this.pingTimeout = data.pingTimeout;
  this.onOpen();
  // In case open handler closes socket
  if  ('closed' == this.readyState) return;
  this.setPing();

  // Prolong liveness of socket on heartbeat
  this.removeListener('heartbeat', this.onHeartbeat);
  this.on('heartbeat', this.onHeartbeat);
};

/**
 * Resets ping timeout.
 *
 * @api private
 */

Socket.prototype.onHeartbeat = function (timeout) {
  clearTimeout(this.pingTimeoutTimer);
  var self = this;
  self.pingTimeoutTimer = setTimeout(function () {
    if ('closed' == self.readyState) return;
    self.onClose('ping timeout');
  }, timeout || (self.pingInterval + self.pingTimeout));
};

/**
 * Pings server every `this.pingInterval` and expects response
 * within `this.pingTimeout` or closes connection.
 *
 * @api private
 */

Socket.prototype.setPing = function () {
  var self = this;
  clearTimeout(self.pingIntervalTimer);
  self.pingIntervalTimer = setTimeout(function () {
    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
    self.ping();
    self.onHeartbeat(self.pingTimeout);
  }, self.pingInterval);
};

/**
* Sends a ping packet.
*
* @api private
*/

Socket.prototype.ping = function () {
  var self = this;
  this.sendPacket('ping', function(){
    self.emit('ping');
  });
};

/**
 * Called on `drain` event
 *
 * @api private
 */

Socket.prototype.onDrain = function() {
  this.writeBuffer.splice(0, this.prevBufferLen);

  // setting prevBufferLen = 0 is very important
  // for example, when upgrading, upgrade packet is sent over,
  // and a nonzero prevBufferLen could cause problems on `drain`
  this.prevBufferLen = 0;

  if (0 === this.writeBuffer.length) {
    this.emit('drain');
  } else {
    this.flush();
  }
};

/**
 * Flush write buffers.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  if ('closed' != this.readyState && this.transport.writable &&
    !this.upgrading && this.writeBuffer.length) {
    debug('flushing %d packets in socket', this.writeBuffer.length);
    this.transport.send(this.writeBuffer);
    // keep track of current length of writeBuffer
    // splice writeBuffer and callbackBuffer on `drain`
    this.prevBufferLen = this.writeBuffer.length;
    this.emit('flush');
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @param {Function} callback function.
 * @param {Object} options.
 * @return {Socket} for chaining.
 * @api public
 */

Socket.prototype.write =
Socket.prototype.send = function (msg, options, fn) {
  this.sendPacket('message', msg, options, fn);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @param {Object} options.
 * @param {Function} callback function.
 * @api private
 */

Socket.prototype.sendPacket = function (type, data, options, fn) {
  if('function' == typeof data) {
    fn = data;
    data = undefined;
  }

  if ('function' == typeof options) {
    fn = options;
    options = null;
  }

  if ('closing' == this.readyState || 'closed' == this.readyState) {
    return;
  }

  options = options || {};
  options.compress = false !== options.compress;

  var packet = {
    type: type,
    data: data,
    options: options
  };
  this.emit('packetCreate', packet);
  this.writeBuffer.push(packet);
  if (fn) this.once('flush', fn);
  this.flush();
};

/**
 * Closes the connection.
 *
 * @api private
 */

Socket.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.readyState = 'closing';

    var self = this;

    if (this.writeBuffer.length) {
      this.once('drain', function() {
        if (this.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      });
    } else if (this.upgrading) {
      waitForUpgrade();
    } else {
      close();
    }
  }

  function close() {
    self.onClose('forced close');
    debug('socket closing - telling transport to close');
    self.transport.close();
  }

  function cleanupAndClose() {
    self.removeListener('upgrade', cleanupAndClose);
    self.removeListener('upgradeError', cleanupAndClose);
    close();
  }

  function waitForUpgrade() {
    // wait for upgrade to finish since we can't send packets while pausing a transport
    self.once('upgrade', cleanupAndClose);
    self.once('upgradeError', cleanupAndClose);
  }

  return this;
};

/**
 * Called upon transport error
 *
 * @api private
 */

Socket.prototype.onError = function (err) {
  debug('socket error %j', err);
  Socket.priorWebsocketSuccess = false;
  this.emit('error', err);
  this.onClose('transport error', err);
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Socket.prototype.onClose = function (reason, desc) {
  if ('opening' == this.readyState || 'open' == this.readyState || 'closing' == this.readyState) {
    debug('socket close with reason: "%s"', reason);
    var self = this;

    // clear timers
    clearTimeout(this.pingIntervalTimer);
    clearTimeout(this.pingTimeoutTimer);

    // stop event from firing again for transport
    this.transport.removeAllListeners('close');

    // ensure transport won't stay open
    this.transport.close();

    // ignore further transport communication
    this.transport.removeAllListeners();

    // set ready state
    this.readyState = 'closed';

    // clear session id
    this.id = null;

    // emit close event
    this.emit('close', reason, desc);

    // clean buffers after, so users can still
    // grab the buffers on `close` event
    self.writeBuffer = [];
    self.prevBufferLen = 0;
  }
};

/**
 * Filters upgrades, returning only those matching client transports.
 *
 * @param {Array} server upgrades
 * @api private
 *
 */

Socket.prototype.filterUpgrades = function (upgrades) {
  var filteredUpgrades = [];
  for (var i = 0, j = upgrades.length; i<j; i++) {
    if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
  }
  return filteredUpgrades;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./transport":124,"./transports":125,"component-emitter":114,"debug":116,"engine.io-parser":131,"indexof":143,"parsejson":166,"parseqs":167,"parseuri":168}],124:[function(require,module,exports){
/**
 * Module dependencies.
 */

var parser = require('engine.io-parser');
var Emitter = require('component-emitter');

/**
 * Module exports.
 */

module.exports = Transport;

/**
 * Transport abstract constructor.
 *
 * @param {Object} options.
 * @api private
 */

function Transport (opts) {
  this.path = opts.path;
  this.hostname = opts.hostname;
  this.port = opts.port;
  this.secure = opts.secure;
  this.query = opts.query;
  this.timestampParam = opts.timestampParam;
  this.timestampRequests = opts.timestampRequests;
  this.readyState = '';
  this.agent = opts.agent || false;
  this.socket = opts.socket;
  this.enablesXDR = opts.enablesXDR;

  // SSL options for Node.js client
  this.pfx = opts.pfx;
  this.key = opts.key;
  this.passphrase = opts.passphrase;
  this.cert = opts.cert;
  this.ca = opts.ca;
  this.ciphers = opts.ciphers;
  this.rejectUnauthorized = opts.rejectUnauthorized;

  // other options for Node.js client
  this.extraHeaders = opts.extraHeaders;
}

/**
 * Mix in `Emitter`.
 */

Emitter(Transport.prototype);

/**
 * Emits an error.
 *
 * @param {String} str
 * @return {Transport} for chaining
 * @api public
 */

Transport.prototype.onError = function (msg, desc) {
  var err = new Error(msg);
  err.type = 'TransportError';
  err.description = desc;
  this.emit('error', err);
  return this;
};

/**
 * Opens the transport.
 *
 * @api public
 */

Transport.prototype.open = function () {
  if ('closed' == this.readyState || '' == this.readyState) {
    this.readyState = 'opening';
    this.doOpen();
  }

  return this;
};

/**
 * Closes the transport.
 *
 * @api private
 */

Transport.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.doClose();
    this.onClose();
  }

  return this;
};

/**
 * Sends multiple packets.
 *
 * @param {Array} packets
 * @api private
 */

Transport.prototype.send = function(packets){
  if ('open' == this.readyState) {
    this.write(packets);
  } else {
    throw new Error('Transport not open');
  }
};

/**
 * Called upon open
 *
 * @api private
 */

Transport.prototype.onOpen = function () {
  this.readyState = 'open';
  this.writable = true;
  this.emit('open');
};

/**
 * Called with data.
 *
 * @param {String} data
 * @api private
 */

Transport.prototype.onData = function(data){
  var packet = parser.decodePacket(data, this.socket.binaryType);
  this.onPacket(packet);
};

/**
 * Called with a decoded packet.
 */

Transport.prototype.onPacket = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon close.
 *
 * @api private
 */

Transport.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};

},{"component-emitter":114,"engine.io-parser":131}],125:[function(require,module,exports){
(function (global){
/**
 * Module dependencies
 */

var XMLHttpRequest = require('xmlhttprequest-ssl');
var XHR = require('./polling-xhr');
var JSONP = require('./polling-jsonp');
var websocket = require('./websocket');

/**
 * Export transports.
 */

exports.polling = polling;
exports.websocket = websocket;

/**
 * Polling transport polymorphic constructor.
 * Decides on xhr vs jsonp based on feature detection.
 *
 * @api private
 */

function polling(opts){
  var xhr;
  var xd = false;
  var xs = false;
  var jsonp = false !== opts.jsonp;

  if (global.location) {
    var isSSL = 'https:' == location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (!port) {
      port = isSSL ? 443 : 80;
    }

    xd = opts.hostname != location.hostname || port != opts.port;
    xs = opts.secure != isSSL;
  }

  opts.xdomain = xd;
  opts.xscheme = xs;
  xhr = new XMLHttpRequest(opts);

  if ('open' in xhr && !opts.forceJSONP) {
    return new XHR(opts);
  } else {
    if (!jsonp) throw new Error('JSONP disabled');
    return new JSONP(opts);
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling-jsonp":126,"./polling-xhr":127,"./websocket":129,"xmlhttprequest-ssl":130}],126:[function(require,module,exports){
(function (global){

/**
 * Module requirements.
 */

var Polling = require('./polling');
var inherit = require('component-inherit');

/**
 * Module exports.
 */

module.exports = JSONPPolling;

/**
 * Cached regular expressions.
 */

var rNewline = /\n/g;
var rEscapedNewline = /\\n/g;

/**
 * Global JSONP callbacks.
 */

var callbacks;

/**
 * Callbacks count.
 */

var index = 0;

/**
 * Noop.
 */

function empty () { }

/**
 * JSONP Polling constructor.
 *
 * @param {Object} opts.
 * @api public
 */

function JSONPPolling (opts) {
  Polling.call(this, opts);

  this.query = this.query || {};

  // define global callbacks array if not present
  // we do this here (lazily) to avoid unneeded global pollution
  if (!callbacks) {
    // we need to consider multiple engines in the same page
    if (!global.___eio) global.___eio = [];
    callbacks = global.___eio;
  }

  // callback identifier
  this.index = callbacks.length;

  // add callback to jsonp global
  var self = this;
  callbacks.push(function (msg) {
    self.onData(msg);
  });

  // append to query string
  this.query.j = this.index;

  // prevent spurious errors from being emitted when the window is unloaded
  if (global.document && global.addEventListener) {
    global.addEventListener('beforeunload', function () {
      if (self.script) self.script.onerror = empty;
    }, false);
  }
}

/**
 * Inherits from Polling.
 */

inherit(JSONPPolling, Polling);

/*
 * JSONP only supports binary as base64 encoded strings
 */

JSONPPolling.prototype.supportsBinary = false;

/**
 * Closes the socket.
 *
 * @api private
 */

JSONPPolling.prototype.doClose = function () {
  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  if (this.form) {
    this.form.parentNode.removeChild(this.form);
    this.form = null;
    this.iframe = null;
  }

  Polling.prototype.doClose.call(this);
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

JSONPPolling.prototype.doPoll = function () {
  var self = this;
  var script = document.createElement('script');

  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  script.async = true;
  script.src = this.uri();
  script.onerror = function(e){
    self.onError('jsonp poll error',e);
  };

  var insertAt = document.getElementsByTagName('script')[0];
  if (insertAt) {
    insertAt.parentNode.insertBefore(script, insertAt);
  }
  else {
    (document.head || document.body).appendChild(script);
  }
  this.script = script;

  var isUAgecko = 'undefined' != typeof navigator && /gecko/i.test(navigator.userAgent);
  
  if (isUAgecko) {
    setTimeout(function () {
      var iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      document.body.removeChild(iframe);
    }, 100);
  }
};

/**
 * Writes with a hidden iframe.
 *
 * @param {String} data to send
 * @param {Function} called upon flush.
 * @api private
 */

JSONPPolling.prototype.doWrite = function (data, fn) {
  var self = this;

  if (!this.form) {
    var form = document.createElement('form');
    var area = document.createElement('textarea');
    var id = this.iframeId = 'eio_iframe_' + this.index;
    var iframe;

    form.className = 'socketio';
    form.style.position = 'absolute';
    form.style.top = '-1000px';
    form.style.left = '-1000px';
    form.target = id;
    form.method = 'POST';
    form.setAttribute('accept-charset', 'utf-8');
    area.name = 'd';
    form.appendChild(area);
    document.body.appendChild(form);

    this.form = form;
    this.area = area;
  }

  this.form.action = this.uri();

  function complete () {
    initIframe();
    fn();
  }

  function initIframe () {
    if (self.iframe) {
      try {
        self.form.removeChild(self.iframe);
      } catch (e) {
        self.onError('jsonp polling iframe removal error', e);
      }
    }

    try {
      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
      var html = '<iframe src="javascript:0" name="'+ self.iframeId +'">';
      iframe = document.createElement(html);
    } catch (e) {
      iframe = document.createElement('iframe');
      iframe.name = self.iframeId;
      iframe.src = 'javascript:0';
    }

    iframe.id = self.iframeId;

    self.form.appendChild(iframe);
    self.iframe = iframe;
  }

  initIframe();

  // escape \n to prevent it from being converted into \r\n by some UAs
  // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
  data = data.replace(rEscapedNewline, '\\\n');
  this.area.value = data.replace(rNewline, '\\n');

  try {
    this.form.submit();
  } catch(e) {}

  if (this.iframe.attachEvent) {
    this.iframe.onreadystatechange = function(){
      if (self.iframe.readyState == 'complete') {
        complete();
      }
    };
  } else {
    this.iframe.onload = complete;
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling":128,"component-inherit":115}],127:[function(require,module,exports){
(function (global){
/**
 * Module requirements.
 */

var XMLHttpRequest = require('xmlhttprequest-ssl');
var Polling = require('./polling');
var Emitter = require('component-emitter');
var inherit = require('component-inherit');
var debug = require('debug')('engine.io-client:polling-xhr');

/**
 * Module exports.
 */

module.exports = XHR;
module.exports.Request = Request;

/**
 * Empty function
 */

function empty(){}

/**
 * XHR Polling constructor.
 *
 * @param {Object} opts
 * @api public
 */

function XHR(opts){
  Polling.call(this, opts);

  if (global.location) {
    var isSSL = 'https:' == location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (!port) {
      port = isSSL ? 443 : 80;
    }

    this.xd = opts.hostname != global.location.hostname ||
      port != opts.port;
    this.xs = opts.secure != isSSL;
  } else {
    this.extraHeaders = opts.extraHeaders;
  }
}

/**
 * Inherits from Polling.
 */

inherit(XHR, Polling);

/**
 * XHR supports binary
 */

XHR.prototype.supportsBinary = true;

/**
 * Creates a request.
 *
 * @param {String} method
 * @api private
 */

XHR.prototype.request = function(opts){
  opts = opts || {};
  opts.uri = this.uri();
  opts.xd = this.xd;
  opts.xs = this.xs;
  opts.agent = this.agent || false;
  opts.supportsBinary = this.supportsBinary;
  opts.enablesXDR = this.enablesXDR;

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;

  // other options for Node.js client
  opts.extraHeaders = this.extraHeaders;

  return new Request(opts);
};

/**
 * Sends data.
 *
 * @param {String} data to send.
 * @param {Function} called upon flush.
 * @api private
 */

XHR.prototype.doWrite = function(data, fn){
  var isBinary = typeof data !== 'string' && data !== undefined;
  var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
  var self = this;
  req.on('success', fn);
  req.on('error', function(err){
    self.onError('xhr post error', err);
  });
  this.sendXhr = req;
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

XHR.prototype.doPoll = function(){
  debug('xhr poll');
  var req = this.request();
  var self = this;
  req.on('data', function(data){
    self.onData(data);
  });
  req.on('error', function(err){
    self.onError('xhr poll error', err);
  });
  this.pollXhr = req;
};

/**
 * Request constructor
 *
 * @param {Object} options
 * @api public
 */

function Request(opts){
  this.method = opts.method || 'GET';
  this.uri = opts.uri;
  this.xd = !!opts.xd;
  this.xs = !!opts.xs;
  this.async = false !== opts.async;
  this.data = undefined != opts.data ? opts.data : null;
  this.agent = opts.agent;
  this.isBinary = opts.isBinary;
  this.supportsBinary = opts.supportsBinary;
  this.enablesXDR = opts.enablesXDR;

  // SSL options for Node.js client
  this.pfx = opts.pfx;
  this.key = opts.key;
  this.passphrase = opts.passphrase;
  this.cert = opts.cert;
  this.ca = opts.ca;
  this.ciphers = opts.ciphers;
  this.rejectUnauthorized = opts.rejectUnauthorized;

  // other options for Node.js client
  this.extraHeaders = opts.extraHeaders;

  this.create();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Creates the XHR object and sends the request.
 *
 * @api private
 */

Request.prototype.create = function(){
  var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;

  var xhr = this.xhr = new XMLHttpRequest(opts);
  var self = this;

  try {
    debug('xhr open %s: %s', this.method, this.uri);
    xhr.open(this.method, this.uri, this.async);
    try {
      if (this.extraHeaders) {
        xhr.setDisableHeaderCheck(true);
        for (var i in this.extraHeaders) {
          if (this.extraHeaders.hasOwnProperty(i)) {
            xhr.setRequestHeader(i, this.extraHeaders[i]);
          }
        }
      }
    } catch (e) {}
    if (this.supportsBinary) {
      // This has to be done after open because Firefox is stupid
      // http://stackoverflow.com/questions/13216903/get-binary-data-with-xmlhttprequest-in-a-firefox-extension
      xhr.responseType = 'arraybuffer';
    }

    if ('POST' == this.method) {
      try {
        if (this.isBinary) {
          xhr.setRequestHeader('Content-type', 'application/octet-stream');
        } else {
          xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
        }
      } catch (e) {}
    }

    // ie6 check
    if ('withCredentials' in xhr) {
      xhr.withCredentials = true;
    }

    if (this.hasXDR()) {
      xhr.onload = function(){
        self.onLoad();
      };
      xhr.onerror = function(){
        self.onError(xhr.responseText);
      };
    } else {
      xhr.onreadystatechange = function(){
        if (4 != xhr.readyState) return;
        if (200 == xhr.status || 1223 == xhr.status) {
          self.onLoad();
        } else {
          // make sure the `error` event handler that's user-set
          // does not throw in the same tick and gets caught here
          setTimeout(function(){
            self.onError(xhr.status);
          }, 0);
        }
      };
    }

    debug('xhr data %s', this.data);
    xhr.send(this.data);
  } catch (e) {
    // Need to defer since .create() is called directly fhrom the constructor
    // and thus the 'error' event can only be only bound *after* this exception
    // occurs.  Therefore, also, we cannot throw here at all.
    setTimeout(function() {
      self.onError(e);
    }, 0);
    return;
  }

  if (global.document) {
    this.index = Request.requestsCount++;
    Request.requests[this.index] = this;
  }
};

/**
 * Called upon successful response.
 *
 * @api private
 */

Request.prototype.onSuccess = function(){
  this.emit('success');
  this.cleanup();
};

/**
 * Called if we have data.
 *
 * @api private
 */

Request.prototype.onData = function(data){
  this.emit('data', data);
  this.onSuccess();
};

/**
 * Called upon error.
 *
 * @api private
 */

Request.prototype.onError = function(err){
  this.emit('error', err);
  this.cleanup(true);
};

/**
 * Cleans up house.
 *
 * @api private
 */

Request.prototype.cleanup = function(fromError){
  if ('undefined' == typeof this.xhr || null === this.xhr) {
    return;
  }
  // xmlhttprequest
  if (this.hasXDR()) {
    this.xhr.onload = this.xhr.onerror = empty;
  } else {
    this.xhr.onreadystatechange = empty;
  }

  if (fromError) {
    try {
      this.xhr.abort();
    } catch(e) {}
  }

  if (global.document) {
    delete Request.requests[this.index];
  }

  this.xhr = null;
};

/**
 * Called upon load.
 *
 * @api private
 */

Request.prototype.onLoad = function(){
  var data;
  try {
    var contentType;
    try {
      contentType = this.xhr.getResponseHeader('Content-Type').split(';')[0];
    } catch (e) {}
    if (contentType === 'application/octet-stream') {
      data = this.xhr.response;
    } else {
      if (!this.supportsBinary) {
        data = this.xhr.responseText;
      } else {
        try {
          data = String.fromCharCode.apply(null, new Uint8Array(this.xhr.response));
        } catch (e) {
          var ui8Arr = new Uint8Array(this.xhr.response);
          var dataArray = [];
          for (var idx = 0, length = ui8Arr.length; idx < length; idx++) {
            dataArray.push(ui8Arr[idx]);
          }

          data = String.fromCharCode.apply(null, dataArray);
        }
      }
    }
  } catch (e) {
    this.onError(e);
  }
  if (null != data) {
    this.onData(data);
  }
};

/**
 * Check if it has XDomainRequest.
 *
 * @api private
 */

Request.prototype.hasXDR = function(){
  return 'undefined' !== typeof global.XDomainRequest && !this.xs && this.enablesXDR;
};

/**
 * Aborts the request.
 *
 * @api public
 */

Request.prototype.abort = function(){
  this.cleanup();
};

/**
 * Aborts pending requests when unloading the window. This is needed to prevent
 * memory leaks (e.g. when using IE) and to ensure that no spurious error is
 * emitted.
 */

if (global.document) {
  Request.requestsCount = 0;
  Request.requests = {};
  if (global.attachEvent) {
    global.attachEvent('onunload', unloadHandler);
  } else if (global.addEventListener) {
    global.addEventListener('beforeunload', unloadHandler, false);
  }
}

function unloadHandler() {
  for (var i in Request.requests) {
    if (Request.requests.hasOwnProperty(i)) {
      Request.requests[i].abort();
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling":128,"component-emitter":114,"component-inherit":115,"debug":116,"xmlhttprequest-ssl":130}],128:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Transport = require('../transport');
var parseqs = require('parseqs');
var parser = require('engine.io-parser');
var inherit = require('component-inherit');
var yeast = require('yeast');
var debug = require('debug')('engine.io-client:polling');

/**
 * Module exports.
 */

module.exports = Polling;

/**
 * Is XHR2 supported?
 */

var hasXHR2 = (function() {
  var XMLHttpRequest = require('xmlhttprequest-ssl');
  var xhr = new XMLHttpRequest({ xdomain: false });
  return null != xhr.responseType;
})();

/**
 * Polling interface.
 *
 * @param {Object} opts
 * @api private
 */

function Polling(opts){
  var forceBase64 = (opts && opts.forceBase64);
  if (!hasXHR2 || forceBase64) {
    this.supportsBinary = false;
  }
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

inherit(Polling, Transport);

/**
 * Transport name.
 */

Polling.prototype.name = 'polling';

/**
 * Opens the socket (triggers polling). We write a PING message to determine
 * when the transport is open.
 *
 * @api private
 */

Polling.prototype.doOpen = function(){
  this.poll();
};

/**
 * Pauses polling.
 *
 * @param {Function} callback upon buffers are flushed and transport is paused
 * @api private
 */

Polling.prototype.pause = function(onPause){
  var pending = 0;
  var self = this;

  this.readyState = 'pausing';

  function pause(){
    debug('paused');
    self.readyState = 'paused';
    onPause();
  }

  if (this.polling || !this.writable) {
    var total = 0;

    if (this.polling) {
      debug('we are currently polling - waiting to pause');
      total++;
      this.once('pollComplete', function(){
        debug('pre-pause polling complete');
        --total || pause();
      });
    }

    if (!this.writable) {
      debug('we are currently writing - waiting to pause');
      total++;
      this.once('drain', function(){
        debug('pre-pause writing complete');
        --total || pause();
      });
    }
  } else {
    pause();
  }
};

/**
 * Starts polling cycle.
 *
 * @api public
 */

Polling.prototype.poll = function(){
  debug('polling');
  this.polling = true;
  this.doPoll();
  this.emit('poll');
};

/**
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function(data){
  var self = this;
  debug('polling got data %s', data);
  var callback = function(packet, index, total) {
    // if its the first message we consider the transport open
    if ('opening' == self.readyState) {
      self.onOpen();
    }

    // if its a close packet, we close the ongoing requests
    if ('close' == packet.type) {
      self.onClose();
      return false;
    }

    // otherwise bypass onData and handle the message
    self.onPacket(packet);
  };

  // decode payload
  parser.decodePayload(data, this.socket.binaryType, callback);

  // if an event did not trigger closing
  if ('closed' != this.readyState) {
    // if we got data we're not polling
    this.polling = false;
    this.emit('pollComplete');

    if ('open' == this.readyState) {
      this.poll();
    } else {
      debug('ignoring poll - transport state "%s"', this.readyState);
    }
  }
};

/**
 * For polling, send a close packet.
 *
 * @api private
 */

Polling.prototype.doClose = function(){
  var self = this;

  function close(){
    debug('writing close packet');
    self.write([{ type: 'close' }]);
  }

  if ('open' == this.readyState) {
    debug('transport open - closing');
    close();
  } else {
    // in case we're trying to close while
    // handshaking is in progress (GH-164)
    debug('transport not open - deferring close');
    this.once('open', close);
  }
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @param {Function} drain callback
 * @api private
 */

Polling.prototype.write = function(packets){
  var self = this;
  this.writable = false;
  var callbackfn = function() {
    self.writable = true;
    self.emit('drain');
  };

  var self = this;
  parser.encodePayload(packets, this.supportsBinary, function(data) {
    self.doWrite(data, callbackfn);
  });
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

Polling.prototype.uri = function(){
  var query = this.query || {};
  var schema = this.secure ? 'https' : 'http';
  var port = '';

  // cache busting is forced
  if (false !== this.timestampRequests) {
    query[this.timestampParam] = yeast();
  }

  if (!this.supportsBinary && !query.sid) {
    query.b64 = 1;
  }

  query = parseqs.encode(query);

  // avoid port if default for schema
  if (this.port && (('https' == schema && this.port != 443) ||
     ('http' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  var ipv6 = this.hostname.indexOf(':') !== -1;
  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
};

},{"../transport":124,"component-inherit":115,"debug":116,"engine.io-parser":131,"parseqs":167,"xmlhttprequest-ssl":130,"yeast":250}],129:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var Transport = require('../transport');
var parser = require('engine.io-parser');
var parseqs = require('parseqs');
var inherit = require('component-inherit');
var yeast = require('yeast');
var debug = require('debug')('engine.io-client:websocket');
var BrowserWebSocket = global.WebSocket || global.MozWebSocket;

/**
 * Get either the `WebSocket` or `MozWebSocket` globals
 * in the browser or try to resolve WebSocket-compatible
 * interface exposed by `ws` for Node-like environment.
 */

var WebSocket = BrowserWebSocket;
if (!WebSocket && typeof window === 'undefined') {
  try {
    WebSocket = require('ws');
  } catch (e) { }
}

/**
 * Module exports.
 */

module.exports = WS;

/**
 * WebSocket transport constructor.
 *
 * @api {Object} connection options
 * @api public
 */

function WS(opts){
  var forceBase64 = (opts && opts.forceBase64);
  if (forceBase64) {
    this.supportsBinary = false;
  }
  this.perMessageDeflate = opts.perMessageDeflate;
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

inherit(WS, Transport);

/**
 * Transport name.
 *
 * @api public
 */

WS.prototype.name = 'websocket';

/*
 * WebSockets support binary
 */

WS.prototype.supportsBinary = true;

/**
 * Opens socket.
 *
 * @api private
 */

WS.prototype.doOpen = function(){
  if (!this.check()) {
    // let probe timeout
    return;
  }

  var self = this;
  var uri = this.uri();
  var protocols = void(0);
  var opts = {
    agent: this.agent,
    perMessageDeflate: this.perMessageDeflate
  };

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;
  if (this.extraHeaders) {
    opts.headers = this.extraHeaders;
  }

  this.ws = BrowserWebSocket ? new WebSocket(uri) : new WebSocket(uri, protocols, opts);

  if (this.ws.binaryType === undefined) {
    this.supportsBinary = false;
  }

  if (this.ws.supports && this.ws.supports.binary) {
    this.supportsBinary = true;
    this.ws.binaryType = 'buffer';
  } else {
    this.ws.binaryType = 'arraybuffer';
  }

  this.addEventListeners();
};

/**
 * Adds event listeners to the socket
 *
 * @api private
 */

WS.prototype.addEventListeners = function(){
  var self = this;

  this.ws.onopen = function(){
    self.onOpen();
  };
  this.ws.onclose = function(){
    self.onClose();
  };
  this.ws.onmessage = function(ev){
    self.onData(ev.data);
  };
  this.ws.onerror = function(e){
    self.onError('websocket error', e);
  };
};

/**
 * Override `onData` to use a timer on iOS.
 * See: https://gist.github.com/mloughran/2052006
 *
 * @api private
 */

if ('undefined' != typeof navigator
  && /iPad|iPhone|iPod/i.test(navigator.userAgent)) {
  WS.prototype.onData = function(data){
    var self = this;
    setTimeout(function(){
      Transport.prototype.onData.call(self, data);
    }, 0);
  };
}

/**
 * Writes data to socket.
 *
 * @param {Array} array of packets.
 * @api private
 */

WS.prototype.write = function(packets){
  var self = this;
  this.writable = false;

  // encodePacket efficient as it uses WS framing
  // no need for encodePayload
  var total = packets.length;
  for (var i = 0, l = total; i < l; i++) {
    (function(packet) {
      parser.encodePacket(packet, self.supportsBinary, function(data) {
        if (!BrowserWebSocket) {
          // always create a new object (GH-437)
          var opts = {};
          if (packet.options) {
            opts.compress = packet.options.compress;
          }

          if (self.perMessageDeflate) {
            var len = 'string' == typeof data ? global.Buffer.byteLength(data) : data.length;
            if (len < self.perMessageDeflate.threshold) {
              opts.compress = false;
            }
          }
        }

        //Sometimes the websocket has already been closed but the browser didn't
        //have a chance of informing us about it yet, in that case send will
        //throw an error
        try {
          if (BrowserWebSocket) {
            // TypeError is thrown when passing the second argument on Safari
            self.ws.send(data);
          } else {
            self.ws.send(data, opts);
          }
        } catch (e){
          debug('websocket closed before onclose event');
        }

        --total || done();
      });
    })(packets[i]);
  }

  function done(){
    self.emit('flush');

    // fake drain
    // defer to next tick to allow Socket to clear writeBuffer
    setTimeout(function(){
      self.writable = true;
      self.emit('drain');
    }, 0);
  }
};

/**
 * Called upon close
 *
 * @api private
 */

WS.prototype.onClose = function(){
  Transport.prototype.onClose.call(this);
};

/**
 * Closes socket.
 *
 * @api private
 */

WS.prototype.doClose = function(){
  if (typeof this.ws !== 'undefined') {
    this.ws.close();
  }
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

WS.prototype.uri = function(){
  var query = this.query || {};
  var schema = this.secure ? 'wss' : 'ws';
  var port = '';

  // avoid port if default for schema
  if (this.port && (('wss' == schema && this.port != 443)
    || ('ws' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // append timestamp to URI
  if (this.timestampRequests) {
    query[this.timestampParam] = yeast();
  }

  // communicate binary support capabilities
  if (!this.supportsBinary) {
    query.b64 = 1;
  }

  query = parseqs.encode(query);

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  var ipv6 = this.hostname.indexOf(':') !== -1;
  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
};

/**
 * Feature detection for WebSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

WS.prototype.check = function(){
  return !!WebSocket && !('__initialize' in WebSocket && this.name === WS.prototype.name);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../transport":124,"component-inherit":115,"debug":116,"engine.io-parser":131,"parseqs":167,"ws":1,"yeast":250}],130:[function(require,module,exports){
// browser shim for xmlhttprequest module
var hasCORS = require('has-cors');

module.exports = function(opts) {
  var xdomain = opts.xdomain;

  // scheme must be same when usign XDomainRequest
  // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
  var xscheme = opts.xscheme;

  // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
  // https://github.com/Automattic/engine.io-client/pull/217
  var enablesXDR = opts.enablesXDR;

  // XMLHttpRequest can be disabled on IE
  try {
    if ('undefined' != typeof XMLHttpRequest && (!xdomain || hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) { }

  // Use XDomainRequest for IE8 if enablesXDR is true
  // because loading bar keeps flashing when using jsonp-polling
  // https://github.com/yujiosaka/socke.io-ie8-loading-example
  try {
    if ('undefined' != typeof XDomainRequest && !xscheme && enablesXDR) {
      return new XDomainRequest();
    }
  } catch (e) { }

  if (!xdomain) {
    try {
      return new ActiveXObject('Microsoft.XMLHTTP');
    } catch(e) { }
  }
}

},{"has-cors":141}],131:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var keys = require('./keys');
var hasBinary = require('has-binary');
var sliceBuffer = require('arraybuffer.slice');
var base64encoder = require('base64-arraybuffer');
var after = require('after');
var utf8 = require('utf8');

/**
 * Check if we are running an android browser. That requires us to use
 * ArrayBuffer with polling transports...
 *
 * http://ghinda.net/jpeg-blob-ajax-android/
 */

var isAndroid = navigator.userAgent.match(/Android/i);

/**
 * Check if we are running in PhantomJS.
 * Uploading a Blob with PhantomJS does not work correctly, as reported here:
 * https://github.com/ariya/phantomjs/issues/11395
 * @type boolean
 */
var isPhantomJS = /PhantomJS/i.test(navigator.userAgent);

/**
 * When true, avoids using Blobs to encode payloads.
 * @type boolean
 */
var dontSendBlobs = isAndroid || isPhantomJS;

/**
 * Current protocol version.
 */

exports.protocol = 3;

/**
 * Packet types.
 */

var packets = exports.packets = {
    open:     0    // non-ws
  , close:    1    // non-ws
  , ping:     2
  , pong:     3
  , message:  4
  , upgrade:  5
  , noop:     6
};

var packetslist = keys(packets);

/**
 * Premade error packet.
 */

var err = { type: 'error', data: 'parser error' };

/**
 * Create a blob api even for blob builder when vendor prefixes exist
 */

var Blob = require('blob');

/**
 * Encodes a packet.
 *
 *     <packet type id> [ <data> ]
 *
 * Example:
 *
 *     5hello world
 *     3
 *     4
 *
 * Binary is encoded in an identical principle
 *
 * @api private
 */

exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
  if ('function' == typeof supportsBinary) {
    callback = supportsBinary;
    supportsBinary = false;
  }

  if ('function' == typeof utf8encode) {
    callback = utf8encode;
    utf8encode = null;
  }

  var data = (packet.data === undefined)
    ? undefined
    : packet.data.buffer || packet.data;

  if (global.ArrayBuffer && data instanceof ArrayBuffer) {
    return encodeArrayBuffer(packet, supportsBinary, callback);
  } else if (Blob && data instanceof global.Blob) {
    return encodeBlob(packet, supportsBinary, callback);
  }

  // might be an object with { base64: true, data: dataAsBase64String }
  if (data && data.base64) {
    return encodeBase64Object(packet, callback);
  }

  // Sending data as a utf-8 string
  var encoded = packets[packet.type];

  // data fragment is optional
  if (undefined !== packet.data) {
    encoded += utf8encode ? utf8.encode(String(packet.data)) : String(packet.data);
  }

  return callback('' + encoded);

};

function encodeBase64Object(packet, callback) {
  // packet data is an object { base64: true, data: dataAsBase64String }
  var message = 'b' + exports.packets[packet.type] + packet.data.data;
  return callback(message);
}

/**
 * Encode packet helpers for binary types
 */

function encodeArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  var data = packet.data;
  var contentArray = new Uint8Array(data);
  var resultBuffer = new Uint8Array(1 + data.byteLength);

  resultBuffer[0] = packets[packet.type];
  for (var i = 0; i < contentArray.length; i++) {
    resultBuffer[i+1] = contentArray[i];
  }

  return callback(resultBuffer.buffer);
}

function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  var fr = new FileReader();
  fr.onload = function() {
    packet.data = fr.result;
    exports.encodePacket(packet, supportsBinary, true, callback);
  };
  return fr.readAsArrayBuffer(packet.data);
}

function encodeBlob(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  if (dontSendBlobs) {
    return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
  }

  var length = new Uint8Array(1);
  length[0] = packets[packet.type];
  var blob = new Blob([length.buffer, packet.data]);

  return callback(blob);
}

/**
 * Encodes a packet with binary data in a base64 string
 *
 * @param {Object} packet, has `type` and `data`
 * @return {String} base64 encoded message
 */

exports.encodeBase64Packet = function(packet, callback) {
  var message = 'b' + exports.packets[packet.type];
  if (Blob && packet.data instanceof global.Blob) {
    var fr = new FileReader();
    fr.onload = function() {
      var b64 = fr.result.split(',')[1];
      callback(message + b64);
    };
    return fr.readAsDataURL(packet.data);
  }

  var b64data;
  try {
    b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
  } catch (e) {
    // iPhone Safari doesn't let you apply with typed arrays
    var typed = new Uint8Array(packet.data);
    var basic = new Array(typed.length);
    for (var i = 0; i < typed.length; i++) {
      basic[i] = typed[i];
    }
    b64data = String.fromCharCode.apply(null, basic);
  }
  message += global.btoa(b64data);
  return callback(message);
};

/**
 * Decodes a packet. Changes format to Blob if requested.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data, binaryType, utf8decode) {
  // String data
  if (typeof data == 'string' || data === undefined) {
    if (data.charAt(0) == 'b') {
      return exports.decodeBase64Packet(data.substr(1), binaryType);
    }

    if (utf8decode) {
      try {
        data = utf8.decode(data);
      } catch (e) {
        return err;
      }
    }
    var type = data.charAt(0);

    if (Number(type) != type || !packetslist[type]) {
      return err;
    }

    if (data.length > 1) {
      return { type: packetslist[type], data: data.substring(1) };
    } else {
      return { type: packetslist[type] };
    }
  }

  var asArray = new Uint8Array(data);
  var type = asArray[0];
  var rest = sliceBuffer(data, 1);
  if (Blob && binaryType === 'blob') {
    rest = new Blob([rest]);
  }
  return { type: packetslist[type], data: rest };
};

/**
 * Decodes a packet encoded in a base64 string
 *
 * @param {String} base64 encoded message
 * @return {Object} with `type` and `data` (if any)
 */

exports.decodeBase64Packet = function(msg, binaryType) {
  var type = packetslist[msg.charAt(0)];
  if (!global.ArrayBuffer) {
    return { type: type, data: { base64: true, data: msg.substr(1) } };
  }

  var data = base64encoder.decode(msg.substr(1));

  if (binaryType === 'blob' && Blob) {
    data = new Blob([data]);
  }

  return { type: type, data: data };
};

/**
 * Encodes multiple messages (payload).
 *
 *     <length>:data
 *
 * Example:
 *
 *     11:hello world2:hi
 *
 * If any contents are binary, they will be encoded as base64 strings. Base64
 * encoded strings are marked with a b before the length specifier
 *
 * @param {Array} packets
 * @api private
 */

exports.encodePayload = function (packets, supportsBinary, callback) {
  if (typeof supportsBinary == 'function') {
    callback = supportsBinary;
    supportsBinary = null;
  }

  var isBinary = hasBinary(packets);

  if (supportsBinary && isBinary) {
    if (Blob && !dontSendBlobs) {
      return exports.encodePayloadAsBlob(packets, callback);
    }

    return exports.encodePayloadAsArrayBuffer(packets, callback);
  }

  if (!packets.length) {
    return callback('0:');
  }

  function setLengthHeader(message) {
    return message.length + ':' + message;
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, !isBinary ? false : supportsBinary, true, function(message) {
      doneCallback(null, setLengthHeader(message));
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(results.join(''));
  });
};

/**
 * Async array map using after
 */

function map(ary, each, done) {
  var result = new Array(ary.length);
  var next = after(ary.length, done);

  var eachWithIndex = function(i, el, cb) {
    each(el, function(error, msg) {
      result[i] = msg;
      cb(error, result);
    });
  };

  for (var i = 0; i < ary.length; i++) {
    eachWithIndex(i, ary[i], next);
  }
}

/*
 * Decodes data when a payload is maybe expected. Possible binary contents are
 * decoded from their base64 representation
 *
 * @param {String} data, callback method
 * @api public
 */

exports.decodePayload = function (data, binaryType, callback) {
  if (typeof data != 'string') {
    return exports.decodePayloadAsBinary(data, binaryType, callback);
  }

  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var packet;
  if (data == '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

  var length = ''
    , n, msg;

  for (var i = 0, l = data.length; i < l; i++) {
    var chr = data.charAt(i);

    if (':' != chr) {
      length += chr;
    } else {
      if ('' == length || (length != (n = Number(length)))) {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      msg = data.substr(i + 1, n);

      if (length != msg.length) {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      if (msg.length) {
        packet = exports.decodePacket(msg, binaryType, true);

        if (err.type == packet.type && err.data == packet.data) {
          // parser error in individual packet - ignoring payload
          return callback(err, 0, 1);
        }

        var ret = callback(packet, i + n, l);
        if (false === ret) return;
      }

      // advance cursor
      i += n;
      length = '';
    }
  }

  if (length != '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

};

/**
 * Encodes multiple messages (payload) as binary.
 *
 * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
 * 255><data>
 *
 * Example:
 * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
 *
 * @param {Array} packets
 * @return {ArrayBuffer} encoded payload
 * @api private
 */

exports.encodePayloadAsArrayBuffer = function(packets, callback) {
  if (!packets.length) {
    return callback(new ArrayBuffer(0));
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(data) {
      return doneCallback(null, data);
    });
  }

  map(packets, encodeOne, function(err, encodedPackets) {
    var totalLength = encodedPackets.reduce(function(acc, p) {
      var len;
      if (typeof p === 'string'){
        len = p.length;
      } else {
        len = p.byteLength;
      }
      return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
    }, 0);

    var resultArray = new Uint8Array(totalLength);

    var bufferIndex = 0;
    encodedPackets.forEach(function(p) {
      var isString = typeof p === 'string';
      var ab = p;
      if (isString) {
        var view = new Uint8Array(p.length);
        for (var i = 0; i < p.length; i++) {
          view[i] = p.charCodeAt(i);
        }
        ab = view.buffer;
      }

      if (isString) { // not true binary
        resultArray[bufferIndex++] = 0;
      } else { // true binary
        resultArray[bufferIndex++] = 1;
      }

      var lenStr = ab.byteLength.toString();
      for (var i = 0; i < lenStr.length; i++) {
        resultArray[bufferIndex++] = parseInt(lenStr[i]);
      }
      resultArray[bufferIndex++] = 255;

      var view = new Uint8Array(ab);
      for (var i = 0; i < view.length; i++) {
        resultArray[bufferIndex++] = view[i];
      }
    });

    return callback(resultArray.buffer);
  });
};

/**
 * Encode as Blob
 */

exports.encodePayloadAsBlob = function(packets, callback) {
  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(encoded) {
      var binaryIdentifier = new Uint8Array(1);
      binaryIdentifier[0] = 1;
      if (typeof encoded === 'string') {
        var view = new Uint8Array(encoded.length);
        for (var i = 0; i < encoded.length; i++) {
          view[i] = encoded.charCodeAt(i);
        }
        encoded = view.buffer;
        binaryIdentifier[0] = 0;
      }

      var len = (encoded instanceof ArrayBuffer)
        ? encoded.byteLength
        : encoded.size;

      var lenStr = len.toString();
      var lengthAry = new Uint8Array(lenStr.length + 1);
      for (var i = 0; i < lenStr.length; i++) {
        lengthAry[i] = parseInt(lenStr[i]);
      }
      lengthAry[lenStr.length] = 255;

      if (Blob) {
        var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
        doneCallback(null, blob);
      }
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(new Blob(results));
  });
};

/*
 * Decodes data when a payload is maybe expected. Strings are decoded by
 * interpreting each byte as a key code for entries marked to start with 0. See
 * description of encodePayloadAsBinary
 *
 * @param {ArrayBuffer} data, callback method
 * @api public
 */

exports.decodePayloadAsBinary = function (data, binaryType, callback) {
  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var bufferTail = data;
  var buffers = [];

  var numberTooLong = false;
  while (bufferTail.byteLength > 0) {
    var tailArray = new Uint8Array(bufferTail);
    var isString = tailArray[0] === 0;
    var msgLength = '';

    for (var i = 1; ; i++) {
      if (tailArray[i] == 255) break;

      if (msgLength.length > 310) {
        numberTooLong = true;
        break;
      }

      msgLength += tailArray[i];
    }

    if(numberTooLong) return callback(err, 0, 1);

    bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
    msgLength = parseInt(msgLength);

    var msg = sliceBuffer(bufferTail, 0, msgLength);
    if (isString) {
      try {
        msg = String.fromCharCode.apply(null, new Uint8Array(msg));
      } catch (e) {
        // iPhone Safari doesn't let you apply to typed arrays
        var typed = new Uint8Array(msg);
        msg = '';
        for (var i = 0; i < typed.length; i++) {
          msg += String.fromCharCode(typed[i]);
        }
      }
    }

    buffers.push(msg);
    bufferTail = sliceBuffer(bufferTail, msgLength);
  }

  var total = buffers.length;
  buffers.forEach(function(buffer, i) {
    callback(exports.decodePacket(buffer, binaryType, true), i, total);
  });
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./keys":132,"after":99,"arraybuffer.slice":100,"base64-arraybuffer":102,"blob":105,"has-binary":133,"utf8":197}],132:[function(require,module,exports){

/**
 * Gets the keys for an object.
 *
 * @return {Array} keys
 * @api private
 */

module.exports = Object.keys || function keys (obj){
  var arr = [];
  var has = Object.prototype.hasOwnProperty;

  for (var i in obj) {
    if (has.call(obj, i)) {
      arr.push(i);
    }
  }
  return arr;
};

},{}],133:[function(require,module,exports){
(function (global){

/*
 * Module requirements.
 */

var isArray = require('isarray');

/**
 * Module exports.
 */

module.exports = hasBinary;

/**
 * Checks for binary data.
 *
 * Right now only Buffer and ArrayBuffer are supported..
 *
 * @param {Object} anything
 * @api public
 */

function hasBinary(data) {

  function _hasBinary(obj) {
    if (!obj) return false;

    if ( (global.Buffer && global.Buffer.isBuffer(obj)) ||
         (global.ArrayBuffer && obj instanceof ArrayBuffer) ||
         (global.Blob && obj instanceof Blob) ||
         (global.File && obj instanceof File)
        ) {
      return true;
    }

    if (isArray(obj)) {
      for (var i = 0; i < obj.length; i++) {
          if (_hasBinary(obj[i])) {
              return true;
          }
      }
    } else if (obj && 'object' == typeof obj) {
      if (obj.toJSON) {
        obj = obj.toJSON();
      }

      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && _hasBinary(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }

  return _hasBinary(data);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"isarray":134}],134:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],135:[function(require,module,exports){
/**
 * Module Dependencies
 */

var Regexp = require('path-to-regexp')
var assign = require('object-assign')

/**
 * Export `Enroute`
 */

module.exports = Enroute

/**
 * Create `enroute`
 *
 * @param {Object} routes
 * @return {Function}
 */

function Enroute (routes) {
  return function enroute (location, props) {
    if (!location) throw new Error('enroute requires a location')
    props = props || {}
    var params = {}

    for (var route in routes) {
      var m = match(route, params, location)
      var fn = routes[route]

      if (m) {
        if (typeof fn !== 'function') return fn
        else return fn(params, props)
      }
    }

    return null
  }
}

/**
 * Check if this route matches `path`, if so
 * populate `params`.
 *
 * @param {String} path
 * @param {Object} params
 * @return {Boolean}
 * @api private
 */

function match(path, params, pathname) {
  var keys = [];
  var regexp = Regexp(path, keys);
  var m = regexp.exec(pathname);

  if (!m) return false;
  else if (!params) return true;

  for (var i = 1, len = m.length; i < len; ++i) {
    var key = keys[i - 1];
    var val = 'string' == typeof m[i] ? decodeURIComponent(m[i]) : m[i];
    if (key) params[key.name] = val;
  }

  return true;
}

},{"object-assign":165,"path-to-regexp":137}],136:[function(require,module,exports){
arguments[4][134][0].apply(exports,arguments)
},{"dup":134}],137:[function(require,module,exports){
var isarray = require('isarray')

/**
 * Expose `pathToRegexp`.
 */
module.exports = pathToRegexp
module.exports.parse = parse
module.exports.compile = compile
module.exports.tokensToFunction = tokensToFunction
module.exports.tokensToRegExp = tokensToRegExp

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^()])+)\\))?|\\(((?:\\\\.|[^()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g')

/**
 * Parse a string for the raw tokens.
 *
 * @param  {String} str
 * @return {Array}
 */
function parse (str) {
  var tokens = []
  var key = 0
  var index = 0
  var path = ''
  var res

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0]
    var escaped = res[1]
    var offset = res.index
    path += str.slice(index, offset)
    index = offset + m.length

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1]
      continue
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path)
      path = ''
    }

    var prefix = res[2]
    var name = res[3]
    var capture = res[4]
    var group = res[5]
    var suffix = res[6]
    var asterisk = res[7]

    var repeat = suffix === '+' || suffix === '*'
    var optional = suffix === '?' || suffix === '*'
    var delimiter = prefix || '/'
    var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?')

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      pattern: escapeGroup(pattern)
    })
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index)
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path)
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {String}   str
 * @return {Function}
 */
function compile (str) {
  return tokensToFunction(parse(str))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length)

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^' + tokens[i].pattern + '$')
    }
  }

  return function (obj) {
    var path = ''
    var data = obj || {}

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]

      if (typeof token === 'string') {
        path += token

        continue
      }

      var value = data[token.name]
      var segment

      if (value == null) {
        if (token.optional) {
          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received "' + value + '"')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encodeURIComponent(value[j])

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment
        }

        continue
      }

      segment = encodeURIComponent(value)

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {String} str
 * @return {String}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {String}
 */
function flags (options) {
  return options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {RegExp} path
 * @param  {Array}  keys
 * @return {RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g)

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        pattern: null
      })
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {Array}  path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = []

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source)
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options))

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {String} path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function stringToRegexp (path, keys, options) {
  var tokens = parse(path)
  var re = tokensToRegExp(tokens, options)

  // Attach keys back to the regexp.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] !== 'string') {
      keys.push(tokens[i])
    }
  }

  return attachKeys(re, keys)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {Array}  tokens
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function tokensToRegExp (tokens, options) {
  options = options || {}

  var strict = options.strict
  var end = options.end !== false
  var route = ''
  var lastToken = tokens[tokens.length - 1]
  var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken)

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]

    if (typeof token === 'string') {
      route += escapeString(token)
    } else {
      var prefix = escapeString(token.prefix)
      var capture = token.pattern

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*'
      }

      if (token.optional) {
        if (prefix) {
          capture = '(?:' + prefix + '(' + capture + '))?'
        } else {
          capture = '(' + capture + ')?'
        }
      } else {
        capture = prefix + '(' + capture + ')'
      }

      route += capture
    }
  }

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
  }

  if (end) {
    route += '$'
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithSlash ? '' : '(?=\\/|$)'
  }

  return new RegExp('^' + route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 [keys]
 * @param  {Object}                [options]
 * @return {RegExp}
 */
function pathToRegexp (path, keys, options) {
  keys = keys || []

  if (!isarray(keys)) {
    options = keys
    keys = []
  } else if (!options) {
    options = {}
  }

  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys, options)
  }

  if (isarray(path)) {
    return arrayToRegexp(path, keys, options)
  }

  return stringToRegexp(path, keys, options)
}

},{"isarray":136}],138:[function(require,module,exports){
'use strict';

var OneVersionConstraint = require('individual/one-version');

var MY_VERSION = '7';
OneVersionConstraint('ev-store', MY_VERSION);

var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

module.exports = EvStore;

function EvStore(elem) {
    var hash = elem[hashKey];

    if (!hash) {
        hash = elem[hashKey] = {};
    }

    return hash;
}

},{"individual/one-version":145}],139:[function(require,module,exports){
(function (global){

/*
 * Module requirements.
 */

var isArray = require('isarray');

/**
 * Module exports.
 */

module.exports = hasBinary;

/**
 * Checks for binary data.
 *
 * Right now only Buffer and ArrayBuffer are supported..
 *
 * @param {Object} anything
 * @api public
 */

function hasBinary(data) {

  function _hasBinary(obj) {
    if (!obj) return false;

    if ( (global.Buffer && global.Buffer.isBuffer && global.Buffer.isBuffer(obj)) ||
         (global.ArrayBuffer && obj instanceof ArrayBuffer) ||
         (global.Blob && obj instanceof Blob) ||
         (global.File && obj instanceof File)
        ) {
      return true;
    }

    if (isArray(obj)) {
      for (var i = 0; i < obj.length; i++) {
          if (_hasBinary(obj[i])) {
              return true;
          }
      }
    } else if (obj && 'object' == typeof obj) {
      // see: https://github.com/Automattic/has-binary/pull/4
      if (obj.toJSON && 'function' == typeof obj.toJSON) {
        obj = obj.toJSON();
      }

      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && _hasBinary(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }

  return _hasBinary(data);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"isarray":140}],140:[function(require,module,exports){
arguments[4][134][0].apply(exports,arguments)
},{"dup":134}],141:[function(require,module,exports){

/**
 * Module exports.
 *
 * Logic borrowed from Modernizr:
 *
 *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
 */

try {
  module.exports = typeof XMLHttpRequest !== 'undefined' &&
    'withCredentials' in new XMLHttpRequest();
} catch (err) {
  // if XMLHttp support is disabled in IE then it will throw
  // when trying to create
  module.exports = false;
}

},{}],142:[function(require,module,exports){
/*

	Hashids
	http://hashids.org/node-js
	(c) 2013 Ivan Akimov

	https://github.com/ivanakimov/hashids.node.js
	hashids may be freely distributed under the MIT license.

*/

/*jslint node: true, white: true, plusplus: true, nomen: true */

"use strict";

function Hashids(salt, minHashLength, alphabet) {

	var uniqueAlphabet, i, j, len, sepsLength, diff, guardCount;

	if (!(this instanceof Hashids)) {
		return new Hashids(salt, minHashLength, alphabet);
	}

	this.version = "1.0.2";

	/* internal settings */

	this.minAlphabetLength = 16;
	this.sepDiv = 3.5;
	this.guardDiv = 12;

	/* error messages */

	this.errorAlphabetLength = "error: alphabet must contain at least X unique characters";
	this.errorAlphabetSpace = "error: alphabet cannot contain spaces";

	/* alphabet vars */

	this.alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
	this.seps = "cfhistuCFHISTU";
	this.minHashLength = parseInt(minHashLength, 10) > 0 ? minHashLength : 0;
	this.salt = (typeof salt === "string") ? salt : "";

	if (typeof alphabet === "string") {
		this.alphabet = alphabet;
	}

	for (uniqueAlphabet = "", i = 0, len = this.alphabet.length; i !== len; i++) {
		if (uniqueAlphabet.indexOf(this.alphabet[i]) === -1) {
			uniqueAlphabet += this.alphabet[i];
		}
	}

	this.alphabet = uniqueAlphabet;

	if (this.alphabet.length < this.minAlphabetLength) {
		throw this.errorAlphabetLength.replace("X", this.minAlphabetLength);
	}

	if (this.alphabet.search(" ") !== -1) {
		throw this.errorAlphabetSpace;
	}

	/* seps should contain only characters present in alphabet; alphabet should not contains seps */

	for (i = 0, len = this.seps.length; i !== len; i++) {

		j = this.alphabet.indexOf(this.seps[i]);
		if (j === -1) {
			this.seps = this.seps.substr(0, i) + " " + this.seps.substr(i + 1);
		} else {
			this.alphabet = this.alphabet.substr(0, j) + " " + this.alphabet.substr(j + 1);
		}

	}

	this.alphabet = this.alphabet.replace(/ /g, "");

	this.seps = this.seps.replace(/ /g, "");
	this.seps = this.consistentShuffle(this.seps, this.salt);

	if (!this.seps.length || (this.alphabet.length / this.seps.length) > this.sepDiv) {

		sepsLength = Math.ceil(this.alphabet.length / this.sepDiv);

		if (sepsLength === 1) {
			sepsLength++;
		}

		if (sepsLength > this.seps.length) {

			diff = sepsLength - this.seps.length;
			this.seps += this.alphabet.substr(0, diff);
			this.alphabet = this.alphabet.substr(diff);

		} else {
			this.seps = this.seps.substr(0, sepsLength);
		}

	}

	this.alphabet = this.consistentShuffle(this.alphabet, this.salt);
	guardCount = Math.ceil(this.alphabet.length / this.guardDiv);

	if (this.alphabet.length < 3) {
		this.guards = this.seps.substr(0, guardCount);
		this.seps = this.seps.substr(guardCount);
	} else {
		this.guards = this.alphabet.substr(0, guardCount);
		this.alphabet = this.alphabet.substr(guardCount);
	}

}

Hashids.prototype.encode = function() {

	var ret = "",
		i, len,
		numbers = Array.prototype.slice.call(arguments);

	if (!numbers.length) {
		return ret;
	}

	if (numbers[0] instanceof Array) {
		numbers = numbers[0];
	}

	for (i = 0, len = numbers.length; i !== len; i++) {
		if (typeof numbers[i] !== "number" || numbers[i] % 1 !== 0 || numbers[i] < 0) {
			return ret;
		}
	}

	return this._encode(numbers);

};

Hashids.prototype.decode = function(hash) {

	var ret = [];

	if (!hash.length || typeof hash !== "string") {
		return ret;
	}

	return this._decode(hash, this.alphabet);

};

Hashids.prototype.encodeHex = function(str) {

	var i, len, numbers;

	str = str.toString();
	if (!/^[0-9a-fA-F]+$/.test(str)) {
		return "";
	}

	numbers = str.match(/[\w\W]{1,12}/g);

	for (i = 0, len = numbers.length; i !== len; i++) {
		numbers[i] = parseInt("1" + numbers[i], 16);
	}

	return this.encode.apply(this, numbers);

};

Hashids.prototype.decodeHex = function(hash) {

	var ret = "",
		i, len,
		numbers = this.decode(hash);

	for (i = 0, len = numbers.length; i !== len; i++) {
		ret += (numbers[i]).toString(16).substr(1);
	}

	return ret;

};

Hashids.prototype._encode = function(numbers) {

	var ret, lottery, i, len, number, buffer, last, sepsIndex, guardIndex, guard, halfLength, excess,
		alphabet = this.alphabet,
		numbersSize = numbers.length,
		numbersHashInt = 0;

	for (i = 0, len = numbers.length; i !== len; i++) {
		numbersHashInt += (numbers[i] % (i + 100));
	}

	lottery = ret = alphabet[numbersHashInt % alphabet.length];
	for (i = 0, len = numbers.length; i !== len; i++) {

		number = numbers[i];
		buffer = lottery + this.salt + alphabet;

		alphabet = this.consistentShuffle(alphabet, buffer.substr(0, alphabet.length));
		last = this.hash(number, alphabet);

		ret += last;

		if (i + 1 < numbersSize) {
			number %= (last.charCodeAt(0) + i);
			sepsIndex = number % this.seps.length;
			ret += this.seps[sepsIndex];
		}

	}

	if (ret.length < this.minHashLength) {

		guardIndex = (numbersHashInt + ret[0].charCodeAt(0)) % this.guards.length;
		guard = this.guards[guardIndex];

		ret = guard + ret;

		if (ret.length < this.minHashLength) {

			guardIndex = (numbersHashInt + ret[2].charCodeAt(0)) % this.guards.length;
			guard = this.guards[guardIndex];

			ret += guard;

		}

	}

	halfLength = parseInt(alphabet.length / 2, 10);
	while (ret.length < this.minHashLength) {

		alphabet = this.consistentShuffle(alphabet, alphabet);
		ret = alphabet.substr(halfLength) + ret + alphabet.substr(0, halfLength);

		excess = ret.length - this.minHashLength;
		if (excess > 0) {
			ret = ret.substr(excess / 2, this.minHashLength);
		}

	}

	return ret;

};

Hashids.prototype._decode = function(hash, alphabet) {

	var ret = [],
		i = 0,
		lottery, len, subHash, buffer,
		r = new RegExp("[" + this.guards + "]", "g"),
		hashBreakdown = hash.replace(r, " "),
		hashArray = hashBreakdown.split(" ");

	if (hashArray.length === 3 || hashArray.length === 2) {
		i = 1;
	}

	hashBreakdown = hashArray[i];
	if (typeof hashBreakdown[0] !== "undefined") {

		lottery = hashBreakdown[0];
		hashBreakdown = hashBreakdown.substr(1);

		r = new RegExp("[" + this.seps + "]", "g");
		hashBreakdown = hashBreakdown.replace(r, " ");
		hashArray = hashBreakdown.split(" ");

		for (i = 0, len = hashArray.length; i !== len; i++) {

			subHash = hashArray[i];
			buffer = lottery + this.salt + alphabet;

			alphabet = this.consistentShuffle(alphabet, buffer.substr(0, alphabet.length));
			ret.push(this.unhash(subHash, alphabet));

		}

		if (this._encode(ret) !== hash) {
			ret = [];
		}

	}

	return ret;

};

Hashids.prototype.consistentShuffle = function(alphabet, salt) {

	var integer, j, temp, i, v, p;

	if (!salt.length) {
		return alphabet;
	}

	for (i = alphabet.length - 1, v = 0, p = 0; i > 0; i--, v++) {

		v %= salt.length;
		p += integer = salt[v].charCodeAt(0);
		j = (integer + v + p) % i;

		temp = alphabet[j];
		alphabet = alphabet.substr(0, j) + alphabet[i] + alphabet.substr(j + 1);
		alphabet = alphabet.substr(0, i) + temp + alphabet.substr(i + 1);

	}

	return alphabet;

};

Hashids.prototype.hash = function(input, alphabet) {

	var hash = "",
		alphabetLength = alphabet.length;

	do {
		hash = alphabet[input % alphabetLength] + hash;
		input = parseInt(input / alphabetLength, 10);
	} while (input);

	return hash;

};

Hashids.prototype.unhash = function(input, alphabet) {

	var number = 0, pos, i;

	for (i = 0; i < input.length; i++) {
		pos = alphabet.indexOf(input[i]);
		number += pos * Math.pow(alphabet.length, input.length - i - 1);
	}

	return number;

};

module.exports = Hashids;

},{}],143:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],144:[function(require,module,exports){
(function (global){
'use strict';

/*global window, global*/

var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual;

function Individual(key, value) {
    if (key in root) {
        return root[key];
    }

    root[key] = value;

    return value;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],145:[function(require,module,exports){
'use strict';

var Individual = require('./index.js');

module.exports = OneVersion;

function OneVersion(moduleName, version, defaultValue) {
    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
    var enforceKey = key + '_ENFORCE_SINGLETON';

    var versionValue = Individual(enforceKey, version);

    if (versionValue !== version) {
        throw new Error('Can only have one copy of ' +
            moduleName + '.\n' +
            'You already have version ' + versionValue +
            ' installed.\n' +
            'This means you cannot install version ' + version);
    }

    return Individual(key, defaultValue);
}

},{"./index.js":144}],146:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],147:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clear = exports.detach = exports.attach = exports.toString = exports.use = undefined;

var _jss = require('jss');

/**
 * Constants
 */

var jss = (0, _jss.create)(); /**
                               * Imports
                               */

var sheets = [];
var map = {};

/**
 * JSS Simple
 */

function css(style, opts, key) {
  if ('string' === typeof opts) {
    key = opts;
    opts = undefined;
  }

  var sheet = jss.createStyleSheet(style, opts);

  if (key !== undefined) {
    if (map[key] !== undefined) {
      sheets[map[key]] = sheet;
      return sheet.classes;
    }

    map[key] = sheets.length;
  }

  sheets.push(sheet);
  return sheet.classes;
}

function use(plugin) {
  jss.use(plugin);
  return { use: use, toString: toString, attach: attach };
}

function toString() {
  return sheets.map(function (sheet) {
    return sheet.toString();
  }).join('\n');
}

function attach() {
  return sheets.forEach(function (sheet) {
    return sheet.attach();
  });
}

function detach() {
  return sheets.forEach(function (sheet) {
    return sheet.detach();
  });
}

function clear() {
  sheets = [];
  map = {};
}

/**
 * Exports
 */

exports.default = css;
exports.use = use;
exports.toString = toString;
exports.attach = attach;
exports.detach = detach;
exports.clear = clear;
},{"jss":156}],148:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _StyleSheet = require('./StyleSheet');

var _StyleSheet2 = _interopRequireDefault(_StyleSheet);

var _PluginsRegistry = require('./PluginsRegistry');

var _PluginsRegistry2 = _interopRequireDefault(_PluginsRegistry);

var _SheetsRegistry = require('./SheetsRegistry');

var _SheetsRegistry2 = _interopRequireDefault(_SheetsRegistry);

var _utils = require('./utils');

var _createRule2 = require('./createRule');

var _createRule3 = _interopRequireDefault(_createRule2);

var _findRenderer = require('./findRenderer');

var _findRenderer2 = _interopRequireDefault(_findRenderer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Main Jss class.
 *
 * @api public
 */

var Jss = function () {
  function Jss() {
    _classCallCheck(this, Jss);

    this.sheets = new _SheetsRegistry2.default();
    this.plugins = new _PluginsRegistry2.default();
    this.uid = _utils.uid;
    this.version = '3.10.0';
  }

  /**
   * Creates a new instance of Jss.
   *
   * @see Jss
   * @api public
   */


  _createClass(Jss, [{
    key: 'create',
    value: function create() {
      return new Jss();
    }

    /**
     * Create a stylesheet.
     *
     * @see StyleSheet
     * @api public
     */

  }, {
    key: 'createStyleSheet',
    value: function createStyleSheet(rules, options) {
      var sheet = new _StyleSheet2.default(rules, _extends({}, options, { jss: this }));
      this.sheets.add(sheet);
      return sheet;
    }

    /**
     * Create a rule.
     *
     * @see createRule
     * @api public
     */

  }, {
    key: 'createRule',
    value: function createRule(selector, style, options) {
      // Enable rule without selector.
      if ((typeof selector === 'undefined' ? 'undefined' : _typeof(selector)) == 'object') {
        options = style;
        style = selector;
        selector = null;
      }
      var rule = (0, _createRule3.default)(selector, style, _extends({}, options, {
        jss: this,
        Renderer: (0, _findRenderer2.default)(options)
      }));
      this.plugins.run(rule);
      return rule;
    }

    /**
     * Register plugin. Passed function will be invoked with a rule instance.
     *
     * @param {Function} plugins
     * @api public
     */

  }, {
    key: 'use',
    value: function use() {
      var _this = this;

      for (var _len = arguments.length, plugins = Array(_len), _key = 0; _key < _len; _key++) {
        plugins[_key] = arguments[_key];
      }

      plugins.forEach(function (plugin) {
        return _this.plugins.use(plugin);
      });
      return this;
    }
  }]);

  return Jss;
}();

exports.default = Jss;
},{"./PluginsRegistry":149,"./SheetsRegistry":150,"./StyleSheet":151,"./createRule":154,"./findRenderer":155,"./utils":162}],149:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Register a plugin, run a plugin.
 *
 * @api public
 */

var PluginsRegistry = function () {
  function PluginsRegistry() {
    _classCallCheck(this, PluginsRegistry);

    this.registry = [];
  }

  /**
   * Register plugin. Passed function will be invoked with a rule instance.
   *
   * @param {Function} fn
   * @api public
   */


  _createClass(PluginsRegistry, [{
    key: "use",
    value: function use(fn) {
      this.registry.push(fn);
    }

    /**
     * Execute all registered plugins.
     *
     * @param {Rule} rule
     * @api private
     */

  }, {
    key: "run",
    value: function run(rule) {
      for (var index = 0; index < this.registry.length; index++) {
        this.registry[index](rule);
      }
    }
  }]);

  return PluginsRegistry;
}();

exports.default = PluginsRegistry;
},{}],150:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Sheets registry to access them all at one place.
 *
 * @api public
 */

var SheetsRegistry = function () {
  function SheetsRegistry() {
    _classCallCheck(this, SheetsRegistry);

    this.registry = [];
  }

  /**
   * Register a style sheet.
   *
   * @param {StyleSheet} sheet
   * @api public
   */


  _createClass(SheetsRegistry, [{
    key: 'add',
    value: function add(sheet) {
      this.registry.push(sheet);
    }

    /**
     * Returns CSS string with all Style Sheets.
     *
     * @param {StyleSheet} sheet
     * @api public
     */

  }, {
    key: 'toString',
    value: function toString(options) {
      return this.registry.map(function (sheet) {
        return sheet.toString(options);
      }).join('\n');
    }
  }]);

  return SheetsRegistry;
}();

exports.default = SheetsRegistry;
},{}],151:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('./utils');

var _createRule2 = require('./createRule');

var _createRule3 = _interopRequireDefault(_createRule2);

var _findRenderer = require('./findRenderer');

var _findRenderer2 = _interopRequireDefault(_findRenderer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * StyleSheet model.
 *
 * Options:
 *
 *  - 'media' style element attribute
 *  - 'title' style element attribute
 *  - 'type' style element attribute
 *  - 'named' true by default - keys are names, selectors will be generated,
 *    if false - keys are global selectors
 *  - 'link' link renderable CSS rules with their corresponding models, false
 *    by default because fast by default
 *
 * @param {Object} [rules] object with selectors and declarations
 * @param {Object} [options]
 * @api public
 */

var StyleSheet = function () {
  function StyleSheet(rules, options) {
    _classCallCheck(this, StyleSheet);

    this.options = _extends({}, options);
    if (this.options.named == null) this.options.named = true;
    this.rules = Object.create(null);
    this.classes = Object.create(null);
    this.attached = false;
    this.deployed = false;
    this.linked = false;

    var Renderer = (0, _findRenderer2.default)(this.options);
    this.options.Renderer = Renderer;
    this.renderer = new Renderer(this.options);

    for (var name in rules) {
      this.createRule(name, rules[name]);
    }
  }

  /**
   * Attach renderable to the render tree.
   *
   * @api public
   * @return {StyleSheet}
   */


  _createClass(StyleSheet, [{
    key: 'attach',
    value: function attach() {
      if (this.attached) return this;
      if (!this.deployed) this.deploy();
      this.renderer.attach();
      if (!this.linked && this.options.link) this.link();
      this.attached = true;
      return this;
    }

    /**
     * Remove renderable from render tree.
     *
     * @return {StyleSheet}
     * @api public
     */

  }, {
    key: 'detach',
    value: function detach() {
      if (!this.attached) return this;
      this.renderer.detach();
      this.attached = false;
      return this;
    }

    /**
     * Add a rule to the current stylesheet. Will insert a rule also after the stylesheet
     * has been rendered first time.
     *
     * @param {Object} [name] can be selector or name if ´options.named is true
     * @param {Object} style property/value hash
     * @return {Rule}
     * @api public
     */

  }, {
    key: 'addRule',
    value: function addRule(name, style) {
      var rule = this.createRule(name, style);
      // Don't insert rule directly if there is no stringified version yet.
      // It will be inserted all together when .attach is called.
      if (this.deployed) {
        var renderable = this.renderer.insertRule(rule);
        if (this.options.link) rule.renderable = renderable;
      }
      return rule;
    }

    /**
     * Create rules, will render also after stylesheet was rendered the first time.
     *
     * @param {Object} rules name:style hash.
     * @return {Array} array of added rules
     * @api public
     */

  }, {
    key: 'addRules',
    value: function addRules(rules) {
      var added = [];
      for (var name in rules) {
        added.push(this.addRule(name, rules[name]));
      }
      return added;
    }

    /**
     * Get a rule.
     *
     * @param {String} name can be selector or name if `named` option is true.
     * @return {Rule}
     * @api public
     */

  }, {
    key: 'getRule',
    value: function getRule(name) {
      return this.rules[name];
    }

    /**
     * Convert rules to a CSS string.
     *
     * @param {Object} options
     * @return {String}
     * @api public
     */

  }, {
    key: 'toString',
    value: function toString(options) {
      var rules = this.rules;

      var stringified = Object.create(null);
      var str = '';
      for (var name in rules) {
        var rule = rules[name];
        // We have the same rule referenced twice if using named rules.
        // By name and by selector.
        if (stringified[rule.id]) {
          continue;
        }

        if (rule.style && (0, _utils.isEmptyObject)(rule.style)) {
          continue;
        }

        if (rule.rules && (0, _utils.isEmptyObject)(rule.rules)) {
          continue;
        }

        if (str) str += '\n';

        str += rule.toString(options);
        stringified[rule.id] = true;
      }
      return str;
    }

    /**
     * Create a rule, will not render after stylesheet was rendered the first time.
     * Will link the rule in `this.rules`.
     *
     * @see createRule
     * @api private
     */

  }, {
    key: 'createRule',
    value: function createRule(name, style, options) {
      options = _extends({}, options, {
        sheet: this,
        jss: this.options.jss,
        Renderer: this.options.Renderer
      });
      // Scope options overwrite instance options.
      if (options.named == null) options.named = this.options.named;
      var rule = (0, _createRule3.default)(name, style, options);
      this.registerRule(rule);
      options.jss.plugins.run(rule);
      return rule;
    }

    /**
     * Register a rule in `sheet.rules` and `sheet.classes` maps.
     *
     * @param {Rule} rule
     * @api public
     */

  }, {
    key: 'registerRule',
    value: function registerRule(rule) {
      // Children of container rules should not be registered.
      if (rule.options.parent) return this;

      if (rule.name) {
        this.rules[rule.name] = rule;
        if (rule.className) this.classes[rule.name] = rule.className;
      }
      if (rule.selector) {
        this.rules[rule.selector] = rule;
      }
      return this;
    }

    /**
     * Unregister a rule.
     *
     * @param {Rule} rule
     * @api public
     */

  }, {
    key: 'unregisterRule',
    value: function unregisterRule(rule) {
      // Children of container rules should not be unregistered.
      if (rule.options.parent) return this;
      delete this.rules[rule.name];
      delete this.rules[rule.selector];
      delete this.classes[rule.name];
      return this;
    }

    /**
     * Deploy pure CSS string to a renderable.
     *
     * @return {StyleSheet}
     * @api private
     */

  }, {
    key: 'deploy',
    value: function deploy() {
      this.renderer.deploy(this);
      this.deployed = true;
      return this;
    }

    /**
     * Link renderable CSS rules with their corresponding models.
     *
     * @return {StyleSheet}
     * @api private
     */

  }, {
    key: 'link',
    value: function link() {
      var renderables = this.renderer.getRules();
      for (var selector in renderables) {
        var rule = this.rules[selector];
        if (rule) rule.renderable = renderables[selector];
      }
      this.linked = true;
      return this;
    }
  }]);

  return StyleSheet;
}();

exports.default = StyleSheet;
},{"./createRule":154,"./findRenderer":155,"./utils":162}],152:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * DOM rendering backend for StyleSheet.
 *
 * @api private
 */

var DomRenderer = function () {
  _createClass(DomRenderer, null, [{
    key: 'style',
    value: function style(element, name, value) {
      try {
        if (value == null) return element.style[name];
        element.style[name] = value;
      } catch (err) {
        // IE8 may throw if property is unknown.
        return false;
      }
      return true;
    }
  }, {
    key: 'setSelector',
    value: function setSelector(cssRule, selector) {
      cssRule.selectorText = selector;

      // Return false if setter was not successful.
      // Currently works in chrome only.
      return cssRule.selectorText === selector;
    }
  }, {
    key: 'getSelector',
    value: function getSelector(cssRule) {
      return cssRule.selectorText;
    }
  }]);

  function DomRenderer(options) {
    _classCallCheck(this, DomRenderer);

    this.head = document.head || document.getElementsByTagName('head')[0];
    this.element = document.createElement('style');
    // IE8 will not have `styleSheet` prop without `type and `styleSheet.cssText`
    // is the only way to render on IE8.
    this.element.type = 'text/css';
    if (options.media) this.element.setAttribute('media', options.media);
    if (options.meta) this.element.setAttribute('data-meta', options.meta);
  }

  /**
   * Insert style element into render tree.
   *
   * @api private
   */


  _createClass(DomRenderer, [{
    key: 'attach',
    value: function attach() {
      this.head.appendChild(this.element);
    }

    /**
     * Remove style element from render tree.
     *
     * @api private
     */

  }, {
    key: 'detach',
    value: function detach() {
      this.element.parentNode.removeChild(this.element);
    }

    /**
     * Inject CSS string into element.
     *
     * @param {String} cssStr
     * @api private
     */

  }, {
    key: 'deploy',
    value: function deploy(sheet) {
      var css = '\n' + sheet.toString() + '\n';
      if ('sheet' in this.element) this.element.innerHTML = css;
      // On IE8 the only way to render is `styleSheet.cssText`.
      else if ('styleSheet' in this.element) this.element.styleSheet.cssText = css;
    }

    /**
     * Insert a rule into element.
     *
     * @param {Rule} rule
     * @return {CSSStyleRule}
     * @api private
     */

  }, {
    key: 'insertRule',
    value: function insertRule(rule) {
      // IE8 has only `styleSheet` and `styleSheet.rules`
      var sheet = this.element.sheet || this.element.styleSheet;
      var cssRules = sheet.cssRules || sheet.rules;
      var nextIndex = cssRules.length;
      if (sheet.insertRule) sheet.insertRule(rule.toString(), nextIndex);else sheet.addRule(rule.selector, rule.toString({ selector: false }), nextIndex);
      return cssRules[nextIndex];
    }

    /**
     * Get all rules elements.
     *
     * @return {Object} rules map, where key is selector, CSSStyleRule is value.
     * @api private
     */

  }, {
    key: 'getRules',
    value: function getRules() {
      // IE8 has only `styleSheet` and `styleSheet.rules`
      var sheet = this.element.sheet || this.element.styleSheet;
      var cssRules = sheet.rules || sheet.cssRules;
      var rules = Object.create(null);
      for (var index = 0; index < cssRules.length; index++) {
        var cssRule = cssRules[index];
        rules[cssRule.selectorText] = cssRule;
      }
      return rules;
    }
  }]);

  return DomRenderer;
}();

exports.default = DomRenderer;
},{}],153:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Rendering backend to do nothing in nodejs.
 */

var VirtualRenderer = function () {
  function VirtualRenderer() {
    _classCallCheck(this, VirtualRenderer);
  }

  _createClass(VirtualRenderer, [{
    key: "attach",
    value: function attach() {}
  }, {
    key: "detach",
    value: function detach() {}
  }, {
    key: "deploy",
    value: function deploy() {}
  }, {
    key: "insertRule",
    value: function insertRule() {}
  }, {
    key: "getRules",
    value: function getRules() {
      return {};
    }
  }], [{
    key: "style",
    value: function style() {}
  }, {
    key: "setSelector",
    value: function setSelector() {}
  }, {
    key: "getSelector",
    value: function getSelector() {}
  }]);

  return VirtualRenderer;
}();

exports.default = VirtualRenderer;
},{}],154:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createRule;

var _Rule = require('./rules/Rule');

var _Rule2 = _interopRequireDefault(_Rule);

var _SimpleRule = require('./rules/SimpleRule');

var _SimpleRule2 = _interopRequireDefault(_SimpleRule);

var _KeyframeRule = require('./rules/KeyframeRule');

var _KeyframeRule2 = _interopRequireDefault(_KeyframeRule);

var _ConditionalRule = require('./rules/ConditionalRule');

var _ConditionalRule2 = _interopRequireDefault(_ConditionalRule);

var _FontFaceRule = require('./rules/FontFaceRule');

var _FontFaceRule2 = _interopRequireDefault(_FontFaceRule);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Map of at rules to corresponding implementation class.
 *
 * @type {Object}
 */
var atRuleClassMap = {
  '@charset': _SimpleRule2.default,
  '@import': _SimpleRule2.default,
  '@namespace': _SimpleRule2.default,
  '@keyframes': _KeyframeRule2.default,
  '@media': _ConditionalRule2.default,
  '@supports': _ConditionalRule2.default,
  '@font-face': _FontFaceRule2.default
};

var atRuleNameRegExp = /^@[^ ]+/;

/**
 * Create rule factory.
 *
 * @param {Object} [selector] if you don't pass selector - it will be generated
 * @param {Object} [style] declarations block
 * @param {Object} [options] rule options
 * @return {Object} rule
 * @api private
 */
function createRule(selector) {
  var style = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  // Is an at-rule.
  if (selector && selector[0] === '@') {
    var name = atRuleNameRegExp.exec(selector)[0];
    var AtRule = atRuleClassMap[name];
    return new AtRule(selector, style, options);
  }

  if (options.named == null) options.named = true;
  return new _Rule2.default(selector, style, options);
}
},{"./rules/ConditionalRule":157,"./rules/FontFaceRule":158,"./rules/KeyframeRule":159,"./rules/Rule":160,"./rules/SimpleRule":161}],155:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = findRenderer;

var _DomRenderer = require('./backends/DomRenderer');

var _DomRenderer2 = _interopRequireDefault(_DomRenderer);

var _VirtualRenderer = require('./backends/VirtualRenderer');

var _VirtualRenderer2 = _interopRequireDefault(_VirtualRenderer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Find proper renderer.
 * Option `virtual` is used to force use of VirtualRenderer even if DOM is
 * detected, used for testing only.
 *
 * @param {Object} options
 * @return {Renderer}
 * @api private
 */
function findRenderer() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  if (options.Renderer) return options.Renderer;
  return options.virtual || typeof document == 'undefined' ? _VirtualRenderer2.default : _DomRenderer2.default;
}
},{"./backends/DomRenderer":152,"./backends/VirtualRenderer":153}],156:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Rule = exports.StyleSheet = exports.Jss = undefined;

var _Jss = require('./Jss');

var _Jss2 = _interopRequireDefault(_Jss);

var _StyleSheet = require('./StyleSheet');

var _StyleSheet2 = _interopRequireDefault(_StyleSheet);

var _Rule = require('./rules/Rule');

var _Rule2 = _interopRequireDefault(_Rule);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var jss = new _Jss2.default();

// Hotfix for babel 5 migration, will be removed in version 4.0.0
/**
 * StyleSheets written in javascript.
 *
 * @copyright Oleg Slobodskoi 2014-2016
 * @website https://github.com/jsstyles/jss
 * @license MIT
 */
module.exports = exports = jss;

// For testing only.
exports.Jss = _Jss2.default;
exports.StyleSheet = _StyleSheet2.default;
exports.Rule = _Rule2.default;
exports.default = jss;
},{"./Jss":148,"./StyleSheet":151,"./rules/Rule":160}],157:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('../utils');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Conditional rule for @media, @supports
 *
 * @api public
 */

var ConditionalRule = function () {
  function ConditionalRule(selector, styles, options) {
    _classCallCheck(this, ConditionalRule);

    this.id = _utils.uid.get();
    this.type = 'conditional';
    this.selector = selector;
    this.options = options;
    this.rules = Object.create(null);
    for (var name in styles) {
      this.createRule(name, styles[name]);
    }
  }

  /**
   * A conditional rule always contains child rules.
   *
   * @param {Object} styles
   * @return {Array} rules
   * @api public
   */


  _createClass(ConditionalRule, [{
    key: 'createRule',
    value: function createRule(name, style, options) {
      var newOptions = _extends({}, this.options, { parent: this });
      var _newOptions = newOptions;
      var sheet = _newOptions.sheet;
      var jss = _newOptions.jss;
      // We have already a rule in the current style sheet with this name,
      // This new rule is supposed to overwrite the first one, for this we need
      // to ensure it will have the same className/selector.

      var existingRule = sheet && sheet.getRule(name);
      var className = existingRule ? existingRule.className : null;
      if (className || options) {
        newOptions = _extends({}, newOptions, { className: className }, options);
      }
      var rule = (sheet || jss).createRule(name, style, newOptions);
      this.rules[name] = rule;
      return rule;
    }

    /**
     * Generates a CSS string.
     *
     * @return {String}
     * @api public
     */

  }, {
    key: 'toString',
    value: function toString() {
      var str = this.selector + ' {\n';
      for (var name in this.rules) {
        var rule = this.rules[name];
        if (rule.style && (0, _utils.isEmptyObject)(rule.style)) {
          continue;
        }
        var ruleStr = rule.toString({ indentationLevel: 1 });
        str += ruleStr + '\n';
      }
      str += '}';
      return str;
    }
  }]);

  return ConditionalRule;
}();

exports.default = ConditionalRule;
},{"../utils":162}],158:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('../utils');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Font-face rules.
 *
 * @api public
 */

var Rule = function () {
  function Rule(selector, style, options) {
    _classCallCheck(this, Rule);

    this.id = _utils.uid.get();
    this.type = 'font-face';
    this.options = options;
    this.selector = selector;
    this.style = style;
  }

  /**
   * Generates a CSS string.
   *
   * @see toCSS
   * @api public
   */


  _createClass(Rule, [{
    key: 'toString',
    value: function toString(options) {
      if (Array.isArray(this.style)) {
        var str = '';
        for (var index = 0; index < this.style.length; index++) {
          str += (0, _utils.toCSS)(this.selector, this.style[index], options);
          if (this.style[index + 1]) str += '\n';
        }
        return str;
      }

      return (0, _utils.toCSS)(this.selector, this.style, options);
    }
  }]);

  return Rule;
}();

exports.default = Rule;
},{"../utils":162}],159:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('../utils');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Keyframe rule.
 *
 * @api private
 */

var KeyframeRule = function () {
  function KeyframeRule(selector, frames, options) {
    _classCallCheck(this, KeyframeRule);

    this.id = _utils.uid.get();
    this.type = 'keyframe';
    this.selector = selector;
    this.options = options;
    this.frames = this.formatFrames(frames);
  }

  /**
   * Creates formatted frames where every frame value is a rule instance.
   *
   * @api private
   */


  _createClass(KeyframeRule, [{
    key: 'formatFrames',
    value: function formatFrames(frames) {
      var newFrames = Object.create(null);
      for (var name in frames) {
        var options = _extends({}, this.options, { named: false, parent: this });
        newFrames[name] = this.options.jss.createRule(name, frames[name], options);
      }
      return newFrames;
    }

    /**
     * Generates a CSS string.
     *
     * @return {String}
     * @api private
     */

  }, {
    key: 'toString',
    value: function toString() {
      var str = this.selector + ' {\n';
      var options = { indentationLevel: 1 };
      for (var name in this.frames) {
        str += this.frames[name].toString(options) + '\n';
      }
      str += '}';
      return str;
    }
  }]);

  return KeyframeRule;
}();

exports.default = KeyframeRule;
},{"../utils":162}],160:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('../utils');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var dotsRegExp = /[.]/g;
var classesRegExp = /[.][^ ,]+/g;

/**
 * Regular rules.
 *
 * @api public
 */

var Rule = function () {
  function Rule(selector, style, options) {
    _classCallCheck(this, Rule);

    this.id = _utils.uid.get();
    this.type = 'regular';
    this.options = options;
    this.selectorText = selector || '';
    this.className = '';
    if (options.named) {
      this.name = selector;
      var className = options.className || (this.name ? this.name + '--' + this.id : this.id);
      this.selectorText = '.' + className;
      this.className = className;
    }
    this.originalStyle = style;
    // We expect style to be plain object.
    this.style = (0, _utils.clone)(style);
  }

  /**
   * Set selector string.
   * Attenition: use this with caution. Most browser didn't implement selector
   * text setter, so this will result in rerendering of entire style sheet.
   *
   * @param {String} selector
   * @api public
   */


  _createClass(Rule, [{
    key: 'prop',


    /**
     * Get or set a style property.
     *
     * @param {String} name
     * @param {String|Number} [value]
     * @return {Rule|String|Number}
     * @api public
     */
    value: function prop(name, value) {
      var style = this.options.Renderer.style;
      // Its a setter.

      if (value != null) {
        this.style[name] = value;
        // Only defined if option linked is true.
        if (this.renderable) style(this.renderable, name, value);
        return this;
      }
      // Its a getter, read the value from the DOM if its not cached.
      if (this.renderable && this.style[name] == null) {
        // Cache the value after we have got it from the DOM once.
        this.style[name] = style(this.renderable, name);
      }
      return this.style[name];
    }

    /**
     * Apply rule to an element inline.
     *
     * @param {Element} renderable
     * @return {Rule}
     * @api public
     */

  }, {
    key: 'applyTo',
    value: function applyTo(renderable) {
      for (var prop in this.style) {
        var value = this.style[prop];
        var style = this.options.Renderer.style;

        if (Array.isArray(value)) {
          for (var index = 0; index < value.length; index++) {
            style(renderable, prop, value[index]);
          }
        } else style(renderable, prop, value);
      }
      return this;
    }

    /**
     * Returns JSON representation of the rule.
     * Array of values is not supported.
     *
     * @return {Object}
     * @api public
     */

  }, {
    key: 'toJSON',
    value: function toJSON() {
      var style = Object.create(null);
      for (var prop in this.style) {
        if (_typeof(this.style[prop]) != 'object') {
          style[prop] = this.style[prop];
        }
      }
      return style;
    }

    /**
     * Generates a CSS string.
     *
     * @see toCSS
     * @api public
     */

  }, {
    key: 'toString',
    value: function toString(options) {
      return (0, _utils.toCSS)(this.selector, this.style, options);
    }
  }, {
    key: 'selector',
    set: function set() {
      var selector = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
      var _options = this.options;
      var Renderer = _options.Renderer;
      var sheet = _options.sheet;

      // After we modify selector, ref by old selector needs to be removed.

      if (sheet) sheet.unregisterRule(this);

      this.selectorText = selector;
      var classes = selector.match(classesRegExp);
      if (classes) {
        this.className = classes.join(' ').replace(dotsRegExp, '');
      }

      if (!this.renderable) {
        // Register the rule with new selector.
        if (sheet) sheet.registerRule(this);
        return;
      }

      var changed = Renderer.setSelector(this.renderable, selector);

      if (changed) {
        sheet.registerRule(this);
        return;
      }

      // If selector setter is not implemented, rerender the sheet.
      // We need to delete renderable from the rule, because when sheet.deploy()
      // calls rule.toString, it will get the old selector.
      delete this.renderable;
      sheet.registerRule(this).deploy().link();
    }

    /**
     * Get selector string.
     *
     * @return {String}
     * @api public
     */
    ,
    get: function get() {
      if (this.renderable) {
        return this.options.Renderer.getSelector(this.renderable);
      }

      return this.selectorText;
    }
  }]);

  return Rule;
}();

exports.default = Rule;
},{"../utils":162}],161:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('../utils');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Rule like @charset, @import, @namespace.
 *
 * @api public
 */

var SimpleRule = function () {
  function SimpleRule(name, value, options) {
    _classCallCheck(this, SimpleRule);

    this.id = _utils.uid.get();
    this.type = 'simple';
    this.name = name;
    this.value = value;
    this.options = options;
  }

  /**
   * Generates a CSS string.
   *
   * @return {String}
   * @api public
   */


  _createClass(SimpleRule, [{
    key: 'toString',
    value: function toString() {
      if (Array.isArray(this.value)) {
        var str = '';
        for (var index = 0; index < this.value.length; index++) {
          str += this.name + ' ' + this.value[index] + ';';
          if (this.value[index + 1]) str += '\n';
        }
        return str;
      }

      return this.name + ' ' + this.value + ';';
    }
  }]);

  return SimpleRule;
}();

exports.default = SimpleRule;
},{"../utils":162}],162:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clone = clone;
exports.isEmptyObject = isEmptyObject;
exports.toCSS = toCSS;
var stringify = JSON.stringify;
var parse = JSON.parse;

/**
 * Deeply clone object using serialization.
 * Expects object to be plain and without cyclic dependencies.
 *
 * http://jsperf.com/lodash-deepclone-vs-jquery-extend-deep/6
 *
 * @type {Object} obj
 * @return {Object}
 */
function clone(obj) {
  return parse(stringify(obj));
}

/**
 * Determine whether an object is empty or not.
 * More performant than a `Object.keys(obj).length > 0`
 *
 * @type {Object} obj
 * @return {Boolean}
 */
function isEmptyObject(obj) {
  for (var key in obj) {
    return false;
  } // eslint-disable-line no-unused-vars

  return true;
}

/**
 * Simple very fast UID generation based on a global counter.
 */
var uid = exports.uid = function () {
  var globalReference = typeof window == 'undefined' ? global : window;
  var namespace = '__JSS_VERSION_COUNTER__';
  if (globalReference[namespace] == null) globalReference[namespace] = 0;

  // In case we have more than one jss version.
  var versionCounter = globalReference[namespace]++;
  var ruleCounter = 0;

  /**
   * Returns a uid.
   * Ensures uniqueness if more than 1 jss version is used.
   *
   * @api public
   * @return {String}
   */
  function get() {
    return 'jss-' + versionCounter + '-' + ruleCounter++;
  }

  /**
   * Resets the counter.
   *
   * @api public
   */
  function reset() {
    ruleCounter = 0;
  }

  return { get: get, reset: reset };
}();

/**
 * Converts a Rule to CSS string.
 *
 * Options:
 * - `selector` use `false` to get a rule without selector
 * - `indentationLevel` level of indentation
 *
 * @param {String} selector
 * @param {Object} style
 * @param {Object} options
 * @return {String}
 */
function toCSS(selector, style) {
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var indentationLevel = options.indentationLevel || 0;
  var str = '';

  if (options.selector !== false) {
    str += indent(indentationLevel, selector + ' {');
    indentationLevel++;
  }

  for (var prop in style) {
    var value = style[prop];
    // We want to generate multiple style with identical property names.
    if (Array.isArray(value)) {
      for (var index = 0; index < value.length; index++) {
        str += '\n' + indent(indentationLevel, prop + ': ' + value[index] + ';');
      }
    } else str += '\n' + indent(indentationLevel, prop + ': ' + value + ';');
  }

  if (options.selector !== false) str += '\n' + indent(--indentationLevel, '}');

  return str;
}

/**
 * Indent a string.
 *
 * http://jsperf.com/array-join-vs-for
 *
 * @param {Number} level
 * @param {String} str
 * @return {String}
 */
function indent(level, str) {
  var indentStr = '';
  for (var index = 0; index < level; index++) {
    indentStr += '  ';
  }return indentStr + str;
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],163:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.empty = exports.del = exports.get = exports.set = undefined;

var _popcount = require('@f/popcount');

var _popcount2 = _interopRequireDefault(_popcount);

var _hashStr = require('@f/hash-str');

var _hashStr2 = _interopRequireDefault(_hashStr);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

/**
 * Imports
 */

var bits = 5;
var size = Math.pow(2, bits);
var mask = size - 1;

/**
 * Types
 */

var LEAF = 'LEAF';
var BRANCH = 'BRANCH';
var COLLISION = 'COLLISION';

/**
 * Mini HAMT
 */

var empty = createBranch();

function set(hamt, key, value) {
  var code = (0, _hashStr2.default)(key);
  return insert(hamt, code, key, value);
}

function insert(node, code, key, value) {
  var depth = arguments.length <= 4 || arguments[4] === undefined ? 0 : arguments[4];

  var frag = getFrag(code, depth);
  var mask = 1 << frag;

  switch (node.type) {
    case LEAF:
      {
        if (node.code === code) {
          if (node.key === key) {
            return createLeaf(code, key, value);
          }

          return createCollision(code, [node, createLeaf(code, key, value)]);
        } else {
          var prevFrag = getFrag(node.code, depth);

          if (prevFrag === frag) {
            // XXX Optimize this
            return createBranch(mask, [insert(insert(empty, code, key, value, depth + 1), node.code, node.key, node.value, depth + 1)]);
          }

          var prevMask = 1 << prevFrag;
          var children = prevFrag < frag ? [node, createLeaf(code, key, value)] : [createLeaf(code, key, value), node];

          return createBranch(mask | prevMask, children);
        }
      }
    case BRANCH:
      {
        var idx = (0, _popcount2.default)(node.mask, frag);
        var children = node.children;

        // If there is already a node for this bit, recurse
        if (node.mask & mask) {
          var child = children[idx];
          return createBranch(node.mask, arrayReplace(children, idx, insert(child, code, key, value, depth + 1)));
        } else {
          return createBranch(node.mask | mask, arrayInsert(children, idx, createLeaf(code, key, value)));
        }
      }
    case COLLISION:
      {
        for (var i = 0, len = node.children.length; i < len; ++i) {
          if (node.children[i].key === key) {
            return createCollision(node.code, arrayReplace(node.children, i, createLeaf(code, key, value)));
          }
        }

        return createCollision(node.code, node.children.concat(createLeaf(code, key, value)));
      }
  }
}

function get(hamt, key) {
  var code = (0, _hashStr2.default)(key);
  var node = hamt;
  var depth = -1;

  while (true) {
    ++depth;

    switch (node.type) {
      case BRANCH:
        {
          var frag = getFrag(code, depth);
          var _mask = 1 << frag;
          if (node.mask & _mask) {
            var idx = (0, _popcount2.default)(node.mask, frag);
            node = node.children[idx];
            continue;
          } else {
            return;
          }
        }
      case COLLISION:
        {
          for (var i = 0, len = node.children.length; i < len; ++i) {
            var child = node.children[i];
            if (child.key === key) {
              return child.value;
            }
          }

          return undefined;
        }
      case LEAF:
        {
          return node.key === key ? node.value : undefined;
        }
    }
  }
}

function del(hamt, key) {
  var code = (0, _hashStr2.default)(key);
  var res = remove(hamt, code, key, 0);
  if (res === undefined) return hamt;
  if (res === null) return empty;
  return res;
}

function remove(node, code, key, depth) {
  var frag = getFrag(code, depth);
  var mask = 1 << frag;

  switch (node.type) {
    case LEAF:
      {
        // null means remove, undefined
        // means do nothing
        return node.key === key ? null : undefined;
      }
    case BRANCH:
      {
        if (node.mask & mask) {
          var idx = (0, _popcount2.default)(node.mask, frag);
          var res = remove(node.children[idx], code, key, depth + 1);
          if (res === null) {
            var newMask = node.mask & ~mask;

            if (newMask === 0) {
              return null;
            } else {
              return createBranch(newMask, arrayRemove(node.children, idx));
            }
          } else if (res === undefined) {
            return undefined;
          } else {
            return createBranch(node.mask, node.children);
          }
        } else {
          return undefined;
        }
      }
    case COLLISION:
      {
        if (node.code === code) {
          for (var i = 0, len = node.children.length; i < len; ++i) {
            var child = node.children[i];

            if (child.key === key) {
              return createCollision(node.code, arrayRemove(node.children, i));
            }
          }
        }

        return undefined;
      }
  }
}

/**
 * Node creators
 */

function createBranch() {
  var mask = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];
  var children = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

  return {
    type: BRANCH,
    mask: mask,
    children: children
  };
}

function createCollision(code, children) {
  return {
    type: COLLISION,
    code: code,
    children: children
  };
}

function createLeaf(code, key, value) {
  return {
    type: LEAF,
    code: code,
    key: key,
    value: value
  };
}

/**
 * Helpers
 */

function arrayInsert(arr, idx, item) {
  arr = arr.slice();
  arr.splice(idx, 0, item);
  return arr;
}

function arrayRemove(arr, idx) {
  arr = arr.slice();
  arr.splice(idx, 1);
  return arr;
}

function arrayReplace(arr, idx, item) {
  arr = arr.slice();
  arr[idx] = item;
  return arr;
}

function getFrag(code, depth) {
  return code >>> 4 * depth & mask;
}

/**
 * Exports
 */

exports.set = set;
exports.get = get;
exports.del = del;
exports.empty = empty;
},{"@f/hash-str":45,"@f/popcount":78}],164:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],165:[function(require,module,exports){
'use strict';
/* eslint-disable no-unused-vars */
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (e) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (Object.getOwnPropertySymbols) {
			symbols = Object.getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],166:[function(require,module,exports){
(function (global){
/**
 * JSON parse.
 *
 * @see Based on jQuery#parseJSON (MIT) and JSON2
 * @api private
 */

var rvalidchars = /^[\],:{}\s]*$/;
var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
var rtrimLeft = /^\s+/;
var rtrimRight = /\s+$/;

module.exports = function parsejson(data) {
  if ('string' != typeof data || !data) {
    return null;
  }

  data = data.replace(rtrimLeft, '').replace(rtrimRight, '');

  // Attempt to parse using the native JSON parser first
  if (global.JSON && JSON.parse) {
    return JSON.parse(data);
  }

  if (rvalidchars.test(data.replace(rvalidescape, '@')
      .replace(rvalidtokens, ']')
      .replace(rvalidbraces, ''))) {
    return (new Function('return ' + data))();
  }
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],167:[function(require,module,exports){
/**
 * Compiles a querystring
 * Returns string representation of the object
 *
 * @param {Object}
 * @api private
 */

exports.encode = function (obj) {
  var str = '';

  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (str.length) str += '&';
      str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
    }
  }

  return str;
};

/**
 * Parses a simple querystring into an object
 *
 * @param {String} qs
 * @api private
 */

exports.decode = function(qs){
  var qry = {};
  var pairs = qs.split('&');
  for (var i = 0, l = pairs.length; i < l; i++) {
    var pair = pairs[i].split('=');
    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return qry;
};

},{}],168:[function(require,module,exports){
/**
 * Parses an URI
 *
 * @author Steven Levithan <stevenlevithan.com> (MIT license)
 * @api private
 */

var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

var parts = [
    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
];

module.exports = function parseuri(str) {
    var src = str,
        b = str.indexOf('['),
        e = str.indexOf(']');

    if (b != -1 && e != -1) {
        str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
    }

    var m = re.exec(str || ''),
        uri = {},
        i = 14;

    while (i--) {
        uri[parts[i]] = m[i] || '';
    }

    if (b != -1 && e != -1) {
        uri.source = src;
        uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
        uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
        uri.ipv6uri = true;
    }

    return uri;
};

},{}],169:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bindUrl = exports.setUrl = exports.getUrl = undefined;

var _bindUrl = require('bind-url');

var _bindUrl2 = _interopRequireDefault(_bindUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Action types
 */

var GET_URL = 'EFFECT_GET_URL'; /**
                                 * Imports
                                 */

var SET_URL = 'EFFECT_SET_URL';
var BIND_URL = 'EFFECT_BIND_URL';

/**
 * Vars
 */

var types = [GET_URL, SET_URL, BIND_URL];
var handlers = [];

/**
 * Location effects
 */

function locationMiddleware() {
  var wnd = arguments.length <= 0 || arguments[0] === undefined ? window : arguments[0];

  var handle = typeof wnd === 'string' ? serverHandle : browserHandle;

  return function (_ref) {
    var dispatch = _ref.dispatch;

    return function (next) {
      return function (action) {
        return types.indexOf(action.type) !== -1 ? Promise.resolve(handle(wnd, dispatch, action)) : next(action);
      };
    };
  };
}

/**
 * Server handler
 */

function serverHandle(url, dispatch, action) {
  switch (action.type) {
    case GET_URL:
      return url;
    case BIND_URL:
      var cb = action.payload.update;
      setTimeout(function () {
        return dispatch(cb(url));
      });
      break;
  }
}

/**
 * Browser handler
 */

function browserHandle(wnd, dispatch, action) {
  switch (action.type) {
    case GET_URL:
      return wnd.location.pathname + wnd.location.search;
    case SET_URL:
      var url = action.payload.value;

      action.payload.replace ? wnd.history.replaceState(null, null, url) : wnd.history.pushState(null, null, url);

      handlers.forEach(function (fn) {
        return dispatch(fn(url));
      });
      break;
    case BIND_URL:
      var cb = action.payload.update;
      (0, _bindUrl2.default)({ wnd: wnd }, function (url) {
        return dispatch(cb(url));
      });
      handlers.push(cb);
      break;
  }
}

/**
 * Action creators
 */

function getUrl() {
  return {
    type: GET_URL
  };
}

function setUrl(url) {
  return {
    type: SET_URL,
    payload: {
      value: url
    }
  };
}

function bindUrl(fn) {
  return {
    type: BIND_URL,
    payload: {
      update: fn
    }
  };
}

/**
 * Exports
 */

exports.default = locationMiddleware;
exports.getUrl = getUrl;
exports.setUrl = setUrl;
exports.bindUrl = bindUrl;
},{"bind-url":103}],170:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.lookup = exports.destroyEphemeral = exports.createEphemeral = exports.isEphemeral = exports.toEphemeral = undefined;

var _miniHamt = require('mini-hamt');

var hamt = _interopRequireWildcard(_miniHamt);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Action types
 */

var CREATE = 'CREATE_EPHEMERAL';
var DESTROY = 'DESTROY_EPHEMERAL';

/**
 * Ephemeral state reducer
 */

function ephemeralReducer() {
  var state = arguments.length <= 0 || arguments[0] === undefined ? hamt.empty : arguments[0];
  var action = arguments[1];
  var _action$meta$ephemera = action.meta.ephemeral;
  var reducer = _action$meta$ephemera.reducer;
  var key = _action$meta$ephemera.key;


  switch (action.type) {
    case CREATE:
      return hamt.set(state, key, action.payload);
    case DESTROY:
      return hamt.del(state, key);
    default:
      return hamt.set(state, key, reducer(hamt.get(state, key), action));
  }

  return state;
}

/**
 * Action creators
 */

function toEphemeral(key, reducer, action) {
  return _extends({}, action, {
    meta: _extends({}, action.meta || {}, {
      ephemeral: {
        key: key,
        reducer: reducer
      }
    })
  });
}

function createEphemeral(key, initialState) {
  return {
    type: CREATE,
    payload: initialState,
    meta: {
      ephemeral: { key: key },
      logLevel: 'trace'
    }
  };
}

function destroyEphemeral(key) {
  return {
    type: DESTROY,
    meta: {
      ephemeral: { key: key },
      logLevel: 'trace'
    }
  };
}

function lookup(state, key) {
  return hamt.get(state || hamt.empty, key);
}

/**
 * Mount reducer
 */

function mount(prop, reducer) {
  return function (state, action) {
    return isEphemeral(action) ? _extends({}, state, _defineProperty({}, prop, ephemeralReducer(state[prop], action))) : reducer(state, action);
  };
}

function isEphemeral(action) {
  return action.meta && action.meta.hasOwnProperty('ephemeral');
}

/**
 * Exports
 */

exports.default = mount;
exports.toEphemeral = toEphemeral;
exports.isEphemeral = isEphemeral;
exports.createEphemeral = createEphemeral;
exports.destroyEphemeral = destroyEphemeral;
exports.lookup = lookup;
},{"mini-hamt":163}],171:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * redux-falsy
 */

function falsy() {
  return function (next) {
    return function (action) {
      return action && next(action);
    };
  };
}

/**
 * Exports
 */

exports.default = falsy;
},{}],172:[function(require,module,exports){
"use strict";

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

var repeat = function repeat(str, times) {
  return new Array(times + 1).join(str);
};
var pad = function pad(num, maxLength) {
  return repeat("0", maxLength - num.toString().length) + num;
};
var formatTime = function formatTime(time) {
  return "@ " + pad(time.getHours(), 2) + ":" + pad(time.getMinutes(), 2) + ":" + pad(time.getSeconds(), 2) + "." + pad(time.getMilliseconds(), 3);
};

// Use the new performance api to get better precision if available
var timer = typeof performance !== "undefined" && typeof performance.now === "function" ? performance : Date;

/**
 * parse the level option of createLogger
 *
 * @property {string | function | object} level - console[level]
 * @property {object} action
 * @property {array} payload
 * @property {string} type
 */

function getLogLevel(level, action, payload, type) {
  switch (typeof level === "undefined" ? "undefined" : _typeof(level)) {
    case "object":
      return typeof level[type] === "function" ? level[type].apply(level, _toConsumableArray(payload)) : level[type];
    case "function":
      return level(action);
    default:
      return level;
  }
}

/**
 * Creates logger with followed options
 *
 * @namespace
 * @property {object} options - options for logger
 * @property {string | function | object} options.level - console[level]
 * @property {boolean} options.duration - print duration of each action?
 * @property {boolean} options.timestamp - print timestamp with each action?
 * @property {object} options.colors - custom colors
 * @property {object} options.logger - implementation of the `console` API
 * @property {boolean} options.logErrors - should errors in action execution be caught, logged, and re-thrown?
 * @property {boolean} options.collapsed - is group collapsed?
 * @property {boolean} options.predicate - condition which resolves logger behavior
 * @property {function} options.stateTransformer - transform state before print
 * @property {function} options.actionTransformer - transform action before print
 * @property {function} options.errorTransformer - transform error before print
 */

function createLogger() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var _options$level = options.level;
  var level = _options$level === undefined ? "log" : _options$level;
  var _options$logger = options.logger;
  var logger = _options$logger === undefined ? console : _options$logger;
  var _options$logErrors = options.logErrors;
  var logErrors = _options$logErrors === undefined ? true : _options$logErrors;
  var collapsed = options.collapsed;
  var predicate = options.predicate;
  var _options$duration = options.duration;
  var duration = _options$duration === undefined ? false : _options$duration;
  var _options$timestamp = options.timestamp;
  var timestamp = _options$timestamp === undefined ? true : _options$timestamp;
  var transformer = options.transformer;
  var _options$stateTransfo = options.stateTransformer;
  var // deprecated
  stateTransformer = _options$stateTransfo === undefined ? function (state) {
    return state;
  } : _options$stateTransfo;
  var _options$actionTransf = options.actionTransformer;
  var actionTransformer = _options$actionTransf === undefined ? function (actn) {
    return actn;
  } : _options$actionTransf;
  var _options$errorTransfo = options.errorTransformer;
  var errorTransformer = _options$errorTransfo === undefined ? function (error) {
    return error;
  } : _options$errorTransfo;
  var _options$colors = options.colors;
  var colors = _options$colors === undefined ? {
    title: function title() {
      return "#000000";
    },
    prevState: function prevState() {
      return "#9E9E9E";
    },
    action: function action() {
      return "#03A9F4";
    },
    nextState: function nextState() {
      return "#4CAF50";
    },
    error: function error() {
      return "#F20404";
    }
  } : _options$colors;

  // exit if console undefined

  if (typeof logger === "undefined") {
    return function () {
      return function (next) {
        return function (action) {
          return next(action);
        };
      };
    };
  }

  if (transformer) {
    console.error("Option 'transformer' is deprecated, use stateTransformer instead");
  }

  var logBuffer = [];
  function printBuffer() {
    logBuffer.forEach(function (logEntry, key) {
      var started = logEntry.started;
      var startedTime = logEntry.startedTime;
      var action = logEntry.action;
      var prevState = logEntry.prevState;
      var error = logEntry.error;
      var took = logEntry.took;
      var nextState = logEntry.nextState;

      var nextEntry = logBuffer[key + 1];
      if (nextEntry) {
        nextState = nextEntry.prevState;
        took = nextEntry.started - started;
      }
      // message
      var formattedAction = actionTransformer(action);
      var isCollapsed = typeof collapsed === "function" ? collapsed(function () {
        return nextState;
      }, action) : collapsed;

      var formattedTime = formatTime(startedTime);
      var titleCSS = colors.title ? "color: " + colors.title(formattedAction) + ";" : null;
      var title = "action " + (timestamp ? formattedTime : "") + " " + formattedAction.type + " " + (duration ? "(in " + took.toFixed(2) + " ms)" : "");

      // render
      try {
        if (isCollapsed) {
          if (colors.title) logger.groupCollapsed("%c " + title, titleCSS);else logger.groupCollapsed(title);
        } else {
          if (colors.title) logger.group("%c " + title, titleCSS);else logger.group(title);
        }
      } catch (e) {
        logger.log(title);
      }

      var prevStateLevel = getLogLevel(level, formattedAction, [prevState], "prevState");
      var actionLevel = getLogLevel(level, formattedAction, [formattedAction], "action");
      var errorLevel = getLogLevel(level, formattedAction, [error, prevState], "error");
      var nextStateLevel = getLogLevel(level, formattedAction, [nextState], "nextState");

      if (prevStateLevel) {
        if (colors.prevState) logger[prevStateLevel]("%c prev state", "color: " + colors.prevState(prevState) + "; font-weight: bold", prevState);else logger[prevStateLevel]("prev state", prevState);
      }

      if (actionLevel) {
        if (colors.action) logger[actionLevel]("%c action", "color: " + colors.action(formattedAction) + "; font-weight: bold", formattedAction);else logger[actionLevel]("action", formattedAction);
      }

      if (error && errorLevel) {
        if (colors.error) logger[errorLevel]("%c error", "color: " + colors.error(error, prevState) + "; font-weight: bold", error);else logger[errorLevel]("error", error);
      }

      if (nextStateLevel) {
        if (colors.nextState) logger[nextStateLevel]("%c next state", "color: " + colors.nextState(nextState) + "; font-weight: bold", nextState);else logger[nextStateLevel]("next state", nextState);
      }

      try {
        logger.groupEnd();
      } catch (e) {
        logger.log("—— log end ——");
      }
    });
    logBuffer.length = 0;
  }

  return function (_ref) {
    var getState = _ref.getState;
    return function (next) {
      return function (action) {
        // exit early if predicate function returns false
        if (typeof predicate === "function" && !predicate(getState, action)) {
          return next(action);
        }

        var logEntry = {};
        logBuffer.push(logEntry);

        logEntry.started = timer.now();
        logEntry.startedTime = new Date();
        logEntry.prevState = stateTransformer(getState());
        logEntry.action = action;

        var returnedValue = undefined;
        if (logErrors) {
          try {
            returnedValue = next(action);
          } catch (e) {
            logEntry.error = errorTransformer(e);
          }
        } else {
          returnedValue = next(action);
        }

        logEntry.took = timer.now() - logEntry.started;
        logEntry.nextState = stateTransformer(getState());

        printBuffer();

        if (logEntry.error) throw logEntry.error;
        return returnedValue;
      };
    };
  };
}

module.exports = createLogger;
},{}],173:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Redux dispatch multiple actions
 */

function multi(_ref) {
  var dispatch = _ref.dispatch;

  return function (next) {
    return function (action) {
      return Array.isArray(action) ? action.filter(Boolean).map(dispatch) : next(action);
    };
  };
}

/**
 * Exports
 */

exports.default = multi;
},{}],174:[function(require,module,exports){
'use strict';

function thunkMiddleware(_ref) {
  var dispatch = _ref.dispatch;
  var getState = _ref.getState;

  return function (next) {
    return function (action) {
      return typeof action === 'function' ? action(dispatch, getState) : next(action);
    };
  };
}

module.exports = thunkMiddleware;
},{}],175:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports["default"] = applyMiddleware;

var _compose = require('./compose');

var _compose2 = _interopRequireDefault(_compose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
function applyMiddleware() {
  for (var _len = arguments.length, middlewares = Array(_len), _key = 0; _key < _len; _key++) {
    middlewares[_key] = arguments[_key];
  }

  return function (createStore) {
    return function (reducer, initialState, enhancer) {
      var store = createStore(reducer, initialState, enhancer);
      var _dispatch = store.dispatch;
      var chain = [];

      var middlewareAPI = {
        getState: store.getState,
        dispatch: function dispatch(action) {
          return _dispatch(action);
        }
      };
      chain = middlewares.map(function (middleware) {
        return middleware(middlewareAPI);
      });
      _dispatch = _compose2["default"].apply(undefined, chain)(store.dispatch);

      return _extends({}, store, {
        dispatch: _dispatch
      });
    };
  };
}
},{"./compose":176}],176:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports["default"] = compose;
/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

function compose() {
  for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function (arg) {
      return arg;
    };
  } else {
    var _ret = function () {
      var last = funcs[funcs.length - 1];
      var rest = funcs.slice(0, -1);
      return {
        v: function v() {
          return rest.reduceRight(function (composed, f) {
            return f(composed);
          }, last.apply(undefined, arguments));
        }
      };
    }();

    if (typeof _ret === "object") return _ret.v;
  }
}
},{}],177:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.ActionTypes = undefined;
exports["default"] = createStore;

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var ActionTypes = exports.ActionTypes = {
  INIT: '@@redux/INIT'
};

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [initialState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} enhancer The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
function createStore(reducer, initialState, enhancer) {
  var _ref2;

  if (typeof initialState === 'function' && typeof enhancer === 'undefined') {
    enhancer = initialState;
    initialState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.');
    }

    return enhancer(createStore)(reducer, initialState);
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.');
  }

  var currentReducer = reducer;
  var currentState = initialState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return currentState;
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.');
    }

    var isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {
    if (!(0, _isPlainObject2["default"])(action)) {
      throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
    }

    if (typeof action.type === 'undefined') {
      throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant?');
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = currentListeners = nextListeners;
    for (var i = 0; i < listeners.length; i++) {
      listeners[i]();
    }

    return action;
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.');
    }

    currentReducer = nextReducer;
    dispatch({ type: ActionTypes.INIT });
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/zenparsing/es-observable
   */
  function observable() {
    var _ref;

    var outerSubscribe = subscribe;
    return _ref = {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */

      subscribe: function subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.');
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState());
          }
        }

        observeState();
        var unsubscribe = outerSubscribe(observeState);
        return { unsubscribe: unsubscribe };
      }
    }, _ref[_symbolObservable2["default"]] = function () {
      return this;
    }, _ref;
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT });

  return _ref2 = {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  }, _ref2[_symbolObservable2["default"]] = observable, _ref2;
}
},{"lodash/isPlainObject":181,"symbol-observable":194}],178:[function(require,module,exports){
/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetPrototype = Object.getPrototypeOf;

/**
 * Gets the `[[Prototype]]` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {null|Object} Returns the `[[Prototype]]`.
 */
function getPrototype(value) {
  return nativeGetPrototype(Object(value));
}

module.exports = getPrototype;

},{}],179:[function(require,module,exports){
/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

module.exports = isHostObject;

},{}],180:[function(require,module,exports){
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],181:[function(require,module,exports){
var getPrototype = require('./_getPrototype'),
    isHostObject = require('./_isHostObject'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object,
 *  else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) ||
      objectToString.call(value) != objectTag || isHostObject(value)) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return (typeof Ctor == 'function' &&
    Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString);
}

module.exports = isPlainObject;

},{"./_getPrototype":178,"./_isHostObject":179,"./isObjectLike":180}],182:[function(require,module,exports){

/**
 * Module dependencies.
 */

var url = require('./url');
var parser = require('socket.io-parser');
var Manager = require('./manager');
var debug = require('debug')('socket.io-client');

/**
 * Module exports.
 */

module.exports = exports = lookup;

/**
 * Managers cache.
 */

var cache = exports.managers = {};

/**
 * Looks up an existing `Manager` for multiplexing.
 * If the user summons:
 *
 *   `io('http://localhost/a');`
 *   `io('http://localhost/b');`
 *
 * We reuse the existing instance based on same scheme/port/host,
 * and we initialize sockets for each namespace.
 *
 * @api public
 */

function lookup(uri, opts) {
  if (typeof uri == 'object') {
    opts = uri;
    uri = undefined;
  }

  opts = opts || {};

  var parsed = url(uri);
  var source = parsed.source;
  var id = parsed.id;
  var path = parsed.path;
  var sameNamespace = cache[id] && path in cache[id].nsps;
  var newConnection = opts.forceNew || opts['force new connection'] ||
                      false === opts.multiplex || sameNamespace;

  var io;

  if (newConnection) {
    debug('ignoring socket cache for %s', source);
    io = Manager(source, opts);
  } else {
    if (!cache[id]) {
      debug('new io instance for %s', source);
      cache[id] = Manager(source, opts);
    }
    io = cache[id];
  }

  return io.socket(parsed.path);
}

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = parser.protocol;

/**
 * `connect`.
 *
 * @param {String} uri
 * @api public
 */

exports.connect = lookup;

/**
 * Expose constructors for standalone build.
 *
 * @api public
 */

exports.Manager = require('./manager');
exports.Socket = require('./socket');

},{"./manager":183,"./socket":185,"./url":186,"debug":116,"socket.io-parser":189}],183:[function(require,module,exports){

/**
 * Module dependencies.
 */

var eio = require('engine.io-client');
var Socket = require('./socket');
var Emitter = require('component-emitter');
var parser = require('socket.io-parser');
var on = require('./on');
var bind = require('component-bind');
var debug = require('debug')('socket.io-client:manager');
var indexOf = require('indexof');
var Backoff = require('backo2');

/**
 * IE6+ hasOwnProperty
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Module exports
 */

module.exports = Manager;

/**
 * `Manager` constructor.
 *
 * @param {String} engine instance or engine uri/opts
 * @param {Object} options
 * @api public
 */

function Manager(uri, opts){
  if (!(this instanceof Manager)) return new Manager(uri, opts);
  if (uri && ('object' == typeof uri)) {
    opts = uri;
    uri = undefined;
  }
  opts = opts || {};

  opts.path = opts.path || '/socket.io';
  this.nsps = {};
  this.subs = [];
  this.opts = opts;
  this.reconnection(opts.reconnection !== false);
  this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
  this.reconnectionDelay(opts.reconnectionDelay || 1000);
  this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
  this.randomizationFactor(opts.randomizationFactor || 0.5);
  this.backoff = new Backoff({
    min: this.reconnectionDelay(),
    max: this.reconnectionDelayMax(),
    jitter: this.randomizationFactor()
  });
  this.timeout(null == opts.timeout ? 20000 : opts.timeout);
  this.readyState = 'closed';
  this.uri = uri;
  this.connecting = [];
  this.lastPing = null;
  this.encoding = false;
  this.packetBuffer = [];
  this.encoder = new parser.Encoder();
  this.decoder = new parser.Decoder();
  this.autoConnect = opts.autoConnect !== false;
  if (this.autoConnect) this.open();
}

/**
 * Propagate given event to sockets and emit on `this`
 *
 * @api private
 */

Manager.prototype.emitAll = function() {
  this.emit.apply(this, arguments);
  for (var nsp in this.nsps) {
    if (has.call(this.nsps, nsp)) {
      this.nsps[nsp].emit.apply(this.nsps[nsp], arguments);
    }
  }
};

/**
 * Update `socket.id` of all sockets
 *
 * @api private
 */

Manager.prototype.updateSocketIds = function(){
  for (var nsp in this.nsps) {
    if (has.call(this.nsps, nsp)) {
      this.nsps[nsp].id = this.engine.id;
    }
  }
};

/**
 * Mix in `Emitter`.
 */

Emitter(Manager.prototype);

/**
 * Sets the `reconnection` config.
 *
 * @param {Boolean} true/false if it should automatically reconnect
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnection = function(v){
  if (!arguments.length) return this._reconnection;
  this._reconnection = !!v;
  return this;
};

/**
 * Sets the reconnection attempts config.
 *
 * @param {Number} max reconnection attempts before giving up
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionAttempts = function(v){
  if (!arguments.length) return this._reconnectionAttempts;
  this._reconnectionAttempts = v;
  return this;
};

/**
 * Sets the delay between reconnections.
 *
 * @param {Number} delay
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionDelay = function(v){
  if (!arguments.length) return this._reconnectionDelay;
  this._reconnectionDelay = v;
  this.backoff && this.backoff.setMin(v);
  return this;
};

Manager.prototype.randomizationFactor = function(v){
  if (!arguments.length) return this._randomizationFactor;
  this._randomizationFactor = v;
  this.backoff && this.backoff.setJitter(v);
  return this;
};

/**
 * Sets the maximum delay between reconnections.
 *
 * @param {Number} delay
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.reconnectionDelayMax = function(v){
  if (!arguments.length) return this._reconnectionDelayMax;
  this._reconnectionDelayMax = v;
  this.backoff && this.backoff.setMax(v);
  return this;
};

/**
 * Sets the connection timeout. `false` to disable
 *
 * @return {Manager} self or value
 * @api public
 */

Manager.prototype.timeout = function(v){
  if (!arguments.length) return this._timeout;
  this._timeout = v;
  return this;
};

/**
 * Starts trying to reconnect if reconnection is enabled and we have not
 * started reconnecting yet
 *
 * @api private
 */

Manager.prototype.maybeReconnectOnOpen = function() {
  // Only try to reconnect if it's the first time we're connecting
  if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
    // keeps reconnection from firing twice for the same reconnection loop
    this.reconnect();
  }
};


/**
 * Sets the current transport `socket`.
 *
 * @param {Function} optional, callback
 * @return {Manager} self
 * @api public
 */

Manager.prototype.open =
Manager.prototype.connect = function(fn){
  debug('readyState %s', this.readyState);
  if (~this.readyState.indexOf('open')) return this;

  debug('opening %s', this.uri);
  this.engine = eio(this.uri, this.opts);
  var socket = this.engine;
  var self = this;
  this.readyState = 'opening';
  this.skipReconnect = false;

  // emit `open`
  var openSub = on(socket, 'open', function() {
    self.onopen();
    fn && fn();
  });

  // emit `connect_error`
  var errorSub = on(socket, 'error', function(data){
    debug('connect_error');
    self.cleanup();
    self.readyState = 'closed';
    self.emitAll('connect_error', data);
    if (fn) {
      var err = new Error('Connection error');
      err.data = data;
      fn(err);
    } else {
      // Only do this if there is no fn to handle the error
      self.maybeReconnectOnOpen();
    }
  });

  // emit `connect_timeout`
  if (false !== this._timeout) {
    var timeout = this._timeout;
    debug('connect attempt will timeout after %d', timeout);

    // set timer
    var timer = setTimeout(function(){
      debug('connect attempt timed out after %d', timeout);
      openSub.destroy();
      socket.close();
      socket.emit('error', 'timeout');
      self.emitAll('connect_timeout', timeout);
    }, timeout);

    this.subs.push({
      destroy: function(){
        clearTimeout(timer);
      }
    });
  }

  this.subs.push(openSub);
  this.subs.push(errorSub);

  return this;
};

/**
 * Called upon transport open.
 *
 * @api private
 */

Manager.prototype.onopen = function(){
  debug('open');

  // clear old subs
  this.cleanup();

  // mark as open
  this.readyState = 'open';
  this.emit('open');

  // add new subs
  var socket = this.engine;
  this.subs.push(on(socket, 'data', bind(this, 'ondata')));
  this.subs.push(on(socket, 'ping', bind(this, 'onping')));
  this.subs.push(on(socket, 'pong', bind(this, 'onpong')));
  this.subs.push(on(socket, 'error', bind(this, 'onerror')));
  this.subs.push(on(socket, 'close', bind(this, 'onclose')));
  this.subs.push(on(this.decoder, 'decoded', bind(this, 'ondecoded')));
};

/**
 * Called upon a ping.
 *
 * @api private
 */

Manager.prototype.onping = function(){
  this.lastPing = new Date;
  this.emitAll('ping');
};

/**
 * Called upon a packet.
 *
 * @api private
 */

Manager.prototype.onpong = function(){
  this.emitAll('pong', new Date - this.lastPing);
};

/**
 * Called with data.
 *
 * @api private
 */

Manager.prototype.ondata = function(data){
  this.decoder.add(data);
};

/**
 * Called when parser fully decodes a packet.
 *
 * @api private
 */

Manager.prototype.ondecoded = function(packet) {
  this.emit('packet', packet);
};

/**
 * Called upon socket error.
 *
 * @api private
 */

Manager.prototype.onerror = function(err){
  debug('error', err);
  this.emitAll('error', err);
};

/**
 * Creates a new socket for the given `nsp`.
 *
 * @return {Socket}
 * @api public
 */

Manager.prototype.socket = function(nsp){
  var socket = this.nsps[nsp];
  if (!socket) {
    socket = new Socket(this, nsp);
    this.nsps[nsp] = socket;
    var self = this;
    socket.on('connecting', onConnecting);
    socket.on('connect', function(){
      socket.id = self.engine.id;
    });

    if (this.autoConnect) {
      // manually call here since connecting evnet is fired before listening
      onConnecting();
    }
  }

  function onConnecting() {
    if (!~indexOf(self.connecting, socket)) {
      self.connecting.push(socket);
    }
  }

  return socket;
};

/**
 * Called upon a socket close.
 *
 * @param {Socket} socket
 */

Manager.prototype.destroy = function(socket){
  var index = indexOf(this.connecting, socket);
  if (~index) this.connecting.splice(index, 1);
  if (this.connecting.length) return;

  this.close();
};

/**
 * Writes a packet.
 *
 * @param {Object} packet
 * @api private
 */

Manager.prototype.packet = function(packet){
  debug('writing packet %j', packet);
  var self = this;

  if (!self.encoding) {
    // encode, then write to engine with result
    self.encoding = true;
    this.encoder.encode(packet, function(encodedPackets) {
      for (var i = 0; i < encodedPackets.length; i++) {
        self.engine.write(encodedPackets[i], packet.options);
      }
      self.encoding = false;
      self.processPacketQueue();
    });
  } else { // add packet to the queue
    self.packetBuffer.push(packet);
  }
};

/**
 * If packet buffer is non-empty, begins encoding the
 * next packet in line.
 *
 * @api private
 */

Manager.prototype.processPacketQueue = function() {
  if (this.packetBuffer.length > 0 && !this.encoding) {
    var pack = this.packetBuffer.shift();
    this.packet(pack);
  }
};

/**
 * Clean up transport subscriptions and packet buffer.
 *
 * @api private
 */

Manager.prototype.cleanup = function(){
  debug('cleanup');

  var sub;
  while (sub = this.subs.shift()) sub.destroy();

  this.packetBuffer = [];
  this.encoding = false;
  this.lastPing = null;

  this.decoder.destroy();
};

/**
 * Close the current socket.
 *
 * @api private
 */

Manager.prototype.close =
Manager.prototype.disconnect = function(){
  debug('disconnect');
  this.skipReconnect = true;
  this.reconnecting = false;
  if ('opening' == this.readyState) {
    // `onclose` will not fire because
    // an open event never happened
    this.cleanup();
  }
  this.backoff.reset();
  this.readyState = 'closed';
  if (this.engine) this.engine.close();
};

/**
 * Called upon engine close.
 *
 * @api private
 */

Manager.prototype.onclose = function(reason){
  debug('onclose');

  this.cleanup();
  this.backoff.reset();
  this.readyState = 'closed';
  this.emit('close', reason);

  if (this._reconnection && !this.skipReconnect) {
    this.reconnect();
  }
};

/**
 * Attempt a reconnection.
 *
 * @api private
 */

Manager.prototype.reconnect = function(){
  if (this.reconnecting || this.skipReconnect) return this;

  var self = this;

  if (this.backoff.attempts >= this._reconnectionAttempts) {
    debug('reconnect failed');
    this.backoff.reset();
    this.emitAll('reconnect_failed');
    this.reconnecting = false;
  } else {
    var delay = this.backoff.duration();
    debug('will wait %dms before reconnect attempt', delay);

    this.reconnecting = true;
    var timer = setTimeout(function(){
      if (self.skipReconnect) return;

      debug('attempting reconnect');
      self.emitAll('reconnect_attempt', self.backoff.attempts);
      self.emitAll('reconnecting', self.backoff.attempts);

      // check again for the case socket closed in above events
      if (self.skipReconnect) return;

      self.open(function(err){
        if (err) {
          debug('reconnect attempt error');
          self.reconnecting = false;
          self.reconnect();
          self.emitAll('reconnect_error', err.data);
        } else {
          debug('reconnect success');
          self.onreconnect();
        }
      });
    }, delay);

    this.subs.push({
      destroy: function(){
        clearTimeout(timer);
      }
    });
  }
};

/**
 * Called upon successful reconnect.
 *
 * @api private
 */

Manager.prototype.onreconnect = function(){
  var attempt = this.backoff.attempts;
  this.reconnecting = false;
  this.backoff.reset();
  this.updateSocketIds();
  this.emitAll('reconnect', attempt);
};

},{"./on":184,"./socket":185,"backo2":101,"component-bind":113,"component-emitter":187,"debug":116,"engine.io-client":121,"indexof":143,"socket.io-parser":189}],184:[function(require,module,exports){

/**
 * Module exports.
 */

module.exports = on;

/**
 * Helper for subscriptions.
 *
 * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
 * @param {String} event name
 * @param {Function} callback
 * @api public
 */

function on(obj, ev, fn) {
  obj.on(ev, fn);
  return {
    destroy: function(){
      obj.removeListener(ev, fn);
    }
  };
}

},{}],185:[function(require,module,exports){

/**
 * Module dependencies.
 */

var parser = require('socket.io-parser');
var Emitter = require('component-emitter');
var toArray = require('to-array');
var on = require('./on');
var bind = require('component-bind');
var debug = require('debug')('socket.io-client:socket');
var hasBin = require('has-binary');

/**
 * Module exports.
 */

module.exports = exports = Socket;

/**
 * Internal events (blacklisted).
 * These events can't be emitted by the user.
 *
 * @api private
 */

var events = {
  connect: 1,
  connect_error: 1,
  connect_timeout: 1,
  connecting: 1,
  disconnect: 1,
  error: 1,
  reconnect: 1,
  reconnect_attempt: 1,
  reconnect_failed: 1,
  reconnect_error: 1,
  reconnecting: 1,
  ping: 1,
  pong: 1
};

/**
 * Shortcut to `Emitter#emit`.
 */

var emit = Emitter.prototype.emit;

/**
 * `Socket` constructor.
 *
 * @api public
 */

function Socket(io, nsp){
  this.io = io;
  this.nsp = nsp;
  this.json = this; // compat
  this.ids = 0;
  this.acks = {};
  this.receiveBuffer = [];
  this.sendBuffer = [];
  this.connected = false;
  this.disconnected = true;
  if (this.io.autoConnect) this.open();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Subscribe to open, close and packet events
 *
 * @api private
 */

Socket.prototype.subEvents = function() {
  if (this.subs) return;

  var io = this.io;
  this.subs = [
    on(io, 'open', bind(this, 'onopen')),
    on(io, 'packet', bind(this, 'onpacket')),
    on(io, 'close', bind(this, 'onclose'))
  ];
};

/**
 * "Opens" the socket.
 *
 * @api public
 */

Socket.prototype.open =
Socket.prototype.connect = function(){
  if (this.connected) return this;

  this.subEvents();
  this.io.open(); // ensure open
  if ('open' == this.io.readyState) this.onopen();
  this.emit('connecting');
  return this;
};

/**
 * Sends a `message` event.
 *
 * @return {Socket} self
 * @api public
 */

Socket.prototype.send = function(){
  var args = toArray(arguments);
  args.unshift('message');
  this.emit.apply(this, args);
  return this;
};

/**
 * Override `emit`.
 * If the event is in `events`, it's emitted normally.
 *
 * @param {String} event name
 * @return {Socket} self
 * @api public
 */

Socket.prototype.emit = function(ev){
  if (events.hasOwnProperty(ev)) {
    emit.apply(this, arguments);
    return this;
  }

  var args = toArray(arguments);
  var parserType = parser.EVENT; // default
  if (hasBin(args)) { parserType = parser.BINARY_EVENT; } // binary
  var packet = { type: parserType, data: args };

  packet.options = {};
  packet.options.compress = !this.flags || false !== this.flags.compress;

  // event ack callback
  if ('function' == typeof args[args.length - 1]) {
    debug('emitting packet with ack id %d', this.ids);
    this.acks[this.ids] = args.pop();
    packet.id = this.ids++;
  }

  if (this.connected) {
    this.packet(packet);
  } else {
    this.sendBuffer.push(packet);
  }

  delete this.flags;

  return this;
};

/**
 * Sends a packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.packet = function(packet){
  packet.nsp = this.nsp;
  this.io.packet(packet);
};

/**
 * Called upon engine `open`.
 *
 * @api private
 */

Socket.prototype.onopen = function(){
  debug('transport is open - connecting');

  // write connect packet if necessary
  if ('/' != this.nsp) {
    this.packet({ type: parser.CONNECT });
  }
};

/**
 * Called upon engine `close`.
 *
 * @param {String} reason
 * @api private
 */

Socket.prototype.onclose = function(reason){
  debug('close (%s)', reason);
  this.connected = false;
  this.disconnected = true;
  delete this.id;
  this.emit('disconnect', reason);
};

/**
 * Called with socket packet.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onpacket = function(packet){
  if (packet.nsp != this.nsp) return;

  switch (packet.type) {
    case parser.CONNECT:
      this.onconnect();
      break;

    case parser.EVENT:
      this.onevent(packet);
      break;

    case parser.BINARY_EVENT:
      this.onevent(packet);
      break;

    case parser.ACK:
      this.onack(packet);
      break;

    case parser.BINARY_ACK:
      this.onack(packet);
      break;

    case parser.DISCONNECT:
      this.ondisconnect();
      break;

    case parser.ERROR:
      this.emit('error', packet.data);
      break;
  }
};

/**
 * Called upon a server event.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onevent = function(packet){
  var args = packet.data || [];
  debug('emitting event %j', args);

  if (null != packet.id) {
    debug('attaching ack callback to event');
    args.push(this.ack(packet.id));
  }

  if (this.connected) {
    emit.apply(this, args);
  } else {
    this.receiveBuffer.push(args);
  }
};

/**
 * Produces an ack callback to emit with an event.
 *
 * @api private
 */

Socket.prototype.ack = function(id){
  var self = this;
  var sent = false;
  return function(){
    // prevent double callbacks
    if (sent) return;
    sent = true;
    var args = toArray(arguments);
    debug('sending ack %j', args);

    var type = hasBin(args) ? parser.BINARY_ACK : parser.ACK;
    self.packet({
      type: type,
      id: id,
      data: args
    });
  };
};

/**
 * Called upon a server acknowlegement.
 *
 * @param {Object} packet
 * @api private
 */

Socket.prototype.onack = function(packet){
  var ack = this.acks[packet.id];
  if ('function' == typeof ack) {
    debug('calling ack %s with %j', packet.id, packet.data);
    ack.apply(this, packet.data);
    delete this.acks[packet.id];
  } else {
    debug('bad ack %s', packet.id);
  }
};

/**
 * Called upon server connect.
 *
 * @api private
 */

Socket.prototype.onconnect = function(){
  this.connected = true;
  this.disconnected = false;
  this.emit('connect');
  this.emitBuffered();
};

/**
 * Emit buffered events (received and emitted).
 *
 * @api private
 */

Socket.prototype.emitBuffered = function(){
  var i;
  for (i = 0; i < this.receiveBuffer.length; i++) {
    emit.apply(this, this.receiveBuffer[i]);
  }
  this.receiveBuffer = [];

  for (i = 0; i < this.sendBuffer.length; i++) {
    this.packet(this.sendBuffer[i]);
  }
  this.sendBuffer = [];
};

/**
 * Called upon server disconnect.
 *
 * @api private
 */

Socket.prototype.ondisconnect = function(){
  debug('server disconnect (%s)', this.nsp);
  this.destroy();
  this.onclose('io server disconnect');
};

/**
 * Called upon forced client/server side disconnections,
 * this method ensures the manager stops tracking us and
 * that reconnections don't get triggered for this.
 *
 * @api private.
 */

Socket.prototype.destroy = function(){
  if (this.subs) {
    // clean subscriptions to avoid reconnections
    for (var i = 0; i < this.subs.length; i++) {
      this.subs[i].destroy();
    }
    this.subs = null;
  }

  this.io.destroy(this);
};

/**
 * Disconnects the socket manually.
 *
 * @return {Socket} self
 * @api public
 */

Socket.prototype.close =
Socket.prototype.disconnect = function(){
  if (this.connected) {
    debug('performing disconnect (%s)', this.nsp);
    this.packet({ type: parser.DISCONNECT });
  }

  // remove socket from pool
  this.destroy();

  if (this.connected) {
    // fire events
    this.onclose('io client disconnect');
  }
  return this;
};

/**
 * Sets the compress flag.
 *
 * @param {Boolean} if `true`, compresses the sending data
 * @return {Socket} self
 * @api public
 */

Socket.prototype.compress = function(compress){
  this.flags = this.flags || {};
  this.flags.compress = compress;
  return this;
};

},{"./on":184,"component-bind":113,"component-emitter":187,"debug":116,"has-binary":139,"socket.io-parser":189,"to-array":196}],186:[function(require,module,exports){
(function (global){

/**
 * Module dependencies.
 */

var parseuri = require('parseuri');
var debug = require('debug')('socket.io-client:url');

/**
 * Module exports.
 */

module.exports = url;

/**
 * URL parser.
 *
 * @param {String} url
 * @param {Object} An object meant to mimic window.location.
 *                 Defaults to window.location.
 * @api public
 */

function url(uri, loc){
  var obj = uri;

  // default to window.location
  var loc = loc || global.location;
  if (null == uri) uri = loc.protocol + '//' + loc.host;

  // relative path support
  if ('string' == typeof uri) {
    if ('/' == uri.charAt(0)) {
      if ('/' == uri.charAt(1)) {
        uri = loc.protocol + uri;
      } else {
        uri = loc.host + uri;
      }
    }

    if (!/^(https?|wss?):\/\//.test(uri)) {
      debug('protocol-less url %s', uri);
      if ('undefined' != typeof loc) {
        uri = loc.protocol + '//' + uri;
      } else {
        uri = 'https://' + uri;
      }
    }

    // parse
    debug('parse %s', uri);
    obj = parseuri(uri);
  }

  // make sure we treat `localhost:80` and `localhost` equally
  if (!obj.port) {
    if (/^(http|ws)$/.test(obj.protocol)) {
      obj.port = '80';
    }
    else if (/^(http|ws)s$/.test(obj.protocol)) {
      obj.port = '443';
    }
  }

  obj.path = obj.path || '/';

  var ipv6 = obj.host.indexOf(':') !== -1;
  var host = ipv6 ? '[' + obj.host + ']' : obj.host;

  // define unique id
  obj.id = obj.protocol + '://' + host + ':' + obj.port;
  // define href
  obj.href = obj.protocol + '://' + host + (loc && loc.port == obj.port ? '' : (':' + obj.port));

  return obj;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"debug":116,"parseuri":168}],187:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],188:[function(require,module,exports){
(function (global){
/*global Blob,File*/

/**
 * Module requirements
 */

var isArray = require('isarray');
var isBuf = require('./is-buffer');

/**
 * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
 * Anything with blobs or files should be fed through removeBlobs before coming
 * here.
 *
 * @param {Object} packet - socket.io event packet
 * @return {Object} with deconstructed packet and list of buffers
 * @api public
 */

exports.deconstructPacket = function(packet){
  var buffers = [];
  var packetData = packet.data;

  function _deconstructPacket(data) {
    if (!data) return data;

    if (isBuf(data)) {
      var placeholder = { _placeholder: true, num: buffers.length };
      buffers.push(data);
      return placeholder;
    } else if (isArray(data)) {
      var newData = new Array(data.length);
      for (var i = 0; i < data.length; i++) {
        newData[i] = _deconstructPacket(data[i]);
      }
      return newData;
    } else if ('object' == typeof data && !(data instanceof Date)) {
      var newData = {};
      for (var key in data) {
        newData[key] = _deconstructPacket(data[key]);
      }
      return newData;
    }
    return data;
  }

  var pack = packet;
  pack.data = _deconstructPacket(packetData);
  pack.attachments = buffers.length; // number of binary 'attachments'
  return {packet: pack, buffers: buffers};
};

/**
 * Reconstructs a binary packet from its placeholder packet and buffers
 *
 * @param {Object} packet - event packet with placeholders
 * @param {Array} buffers - binary buffers to put in placeholder positions
 * @return {Object} reconstructed packet
 * @api public
 */

exports.reconstructPacket = function(packet, buffers) {
  var curPlaceHolder = 0;

  function _reconstructPacket(data) {
    if (data && data._placeholder) {
      var buf = buffers[data.num]; // appropriate buffer (should be natural order anyway)
      return buf;
    } else if (isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        data[i] = _reconstructPacket(data[i]);
      }
      return data;
    } else if (data && 'object' == typeof data) {
      for (var key in data) {
        data[key] = _reconstructPacket(data[key]);
      }
      return data;
    }
    return data;
  }

  packet.data = _reconstructPacket(packet.data);
  packet.attachments = undefined; // no longer useful
  return packet;
};

/**
 * Asynchronously removes Blobs or Files from data via
 * FileReader's readAsArrayBuffer method. Used before encoding
 * data as msgpack. Calls callback with the blobless data.
 *
 * @param {Object} data
 * @param {Function} callback
 * @api private
 */

exports.removeBlobs = function(data, callback) {
  function _removeBlobs(obj, curKey, containingObject) {
    if (!obj) return obj;

    // convert any blob
    if ((global.Blob && obj instanceof Blob) ||
        (global.File && obj instanceof File)) {
      pendingBlobs++;

      // async filereader
      var fileReader = new FileReader();
      fileReader.onload = function() { // this.result == arraybuffer
        if (containingObject) {
          containingObject[curKey] = this.result;
        }
        else {
          bloblessData = this.result;
        }

        // if nothing pending its callback time
        if(! --pendingBlobs) {
          callback(bloblessData);
        }
      };

      fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
    } else if (isArray(obj)) { // handle array
      for (var i = 0; i < obj.length; i++) {
        _removeBlobs(obj[i], i, obj);
      }
    } else if (obj && 'object' == typeof obj && !isBuf(obj)) { // and object
      for (var key in obj) {
        _removeBlobs(obj[key], key, obj);
      }
    }
  }

  var pendingBlobs = 0;
  var bloblessData = data;
  _removeBlobs(bloblessData);
  if (!pendingBlobs) {
    callback(bloblessData);
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./is-buffer":190,"isarray":191}],189:[function(require,module,exports){

/**
 * Module dependencies.
 */

var debug = require('debug')('socket.io-parser');
var json = require('json3');
var isArray = require('isarray');
var Emitter = require('component-emitter');
var binary = require('./binary');
var isBuf = require('./is-buffer');

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = 4;

/**
 * Packet types.
 *
 * @api public
 */

exports.types = [
  'CONNECT',
  'DISCONNECT',
  'EVENT',
  'ACK',
  'ERROR',
  'BINARY_EVENT',
  'BINARY_ACK'
];

/**
 * Packet type `connect`.
 *
 * @api public
 */

exports.CONNECT = 0;

/**
 * Packet type `disconnect`.
 *
 * @api public
 */

exports.DISCONNECT = 1;

/**
 * Packet type `event`.
 *
 * @api public
 */

exports.EVENT = 2;

/**
 * Packet type `ack`.
 *
 * @api public
 */

exports.ACK = 3;

/**
 * Packet type `error`.
 *
 * @api public
 */

exports.ERROR = 4;

/**
 * Packet type 'binary event'
 *
 * @api public
 */

exports.BINARY_EVENT = 5;

/**
 * Packet type `binary ack`. For acks with binary arguments.
 *
 * @api public
 */

exports.BINARY_ACK = 6;

/**
 * Encoder constructor.
 *
 * @api public
 */

exports.Encoder = Encoder;

/**
 * Decoder constructor.
 *
 * @api public
 */

exports.Decoder = Decoder;

/**
 * A socket.io Encoder instance
 *
 * @api public
 */

function Encoder() {}

/**
 * Encode a packet as a single string if non-binary, or as a
 * buffer sequence, depending on packet type.
 *
 * @param {Object} obj - packet object
 * @param {Function} callback - function to handle encodings (likely engine.write)
 * @return Calls callback with Array of encodings
 * @api public
 */

Encoder.prototype.encode = function(obj, callback){
  debug('encoding packet %j', obj);

  if (exports.BINARY_EVENT == obj.type || exports.BINARY_ACK == obj.type) {
    encodeAsBinary(obj, callback);
  }
  else {
    var encoding = encodeAsString(obj);
    callback([encoding]);
  }
};

/**
 * Encode packet as string.
 *
 * @param {Object} packet
 * @return {String} encoded
 * @api private
 */

function encodeAsString(obj) {
  var str = '';
  var nsp = false;

  // first is type
  str += obj.type;

  // attachments if we have them
  if (exports.BINARY_EVENT == obj.type || exports.BINARY_ACK == obj.type) {
    str += obj.attachments;
    str += '-';
  }

  // if we have a namespace other than `/`
  // we append it followed by a comma `,`
  if (obj.nsp && '/' != obj.nsp) {
    nsp = true;
    str += obj.nsp;
  }

  // immediately followed by the id
  if (null != obj.id) {
    if (nsp) {
      str += ',';
      nsp = false;
    }
    str += obj.id;
  }

  // json data
  if (null != obj.data) {
    if (nsp) str += ',';
    str += json.stringify(obj.data);
  }

  debug('encoded %j as %s', obj, str);
  return str;
}

/**
 * Encode packet as 'buffer sequence' by removing blobs, and
 * deconstructing packet into object with placeholders and
 * a list of buffers.
 *
 * @param {Object} packet
 * @return {Buffer} encoded
 * @api private
 */

function encodeAsBinary(obj, callback) {

  function writeEncoding(bloblessData) {
    var deconstruction = binary.deconstructPacket(bloblessData);
    var pack = encodeAsString(deconstruction.packet);
    var buffers = deconstruction.buffers;

    buffers.unshift(pack); // add packet info to beginning of data list
    callback(buffers); // write all the buffers
  }

  binary.removeBlobs(obj, writeEncoding);
}

/**
 * A socket.io Decoder instance
 *
 * @return {Object} decoder
 * @api public
 */

function Decoder() {
  this.reconstructor = null;
}

/**
 * Mix in `Emitter` with Decoder.
 */

Emitter(Decoder.prototype);

/**
 * Decodes an ecoded packet string into packet JSON.
 *
 * @param {String} obj - encoded packet
 * @return {Object} packet
 * @api public
 */

Decoder.prototype.add = function(obj) {
  var packet;
  if ('string' == typeof obj) {
    packet = decodeString(obj);
    if (exports.BINARY_EVENT == packet.type || exports.BINARY_ACK == packet.type) { // binary packet's json
      this.reconstructor = new BinaryReconstructor(packet);

      // no attachments, labeled binary but no binary data to follow
      if (this.reconstructor.reconPack.attachments === 0) {
        this.emit('decoded', packet);
      }
    } else { // non-binary full packet
      this.emit('decoded', packet);
    }
  }
  else if (isBuf(obj) || obj.base64) { // raw binary data
    if (!this.reconstructor) {
      throw new Error('got binary data when not reconstructing a packet');
    } else {
      packet = this.reconstructor.takeBinaryData(obj);
      if (packet) { // received final buffer
        this.reconstructor = null;
        this.emit('decoded', packet);
      }
    }
  }
  else {
    throw new Error('Unknown type: ' + obj);
  }
};

/**
 * Decode a packet String (JSON data)
 *
 * @param {String} str
 * @return {Object} packet
 * @api private
 */

function decodeString(str) {
  var p = {};
  var i = 0;

  // look up type
  p.type = Number(str.charAt(0));
  if (null == exports.types[p.type]) return error();

  // look up attachments if type binary
  if (exports.BINARY_EVENT == p.type || exports.BINARY_ACK == p.type) {
    var buf = '';
    while (str.charAt(++i) != '-') {
      buf += str.charAt(i);
      if (i == str.length) break;
    }
    if (buf != Number(buf) || str.charAt(i) != '-') {
      throw new Error('Illegal attachments');
    }
    p.attachments = Number(buf);
  }

  // look up namespace (if any)
  if ('/' == str.charAt(i + 1)) {
    p.nsp = '';
    while (++i) {
      var c = str.charAt(i);
      if (',' == c) break;
      p.nsp += c;
      if (i == str.length) break;
    }
  } else {
    p.nsp = '/';
  }

  // look up id
  var next = str.charAt(i + 1);
  if ('' !== next && Number(next) == next) {
    p.id = '';
    while (++i) {
      var c = str.charAt(i);
      if (null == c || Number(c) != c) {
        --i;
        break;
      }
      p.id += str.charAt(i);
      if (i == str.length) break;
    }
    p.id = Number(p.id);
  }

  // look up json data
  if (str.charAt(++i)) {
    try {
      p.data = json.parse(str.substr(i));
    } catch(e){
      return error();
    }
  }

  debug('decoded %s as %j', str, p);
  return p;
}

/**
 * Deallocates a parser's resources
 *
 * @api public
 */

Decoder.prototype.destroy = function() {
  if (this.reconstructor) {
    this.reconstructor.finishedReconstruction();
  }
};

/**
 * A manager of a binary event's 'buffer sequence'. Should
 * be constructed whenever a packet of type BINARY_EVENT is
 * decoded.
 *
 * @param {Object} packet
 * @return {BinaryReconstructor} initialized reconstructor
 * @api private
 */

function BinaryReconstructor(packet) {
  this.reconPack = packet;
  this.buffers = [];
}

/**
 * Method to be called when binary data received from connection
 * after a BINARY_EVENT packet.
 *
 * @param {Buffer | ArrayBuffer} binData - the raw binary data received
 * @return {null | Object} returns null if more binary data is expected or
 *   a reconstructed packet object if all buffers have been received.
 * @api private
 */

BinaryReconstructor.prototype.takeBinaryData = function(binData) {
  this.buffers.push(binData);
  if (this.buffers.length == this.reconPack.attachments) { // done with buffer list
    var packet = binary.reconstructPacket(this.reconPack, this.buffers);
    this.finishedReconstruction();
    return packet;
  }
  return null;
};

/**
 * Cleans up binary packet reconstruction variables.
 *
 * @api private
 */

BinaryReconstructor.prototype.finishedReconstruction = function() {
  this.reconPack = null;
  this.buffers = [];
};

function error(data){
  return {
    type: exports.ERROR,
    data: 'parser error'
  };
}

},{"./binary":188,"./is-buffer":190,"component-emitter":114,"debug":116,"isarray":191,"json3":192}],190:[function(require,module,exports){
(function (global){

module.exports = isBuf;

/**
 * Returns true if obj is a buffer or an arraybuffer.
 *
 * @api private
 */

function isBuf(obj) {
  return (global.Buffer && global.Buffer.isBuffer(obj)) ||
         (global.ArrayBuffer && obj instanceof ArrayBuffer);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],191:[function(require,module,exports){
arguments[4][134][0].apply(exports,arguments)
},{"dup":134}],192:[function(require,module,exports){
(function (global){
/*! JSON v3.3.2 | http://bestiejs.github.io/json3 | Copyright 2012-2014, Kit Cambridge | http://kit.mit-license.org */
;(function () {
  // Detect the `define` function exposed by asynchronous module loaders. The
  // strict `define` check is necessary for compatibility with `r.js`.
  var isLoader = typeof define === "function" && define.amd;

  // A set of types used to distinguish objects from primitives.
  var objectTypes = {
    "function": true,
    "object": true
  };

  // Detect the `exports` object exposed by CommonJS implementations.
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  // Use the `global` object exposed by Node (including Browserify via
  // `insert-module-globals`), Narwhal, and Ringo as the default context,
  // and the `window` object in browsers. Rhino exports a `global` function
  // instead.
  var root = objectTypes[typeof window] && window || this,
      freeGlobal = freeExports && objectTypes[typeof module] && module && !module.nodeType && typeof global == "object" && global;

  if (freeGlobal && (freeGlobal["global"] === freeGlobal || freeGlobal["window"] === freeGlobal || freeGlobal["self"] === freeGlobal)) {
    root = freeGlobal;
  }

  // Public: Initializes JSON 3 using the given `context` object, attaching the
  // `stringify` and `parse` functions to the specified `exports` object.
  function runInContext(context, exports) {
    context || (context = root["Object"]());
    exports || (exports = root["Object"]());

    // Native constructor aliases.
    var Number = context["Number"] || root["Number"],
        String = context["String"] || root["String"],
        Object = context["Object"] || root["Object"],
        Date = context["Date"] || root["Date"],
        SyntaxError = context["SyntaxError"] || root["SyntaxError"],
        TypeError = context["TypeError"] || root["TypeError"],
        Math = context["Math"] || root["Math"],
        nativeJSON = context["JSON"] || root["JSON"];

    // Delegate to the native `stringify` and `parse` implementations.
    if (typeof nativeJSON == "object" && nativeJSON) {
      exports.stringify = nativeJSON.stringify;
      exports.parse = nativeJSON.parse;
    }

    // Convenience aliases.
    var objectProto = Object.prototype,
        getClass = objectProto.toString,
        isProperty, forEach, undef;

    // Test the `Date#getUTC*` methods. Based on work by @Yaffle.
    var isExtended = new Date(-3509827334573292);
    try {
      // The `getUTCFullYear`, `Month`, and `Date` methods return nonsensical
      // results for certain dates in Opera >= 10.53.
      isExtended = isExtended.getUTCFullYear() == -109252 && isExtended.getUTCMonth() === 0 && isExtended.getUTCDate() === 1 &&
        // Safari < 2.0.2 stores the internal millisecond time value correctly,
        // but clips the values returned by the date methods to the range of
        // signed 32-bit integers ([-2 ** 31, 2 ** 31 - 1]).
        isExtended.getUTCHours() == 10 && isExtended.getUTCMinutes() == 37 && isExtended.getUTCSeconds() == 6 && isExtended.getUTCMilliseconds() == 708;
    } catch (exception) {}

    // Internal: Determines whether the native `JSON.stringify` and `parse`
    // implementations are spec-compliant. Based on work by Ken Snyder.
    function has(name) {
      if (has[name] !== undef) {
        // Return cached feature test result.
        return has[name];
      }
      var isSupported;
      if (name == "bug-string-char-index") {
        // IE <= 7 doesn't support accessing string characters using square
        // bracket notation. IE 8 only supports this for primitives.
        isSupported = "a"[0] != "a";
      } else if (name == "json") {
        // Indicates whether both `JSON.stringify` and `JSON.parse` are
        // supported.
        isSupported = has("json-stringify") && has("json-parse");
      } else {
        var value, serialized = '{"a":[1,true,false,null,"\\u0000\\b\\n\\f\\r\\t"]}';
        // Test `JSON.stringify`.
        if (name == "json-stringify") {
          var stringify = exports.stringify, stringifySupported = typeof stringify == "function" && isExtended;
          if (stringifySupported) {
            // A test function object with a custom `toJSON` method.
            (value = function () {
              return 1;
            }).toJSON = value;
            try {
              stringifySupported =
                // Firefox 3.1b1 and b2 serialize string, number, and boolean
                // primitives as object literals.
                stringify(0) === "0" &&
                // FF 3.1b1, b2, and JSON 2 serialize wrapped primitives as object
                // literals.
                stringify(new Number()) === "0" &&
                stringify(new String()) == '""' &&
                // FF 3.1b1, 2 throw an error if the value is `null`, `undefined`, or
                // does not define a canonical JSON representation (this applies to
                // objects with `toJSON` properties as well, *unless* they are nested
                // within an object or array).
                stringify(getClass) === undef &&
                // IE 8 serializes `undefined` as `"undefined"`. Safari <= 5.1.7 and
                // FF 3.1b3 pass this test.
                stringify(undef) === undef &&
                // Safari <= 5.1.7 and FF 3.1b3 throw `Error`s and `TypeError`s,
                // respectively, if the value is omitted entirely.
                stringify() === undef &&
                // FF 3.1b1, 2 throw an error if the given value is not a number,
                // string, array, object, Boolean, or `null` literal. This applies to
                // objects with custom `toJSON` methods as well, unless they are nested
                // inside object or array literals. YUI 3.0.0b1 ignores custom `toJSON`
                // methods entirely.
                stringify(value) === "1" &&
                stringify([value]) == "[1]" &&
                // Prototype <= 1.6.1 serializes `[undefined]` as `"[]"` instead of
                // `"[null]"`.
                stringify([undef]) == "[null]" &&
                // YUI 3.0.0b1 fails to serialize `null` literals.
                stringify(null) == "null" &&
                // FF 3.1b1, 2 halts serialization if an array contains a function:
                // `[1, true, getClass, 1]` serializes as "[1,true,],". FF 3.1b3
                // elides non-JSON values from objects and arrays, unless they
                // define custom `toJSON` methods.
                stringify([undef, getClass, null]) == "[null,null,null]" &&
                // Simple serialization test. FF 3.1b1 uses Unicode escape sequences
                // where character escape codes are expected (e.g., `\b` => `\u0008`).
                stringify({ "a": [value, true, false, null, "\x00\b\n\f\r\t"] }) == serialized &&
                // FF 3.1b1 and b2 ignore the `filter` and `width` arguments.
                stringify(null, value) === "1" &&
                stringify([1, 2], null, 1) == "[\n 1,\n 2\n]" &&
                // JSON 2, Prototype <= 1.7, and older WebKit builds incorrectly
                // serialize extended years.
                stringify(new Date(-8.64e15)) == '"-271821-04-20T00:00:00.000Z"' &&
                // The milliseconds are optional in ES 5, but required in 5.1.
                stringify(new Date(8.64e15)) == '"+275760-09-13T00:00:00.000Z"' &&
                // Firefox <= 11.0 incorrectly serializes years prior to 0 as negative
                // four-digit years instead of six-digit years. Credits: @Yaffle.
                stringify(new Date(-621987552e5)) == '"-000001-01-01T00:00:00.000Z"' &&
                // Safari <= 5.1.5 and Opera >= 10.53 incorrectly serialize millisecond
                // values less than 1000. Credits: @Yaffle.
                stringify(new Date(-1)) == '"1969-12-31T23:59:59.999Z"';
            } catch (exception) {
              stringifySupported = false;
            }
          }
          isSupported = stringifySupported;
        }
        // Test `JSON.parse`.
        if (name == "json-parse") {
          var parse = exports.parse;
          if (typeof parse == "function") {
            try {
              // FF 3.1b1, b2 will throw an exception if a bare literal is provided.
              // Conforming implementations should also coerce the initial argument to
              // a string prior to parsing.
              if (parse("0") === 0 && !parse(false)) {
                // Simple parsing test.
                value = parse(serialized);
                var parseSupported = value["a"].length == 5 && value["a"][0] === 1;
                if (parseSupported) {
                  try {
                    // Safari <= 5.1.2 and FF 3.1b1 allow unescaped tabs in strings.
                    parseSupported = !parse('"\t"');
                  } catch (exception) {}
                  if (parseSupported) {
                    try {
                      // FF 4.0 and 4.0.1 allow leading `+` signs and leading
                      // decimal points. FF 4.0, 4.0.1, and IE 9-10 also allow
                      // certain octal literals.
                      parseSupported = parse("01") !== 1;
                    } catch (exception) {}
                  }
                  if (parseSupported) {
                    try {
                      // FF 4.0, 4.0.1, and Rhino 1.7R3-R4 allow trailing decimal
                      // points. These environments, along with FF 3.1b1 and 2,
                      // also allow trailing commas in JSON objects and arrays.
                      parseSupported = parse("1.") !== 1;
                    } catch (exception) {}
                  }
                }
              }
            } catch (exception) {
              parseSupported = false;
            }
          }
          isSupported = parseSupported;
        }
      }
      return has[name] = !!isSupported;
    }

    if (!has("json")) {
      // Common `[[Class]]` name aliases.
      var functionClass = "[object Function]",
          dateClass = "[object Date]",
          numberClass = "[object Number]",
          stringClass = "[object String]",
          arrayClass = "[object Array]",
          booleanClass = "[object Boolean]";

      // Detect incomplete support for accessing string characters by index.
      var charIndexBuggy = has("bug-string-char-index");

      // Define additional utility methods if the `Date` methods are buggy.
      if (!isExtended) {
        var floor = Math.floor;
        // A mapping between the months of the year and the number of days between
        // January 1st and the first of the respective month.
        var Months = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        // Internal: Calculates the number of days between the Unix epoch and the
        // first day of the given month.
        var getDay = function (year, month) {
          return Months[month] + 365 * (year - 1970) + floor((year - 1969 + (month = +(month > 1))) / 4) - floor((year - 1901 + month) / 100) + floor((year - 1601 + month) / 400);
        };
      }

      // Internal: Determines if a property is a direct property of the given
      // object. Delegates to the native `Object#hasOwnProperty` method.
      if (!(isProperty = objectProto.hasOwnProperty)) {
        isProperty = function (property) {
          var members = {}, constructor;
          if ((members.__proto__ = null, members.__proto__ = {
            // The *proto* property cannot be set multiple times in recent
            // versions of Firefox and SeaMonkey.
            "toString": 1
          }, members).toString != getClass) {
            // Safari <= 2.0.3 doesn't implement `Object#hasOwnProperty`, but
            // supports the mutable *proto* property.
            isProperty = function (property) {
              // Capture and break the object's prototype chain (see section 8.6.2
              // of the ES 5.1 spec). The parenthesized expression prevents an
              // unsafe transformation by the Closure Compiler.
              var original = this.__proto__, result = property in (this.__proto__ = null, this);
              // Restore the original prototype chain.
              this.__proto__ = original;
              return result;
            };
          } else {
            // Capture a reference to the top-level `Object` constructor.
            constructor = members.constructor;
            // Use the `constructor` property to simulate `Object#hasOwnProperty` in
            // other environments.
            isProperty = function (property) {
              var parent = (this.constructor || constructor).prototype;
              return property in this && !(property in parent && this[property] === parent[property]);
            };
          }
          members = null;
          return isProperty.call(this, property);
        };
      }

      // Internal: Normalizes the `for...in` iteration algorithm across
      // environments. Each enumerated key is yielded to a `callback` function.
      forEach = function (object, callback) {
        var size = 0, Properties, members, property;

        // Tests for bugs in the current environment's `for...in` algorithm. The
        // `valueOf` property inherits the non-enumerable flag from
        // `Object.prototype` in older versions of IE, Netscape, and Mozilla.
        (Properties = function () {
          this.valueOf = 0;
        }).prototype.valueOf = 0;

        // Iterate over a new instance of the `Properties` class.
        members = new Properties();
        for (property in members) {
          // Ignore all properties inherited from `Object.prototype`.
          if (isProperty.call(members, property)) {
            size++;
          }
        }
        Properties = members = null;

        // Normalize the iteration algorithm.
        if (!size) {
          // A list of non-enumerable properties inherited from `Object.prototype`.
          members = ["valueOf", "toString", "toLocaleString", "propertyIsEnumerable", "isPrototypeOf", "hasOwnProperty", "constructor"];
          // IE <= 8, Mozilla 1.0, and Netscape 6.2 ignore shadowed non-enumerable
          // properties.
          forEach = function (object, callback) {
            var isFunction = getClass.call(object) == functionClass, property, length;
            var hasProperty = !isFunction && typeof object.constructor != "function" && objectTypes[typeof object.hasOwnProperty] && object.hasOwnProperty || isProperty;
            for (property in object) {
              // Gecko <= 1.0 enumerates the `prototype` property of functions under
              // certain conditions; IE does not.
              if (!(isFunction && property == "prototype") && hasProperty.call(object, property)) {
                callback(property);
              }
            }
            // Manually invoke the callback for each non-enumerable property.
            for (length = members.length; property = members[--length]; hasProperty.call(object, property) && callback(property));
          };
        } else if (size == 2) {
          // Safari <= 2.0.4 enumerates shadowed properties twice.
          forEach = function (object, callback) {
            // Create a set of iterated properties.
            var members = {}, isFunction = getClass.call(object) == functionClass, property;
            for (property in object) {
              // Store each property name to prevent double enumeration. The
              // `prototype` property of functions is not enumerated due to cross-
              // environment inconsistencies.
              if (!(isFunction && property == "prototype") && !isProperty.call(members, property) && (members[property] = 1) && isProperty.call(object, property)) {
                callback(property);
              }
            }
          };
        } else {
          // No bugs detected; use the standard `for...in` algorithm.
          forEach = function (object, callback) {
            var isFunction = getClass.call(object) == functionClass, property, isConstructor;
            for (property in object) {
              if (!(isFunction && property == "prototype") && isProperty.call(object, property) && !(isConstructor = property === "constructor")) {
                callback(property);
              }
            }
            // Manually invoke the callback for the `constructor` property due to
            // cross-environment inconsistencies.
            if (isConstructor || isProperty.call(object, (property = "constructor"))) {
              callback(property);
            }
          };
        }
        return forEach(object, callback);
      };

      // Public: Serializes a JavaScript `value` as a JSON string. The optional
      // `filter` argument may specify either a function that alters how object and
      // array members are serialized, or an array of strings and numbers that
      // indicates which properties should be serialized. The optional `width`
      // argument may be either a string or number that specifies the indentation
      // level of the output.
      if (!has("json-stringify")) {
        // Internal: A map of control characters and their escaped equivalents.
        var Escapes = {
          92: "\\\\",
          34: '\\"',
          8: "\\b",
          12: "\\f",
          10: "\\n",
          13: "\\r",
          9: "\\t"
        };

        // Internal: Converts `value` into a zero-padded string such that its
        // length is at least equal to `width`. The `width` must be <= 6.
        var leadingZeroes = "000000";
        var toPaddedString = function (width, value) {
          // The `|| 0` expression is necessary to work around a bug in
          // Opera <= 7.54u2 where `0 == -0`, but `String(-0) !== "0"`.
          return (leadingZeroes + (value || 0)).slice(-width);
        };

        // Internal: Double-quotes a string `value`, replacing all ASCII control
        // characters (characters with code unit values between 0 and 31) with
        // their escaped equivalents. This is an implementation of the
        // `Quote(value)` operation defined in ES 5.1 section 15.12.3.
        var unicodePrefix = "\\u00";
        var quote = function (value) {
          var result = '"', index = 0, length = value.length, useCharIndex = !charIndexBuggy || length > 10;
          var symbols = useCharIndex && (charIndexBuggy ? value.split("") : value);
          for (; index < length; index++) {
            var charCode = value.charCodeAt(index);
            // If the character is a control character, append its Unicode or
            // shorthand escape sequence; otherwise, append the character as-is.
            switch (charCode) {
              case 8: case 9: case 10: case 12: case 13: case 34: case 92:
                result += Escapes[charCode];
                break;
              default:
                if (charCode < 32) {
                  result += unicodePrefix + toPaddedString(2, charCode.toString(16));
                  break;
                }
                result += useCharIndex ? symbols[index] : value.charAt(index);
            }
          }
          return result + '"';
        };

        // Internal: Recursively serializes an object. Implements the
        // `Str(key, holder)`, `JO(value)`, and `JA(value)` operations.
        var serialize = function (property, object, callback, properties, whitespace, indentation, stack) {
          var value, className, year, month, date, time, hours, minutes, seconds, milliseconds, results, element, index, length, prefix, result;
          try {
            // Necessary for host object support.
            value = object[property];
          } catch (exception) {}
          if (typeof value == "object" && value) {
            className = getClass.call(value);
            if (className == dateClass && !isProperty.call(value, "toJSON")) {
              if (value > -1 / 0 && value < 1 / 0) {
                // Dates are serialized according to the `Date#toJSON` method
                // specified in ES 5.1 section 15.9.5.44. See section 15.9.1.15
                // for the ISO 8601 date time string format.
                if (getDay) {
                  // Manually compute the year, month, date, hours, minutes,
                  // seconds, and milliseconds if the `getUTC*` methods are
                  // buggy. Adapted from @Yaffle's `date-shim` project.
                  date = floor(value / 864e5);
                  for (year = floor(date / 365.2425) + 1970 - 1; getDay(year + 1, 0) <= date; year++);
                  for (month = floor((date - getDay(year, 0)) / 30.42); getDay(year, month + 1) <= date; month++);
                  date = 1 + date - getDay(year, month);
                  // The `time` value specifies the time within the day (see ES
                  // 5.1 section 15.9.1.2). The formula `(A % B + B) % B` is used
                  // to compute `A modulo B`, as the `%` operator does not
                  // correspond to the `modulo` operation for negative numbers.
                  time = (value % 864e5 + 864e5) % 864e5;
                  // The hours, minutes, seconds, and milliseconds are obtained by
                  // decomposing the time within the day. See section 15.9.1.10.
                  hours = floor(time / 36e5) % 24;
                  minutes = floor(time / 6e4) % 60;
                  seconds = floor(time / 1e3) % 60;
                  milliseconds = time % 1e3;
                } else {
                  year = value.getUTCFullYear();
                  month = value.getUTCMonth();
                  date = value.getUTCDate();
                  hours = value.getUTCHours();
                  minutes = value.getUTCMinutes();
                  seconds = value.getUTCSeconds();
                  milliseconds = value.getUTCMilliseconds();
                }
                // Serialize extended years correctly.
                value = (year <= 0 || year >= 1e4 ? (year < 0 ? "-" : "+") + toPaddedString(6, year < 0 ? -year : year) : toPaddedString(4, year)) +
                  "-" + toPaddedString(2, month + 1) + "-" + toPaddedString(2, date) +
                  // Months, dates, hours, minutes, and seconds should have two
                  // digits; milliseconds should have three.
                  "T" + toPaddedString(2, hours) + ":" + toPaddedString(2, minutes) + ":" + toPaddedString(2, seconds) +
                  // Milliseconds are optional in ES 5.0, but required in 5.1.
                  "." + toPaddedString(3, milliseconds) + "Z";
              } else {
                value = null;
              }
            } else if (typeof value.toJSON == "function" && ((className != numberClass && className != stringClass && className != arrayClass) || isProperty.call(value, "toJSON"))) {
              // Prototype <= 1.6.1 adds non-standard `toJSON` methods to the
              // `Number`, `String`, `Date`, and `Array` prototypes. JSON 3
              // ignores all `toJSON` methods on these objects unless they are
              // defined directly on an instance.
              value = value.toJSON(property);
            }
          }
          if (callback) {
            // If a replacement function was provided, call it to obtain the value
            // for serialization.
            value = callback.call(object, property, value);
          }
          if (value === null) {
            return "null";
          }
          className = getClass.call(value);
          if (className == booleanClass) {
            // Booleans are represented literally.
            return "" + value;
          } else if (className == numberClass) {
            // JSON numbers must be finite. `Infinity` and `NaN` are serialized as
            // `"null"`.
            return value > -1 / 0 && value < 1 / 0 ? "" + value : "null";
          } else if (className == stringClass) {
            // Strings are double-quoted and escaped.
            return quote("" + value);
          }
          // Recursively serialize objects and arrays.
          if (typeof value == "object") {
            // Check for cyclic structures. This is a linear search; performance
            // is inversely proportional to the number of unique nested objects.
            for (length = stack.length; length--;) {
              if (stack[length] === value) {
                // Cyclic structures cannot be serialized by `JSON.stringify`.
                throw TypeError();
              }
            }
            // Add the object to the stack of traversed objects.
            stack.push(value);
            results = [];
            // Save the current indentation level and indent one additional level.
            prefix = indentation;
            indentation += whitespace;
            if (className == arrayClass) {
              // Recursively serialize array elements.
              for (index = 0, length = value.length; index < length; index++) {
                element = serialize(index, value, callback, properties, whitespace, indentation, stack);
                results.push(element === undef ? "null" : element);
              }
              result = results.length ? (whitespace ? "[\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "]" : ("[" + results.join(",") + "]")) : "[]";
            } else {
              // Recursively serialize object members. Members are selected from
              // either a user-specified list of property names, or the object
              // itself.
              forEach(properties || value, function (property) {
                var element = serialize(property, value, callback, properties, whitespace, indentation, stack);
                if (element !== undef) {
                  // According to ES 5.1 section 15.12.3: "If `gap` {whitespace}
                  // is not the empty string, let `member` {quote(property) + ":"}
                  // be the concatenation of `member` and the `space` character."
                  // The "`space` character" refers to the literal space
                  // character, not the `space` {width} argument provided to
                  // `JSON.stringify`.
                  results.push(quote(property) + ":" + (whitespace ? " " : "") + element);
                }
              });
              result = results.length ? (whitespace ? "{\n" + indentation + results.join(",\n" + indentation) + "\n" + prefix + "}" : ("{" + results.join(",") + "}")) : "{}";
            }
            // Remove the object from the traversed object stack.
            stack.pop();
            return result;
          }
        };

        // Public: `JSON.stringify`. See ES 5.1 section 15.12.3.
        exports.stringify = function (source, filter, width) {
          var whitespace, callback, properties, className;
          if (objectTypes[typeof filter] && filter) {
            if ((className = getClass.call(filter)) == functionClass) {
              callback = filter;
            } else if (className == arrayClass) {
              // Convert the property names array into a makeshift set.
              properties = {};
              for (var index = 0, length = filter.length, value; index < length; value = filter[index++], ((className = getClass.call(value)), className == stringClass || className == numberClass) && (properties[value] = 1));
            }
          }
          if (width) {
            if ((className = getClass.call(width)) == numberClass) {
              // Convert the `width` to an integer and create a string containing
              // `width` number of space characters.
              if ((width -= width % 1) > 0) {
                for (whitespace = "", width > 10 && (width = 10); whitespace.length < width; whitespace += " ");
              }
            } else if (className == stringClass) {
              whitespace = width.length <= 10 ? width : width.slice(0, 10);
            }
          }
          // Opera <= 7.54u2 discards the values associated with empty string keys
          // (`""`) only if they are used directly within an object member list
          // (e.g., `!("" in { "": 1})`).
          return serialize("", (value = {}, value[""] = source, value), callback, properties, whitespace, "", []);
        };
      }

      // Public: Parses a JSON source string.
      if (!has("json-parse")) {
        var fromCharCode = String.fromCharCode;

        // Internal: A map of escaped control characters and their unescaped
        // equivalents.
        var Unescapes = {
          92: "\\",
          34: '"',
          47: "/",
          98: "\b",
          116: "\t",
          110: "\n",
          102: "\f",
          114: "\r"
        };

        // Internal: Stores the parser state.
        var Index, Source;

        // Internal: Resets the parser state and throws a `SyntaxError`.
        var abort = function () {
          Index = Source = null;
          throw SyntaxError();
        };

        // Internal: Returns the next token, or `"$"` if the parser has reached
        // the end of the source string. A token may be a string, number, `null`
        // literal, or Boolean literal.
        var lex = function () {
          var source = Source, length = source.length, value, begin, position, isSigned, charCode;
          while (Index < length) {
            charCode = source.charCodeAt(Index);
            switch (charCode) {
              case 9: case 10: case 13: case 32:
                // Skip whitespace tokens, including tabs, carriage returns, line
                // feeds, and space characters.
                Index++;
                break;
              case 123: case 125: case 91: case 93: case 58: case 44:
                // Parse a punctuator token (`{`, `}`, `[`, `]`, `:`, or `,`) at
                // the current position.
                value = charIndexBuggy ? source.charAt(Index) : source[Index];
                Index++;
                return value;
              case 34:
                // `"` delimits a JSON string; advance to the next character and
                // begin parsing the string. String tokens are prefixed with the
                // sentinel `@` character to distinguish them from punctuators and
                // end-of-string tokens.
                for (value = "@", Index++; Index < length;) {
                  charCode = source.charCodeAt(Index);
                  if (charCode < 32) {
                    // Unescaped ASCII control characters (those with a code unit
                    // less than the space character) are not permitted.
                    abort();
                  } else if (charCode == 92) {
                    // A reverse solidus (`\`) marks the beginning of an escaped
                    // control character (including `"`, `\`, and `/`) or Unicode
                    // escape sequence.
                    charCode = source.charCodeAt(++Index);
                    switch (charCode) {
                      case 92: case 34: case 47: case 98: case 116: case 110: case 102: case 114:
                        // Revive escaped control characters.
                        value += Unescapes[charCode];
                        Index++;
                        break;
                      case 117:
                        // `\u` marks the beginning of a Unicode escape sequence.
                        // Advance to the first character and validate the
                        // four-digit code point.
                        begin = ++Index;
                        for (position = Index + 4; Index < position; Index++) {
                          charCode = source.charCodeAt(Index);
                          // A valid sequence comprises four hexdigits (case-
                          // insensitive) that form a single hexadecimal value.
                          if (!(charCode >= 48 && charCode <= 57 || charCode >= 97 && charCode <= 102 || charCode >= 65 && charCode <= 70)) {
                            // Invalid Unicode escape sequence.
                            abort();
                          }
                        }
                        // Revive the escaped character.
                        value += fromCharCode("0x" + source.slice(begin, Index));
                        break;
                      default:
                        // Invalid escape sequence.
                        abort();
                    }
                  } else {
                    if (charCode == 34) {
                      // An unescaped double-quote character marks the end of the
                      // string.
                      break;
                    }
                    charCode = source.charCodeAt(Index);
                    begin = Index;
                    // Optimize for the common case where a string is valid.
                    while (charCode >= 32 && charCode != 92 && charCode != 34) {
                      charCode = source.charCodeAt(++Index);
                    }
                    // Append the string as-is.
                    value += source.slice(begin, Index);
                  }
                }
                if (source.charCodeAt(Index) == 34) {
                  // Advance to the next character and return the revived string.
                  Index++;
                  return value;
                }
                // Unterminated string.
                abort();
              default:
                // Parse numbers and literals.
                begin = Index;
                // Advance past the negative sign, if one is specified.
                if (charCode == 45) {
                  isSigned = true;
                  charCode = source.charCodeAt(++Index);
                }
                // Parse an integer or floating-point value.
                if (charCode >= 48 && charCode <= 57) {
                  // Leading zeroes are interpreted as octal literals.
                  if (charCode == 48 && ((charCode = source.charCodeAt(Index + 1)), charCode >= 48 && charCode <= 57)) {
                    // Illegal octal literal.
                    abort();
                  }
                  isSigned = false;
                  // Parse the integer component.
                  for (; Index < length && ((charCode = source.charCodeAt(Index)), charCode >= 48 && charCode <= 57); Index++);
                  // Floats cannot contain a leading decimal point; however, this
                  // case is already accounted for by the parser.
                  if (source.charCodeAt(Index) == 46) {
                    position = ++Index;
                    // Parse the decimal component.
                    for (; position < length && ((charCode = source.charCodeAt(position)), charCode >= 48 && charCode <= 57); position++);
                    if (position == Index) {
                      // Illegal trailing decimal.
                      abort();
                    }
                    Index = position;
                  }
                  // Parse exponents. The `e` denoting the exponent is
                  // case-insensitive.
                  charCode = source.charCodeAt(Index);
                  if (charCode == 101 || charCode == 69) {
                    charCode = source.charCodeAt(++Index);
                    // Skip past the sign following the exponent, if one is
                    // specified.
                    if (charCode == 43 || charCode == 45) {
                      Index++;
                    }
                    // Parse the exponential component.
                    for (position = Index; position < length && ((charCode = source.charCodeAt(position)), charCode >= 48 && charCode <= 57); position++);
                    if (position == Index) {
                      // Illegal empty exponent.
                      abort();
                    }
                    Index = position;
                  }
                  // Coerce the parsed value to a JavaScript number.
                  return +source.slice(begin, Index);
                }
                // A negative sign may only precede numbers.
                if (isSigned) {
                  abort();
                }
                // `true`, `false`, and `null` literals.
                if (source.slice(Index, Index + 4) == "true") {
                  Index += 4;
                  return true;
                } else if (source.slice(Index, Index + 5) == "false") {
                  Index += 5;
                  return false;
                } else if (source.slice(Index, Index + 4) == "null") {
                  Index += 4;
                  return null;
                }
                // Unrecognized token.
                abort();
            }
          }
          // Return the sentinel `$` character if the parser has reached the end
          // of the source string.
          return "$";
        };

        // Internal: Parses a JSON `value` token.
        var get = function (value) {
          var results, hasMembers;
          if (value == "$") {
            // Unexpected end of input.
            abort();
          }
          if (typeof value == "string") {
            if ((charIndexBuggy ? value.charAt(0) : value[0]) == "@") {
              // Remove the sentinel `@` character.
              return value.slice(1);
            }
            // Parse object and array literals.
            if (value == "[") {
              // Parses a JSON array, returning a new JavaScript array.
              results = [];
              for (;; hasMembers || (hasMembers = true)) {
                value = lex();
                // A closing square bracket marks the end of the array literal.
                if (value == "]") {
                  break;
                }
                // If the array literal contains elements, the current token
                // should be a comma separating the previous element from the
                // next.
                if (hasMembers) {
                  if (value == ",") {
                    value = lex();
                    if (value == "]") {
                      // Unexpected trailing `,` in array literal.
                      abort();
                    }
                  } else {
                    // A `,` must separate each array element.
                    abort();
                  }
                }
                // Elisions and leading commas are not permitted.
                if (value == ",") {
                  abort();
                }
                results.push(get(value));
              }
              return results;
            } else if (value == "{") {
              // Parses a JSON object, returning a new JavaScript object.
              results = {};
              for (;; hasMembers || (hasMembers = true)) {
                value = lex();
                // A closing curly brace marks the end of the object literal.
                if (value == "}") {
                  break;
                }
                // If the object literal contains members, the current token
                // should be a comma separator.
                if (hasMembers) {
                  if (value == ",") {
                    value = lex();
                    if (value == "}") {
                      // Unexpected trailing `,` in object literal.
                      abort();
                    }
                  } else {
                    // A `,` must separate each object member.
                    abort();
                  }
                }
                // Leading commas are not permitted, object property names must be
                // double-quoted strings, and a `:` must separate each property
                // name and value.
                if (value == "," || typeof value != "string" || (charIndexBuggy ? value.charAt(0) : value[0]) != "@" || lex() != ":") {
                  abort();
                }
                results[value.slice(1)] = get(lex());
              }
              return results;
            }
            // Unexpected token encountered.
            abort();
          }
          return value;
        };

        // Internal: Updates a traversed object member.
        var update = function (source, property, callback) {
          var element = walk(source, property, callback);
          if (element === undef) {
            delete source[property];
          } else {
            source[property] = element;
          }
        };

        // Internal: Recursively traverses a parsed JSON object, invoking the
        // `callback` function for each value. This is an implementation of the
        // `Walk(holder, name)` operation defined in ES 5.1 section 15.12.2.
        var walk = function (source, property, callback) {
          var value = source[property], length;
          if (typeof value == "object" && value) {
            // `forEach` can't be used to traverse an array in Opera <= 8.54
            // because its `Object#hasOwnProperty` implementation returns `false`
            // for array indices (e.g., `![1, 2, 3].hasOwnProperty("0")`).
            if (getClass.call(value) == arrayClass) {
              for (length = value.length; length--;) {
                update(value, length, callback);
              }
            } else {
              forEach(value, function (property) {
                update(value, property, callback);
              });
            }
          }
          return callback.call(source, property, value);
        };

        // Public: `JSON.parse`. See ES 5.1 section 15.12.2.
        exports.parse = function (source, callback) {
          var result, value;
          Index = 0;
          Source = "" + source;
          result = get(lex());
          // If a JSON string contains multiple tokens, it is invalid.
          if (lex() != "$") {
            abort();
          }
          // Reset the parser state.
          Index = Source = null;
          return callback && getClass.call(callback) == functionClass ? walk((value = {}, value[""] = result, value), "", callback) : result;
        };
      }
    }

    exports["runInContext"] = runInContext;
    return exports;
  }

  if (freeExports && !isLoader) {
    // Export for CommonJS environments.
    runInContext(root, freeExports);
  } else {
    // Export for web browsers and JavaScript engines.
    var nativeJSON = root.JSON,
        previousJSON = root["JSON3"],
        isRestored = false;

    var JSON3 = runInContext(root, (root["JSON3"] = {
      // Public: Restores the original value of the global `JSON` object and
      // returns a reference to the `JSON3` object.
      "noConflict": function () {
        if (!isRestored) {
          isRestored = true;
          root.JSON = nativeJSON;
          root["JSON3"] = previousJSON;
          nativeJSON = previousJSON = null;
        }
        return JSON3;
      }
    }));

    root.JSON = {
      "parse": JSON3.parse,
      "stringify": JSON3.stringify
    };
  }

  // Export for asynchronous module loaders.
  if (isLoader) {
    define(function () {
      return JSON3;
    });
  }
}).call(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],193:[function(require,module,exports){
var nargs = /\{([0-9a-zA-Z_]+)\}/g

module.exports = template

function template(string) {
    var args

    if (arguments.length === 2 && typeof arguments[1] === "object") {
        args = arguments[1]
    } else {
        args = new Array(arguments.length - 1)
        for (var i = 1; i < arguments.length; ++i) {
            args[i - 1] = arguments[i]
        }
    }

    if (!args || !args.hasOwnProperty) {
        args = {}
    }

    return string.replace(nargs, function replaceArg(match, i, index) {
        var result

        if (string[index - 1] === "{" &&
            string[index + match.length] === "}") {
            return i
        } else {
            result = args.hasOwnProperty(i) ? args[i] : null
            if (result === null || result === undefined) {
                return ""
            }

            return result
        }
    })
}

},{}],194:[function(require,module,exports){
(function (global){
/* global window */
'use strict';

module.exports = require('./ponyfill')(global || window || this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ponyfill":195}],195:[function(require,module,exports){
'use strict';

module.exports = function symbolObservablePonyfill(root) {
	var result;
	var Symbol = root.Symbol;

	if (typeof Symbol === 'function') {
		if (Symbol.observable) {
			result = Symbol.observable;
		} else {
			result = Symbol('observable');
			Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
};

},{}],196:[function(require,module,exports){
module.exports = toArray

function toArray(list, index) {
    var array = []

    index = index || 0

    for (var i = index || 0; i < list.length; i++) {
        array[i - index] = list[i]
    }

    return array
}

},{}],197:[function(require,module,exports){
(function (global){
/*! https://mths.be/utf8js v2.0.0 by @mathias */
;(function(root) {

	// Detect free variables `exports`
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code,
	// and use it as `root`
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	var stringFromCharCode = String.fromCharCode;

	// Taken from https://mths.be/punycode
	function ucs2decode(string) {
		var output = [];
		var counter = 0;
		var length = string.length;
		var value;
		var extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	// Taken from https://mths.be/punycode
	function ucs2encode(array) {
		var length = array.length;
		var index = -1;
		var value;
		var output = '';
		while (++index < length) {
			value = array[index];
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
		}
		return output;
	}

	function checkScalarValue(codePoint) {
		if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
			throw Error(
				'Lone surrogate U+' + codePoint.toString(16).toUpperCase() +
				' is not a scalar value'
			);
		}
	}
	/*--------------------------------------------------------------------------*/

	function createByte(codePoint, shift) {
		return stringFromCharCode(((codePoint >> shift) & 0x3F) | 0x80);
	}

	function encodeCodePoint(codePoint) {
		if ((codePoint & 0xFFFFFF80) == 0) { // 1-byte sequence
			return stringFromCharCode(codePoint);
		}
		var symbol = '';
		if ((codePoint & 0xFFFFF800) == 0) { // 2-byte sequence
			symbol = stringFromCharCode(((codePoint >> 6) & 0x1F) | 0xC0);
		}
		else if ((codePoint & 0xFFFF0000) == 0) { // 3-byte sequence
			checkScalarValue(codePoint);
			symbol = stringFromCharCode(((codePoint >> 12) & 0x0F) | 0xE0);
			symbol += createByte(codePoint, 6);
		}
		else if ((codePoint & 0xFFE00000) == 0) { // 4-byte sequence
			symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xF0);
			symbol += createByte(codePoint, 12);
			symbol += createByte(codePoint, 6);
		}
		symbol += stringFromCharCode((codePoint & 0x3F) | 0x80);
		return symbol;
	}

	function utf8encode(string) {
		var codePoints = ucs2decode(string);
		var length = codePoints.length;
		var index = -1;
		var codePoint;
		var byteString = '';
		while (++index < length) {
			codePoint = codePoints[index];
			byteString += encodeCodePoint(codePoint);
		}
		return byteString;
	}

	/*--------------------------------------------------------------------------*/

	function readContinuationByte() {
		if (byteIndex >= byteCount) {
			throw Error('Invalid byte index');
		}

		var continuationByte = byteArray[byteIndex] & 0xFF;
		byteIndex++;

		if ((continuationByte & 0xC0) == 0x80) {
			return continuationByte & 0x3F;
		}

		// If we end up here, it’s not a continuation byte
		throw Error('Invalid continuation byte');
	}

	function decodeSymbol() {
		var byte1;
		var byte2;
		var byte3;
		var byte4;
		var codePoint;

		if (byteIndex > byteCount) {
			throw Error('Invalid byte index');
		}

		if (byteIndex == byteCount) {
			return false;
		}

		// Read first byte
		byte1 = byteArray[byteIndex] & 0xFF;
		byteIndex++;

		// 1-byte sequence (no continuation bytes)
		if ((byte1 & 0x80) == 0) {
			return byte1;
		}

		// 2-byte sequence
		if ((byte1 & 0xE0) == 0xC0) {
			var byte2 = readContinuationByte();
			codePoint = ((byte1 & 0x1F) << 6) | byte2;
			if (codePoint >= 0x80) {
				return codePoint;
			} else {
				throw Error('Invalid continuation byte');
			}
		}

		// 3-byte sequence (may include unpaired surrogates)
		if ((byte1 & 0xF0) == 0xE0) {
			byte2 = readContinuationByte();
			byte3 = readContinuationByte();
			codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
			if (codePoint >= 0x0800) {
				checkScalarValue(codePoint);
				return codePoint;
			} else {
				throw Error('Invalid continuation byte');
			}
		}

		// 4-byte sequence
		if ((byte1 & 0xF8) == 0xF0) {
			byte2 = readContinuationByte();
			byte3 = readContinuationByte();
			byte4 = readContinuationByte();
			codePoint = ((byte1 & 0x0F) << 0x12) | (byte2 << 0x0C) |
				(byte3 << 0x06) | byte4;
			if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
				return codePoint;
			}
		}

		throw Error('Invalid UTF-8 detected');
	}

	var byteArray;
	var byteCount;
	var byteIndex;
	function utf8decode(byteString) {
		byteArray = ucs2decode(byteString);
		byteCount = byteArray.length;
		byteIndex = 0;
		var codePoints = [];
		var tmp;
		while ((tmp = decodeSymbol()) !== false) {
			codePoints.push(tmp);
		}
		return ucs2encode(codePoints);
	}

	/*--------------------------------------------------------------------------*/

	var utf8 = {
		'version': '2.0.0',
		'encode': utf8encode,
		'decode': utf8decode
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define(function() {
			return utf8;
		});
	}	else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = utf8;
		} else { // in Narwhal or RingoJS v0.7.0-
			var object = {};
			var hasOwnProperty = object.hasOwnProperty;
			for (var key in utf8) {
				hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.utf8 = utf8;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],198:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _handleActions;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _handleActions2 = require('@f/handle-actions');

var _handleActions3 = _interopRequireDefault(_handleActions2);

var _createAction = require('@f/create-action');

var _createAction2 = _interopRequireDefault(_createAction);

var _containsElement = require('@f/contains-element');

var _containsElement2 = _interopRequireDefault(_containsElement);

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxDelay = require('vdux-delay');

var _vduxDelay2 = _interopRequireDefault(_vduxDelay);

var _body = require('vdux/body');

var _body2 = _interopRequireDefault(_body);

var _omit = require('@f/omit');

var _omit2 = _interopRequireDefault(_omit);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * initialState
 */

function initialState() {
  return {
    hover: false,
    linger: false,
    active: false,
    focus: false
  };
}

/**
 * Constants
 */

var filterProps = (0, _omit2.default)(['onHoverChange', 'onFocusChange', 'onActiveChange', 'onLingerChange', 'tag']);

/**
 * Css Emulator
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var state = _ref.state;
  var local = _ref.local;
  var onHoverChange = props.onHoverChange;
  var onFocusChange = props.onFocusChange;
  var onLingerChange = props.onLingerChange;
  var onActiveChange = props.onActiveChange;
  var _props$lingerDelay = props.lingerDelay;
  var lingerDelay = _props$lingerDelay === undefined ? 500 : _props$lingerDelay;
  var _props$tag = props.tag;
  var Tag = _props$tag === undefined ? 'div' : _props$tag;

  var elemProps = {};

  if (onHoverChange || onLingerChange) {
    elemProps.onMouseEnter = handler(props.onMouseEnter, local(mouseEnter));
    elemProps.onMouseLeave = handler(local(mouseLeave));
  }

  if (onActiveChange) {
    elemProps.onMouseDown = handler(props.onMouseDown, local(mouseDown));
  }

  if (onFocusChange) {
    elemProps.onFocus = handler(props.onFocus, local(focus));
    elemProps.onBlur = handler(props.onBlur, local(blur));
  }

  var node = void 0;
  return (0, _element2.default)(
    Tag,
    _extends({ ref: function ref(_node) {
        return node = _node;
      } }, filterProps(props), elemProps),
    children,
    state.hover && (0, _element2.default)(_body2.default, { onMouseMove: function onMouseMove(e) {
        return checkHover(local, node, e.target);
      } }),
    state.hover && onLingerChange && (0, _element2.default)(_vduxDelay2.default, { time: lingerDelay, onEnd: local(linger) }),
    state.active && (0, _element2.default)(_body2.default, { onMouseUp: local(mouseUp) })
  );
}

function onUpdate(prev, next) {
  // Don't do this stuff if our internal state hasn't changed
  if (prev.state !== next.state) {
    var result = [];

    if (prev.state.active !== next.state.active && next.props.onActiveChange) {
      result.push(next.props.onActiveChange(next.state.active));
    }

    if (prev.state.linger !== next.state.linger && next.props.onLingerChange) {
      result.push(next.props.onLingerChange(next.state.linger));
    }

    if (prev.state.hover !== next.state.hover && next.props.onHoverChange) {
      result.push(next.props.onHoverChange(next.state.hover));
    }

    if (prev.state.focus !== next.state.focus && next.props.onFocusChange) {
      result.push(next.props.onFocusChange(next.state.focus));
    }

    return result;
  }
}

/**
 * Actions
 */

var metaCreator = function metaCreator() {
  return { logLevel: 'debug' };
};
var mouseEnter = (0, _createAction2.default)('<CSSEmulator/>: mouseEnter', null, metaCreator);
var mouseLeave = (0, _createAction2.default)('<CSSEmulator/>: mouseLeave', null, metaCreator);
var mouseDown = (0, _createAction2.default)('<CSSEmulator/>: mouseDown', null, metaCreator);
var mouseUp = (0, _createAction2.default)('<CSSEmulator/>: mouseUp', null, metaCreator);
var focus = (0, _createAction2.default)('<CSSEmulator/>: focus', null, metaCreator);
var blur = (0, _createAction2.default)('<CSSEmulator/>: blur', null, metaCreator);
var linger = (0, _createAction2.default)('<CSSEmulator/>: linger', null, metaCreator);

function checkHover(local, regionElement, child) {
  if (!(0, _containsElement2.default)(regionElement, child)) {
    return local(mouseLeave)();
  }
}

/**
 * Reducer
 */

var reducer = (0, _handleActions3.default)((_handleActions = {}, _defineProperty(_handleActions, mouseEnter, function (state) {
  return _extends({}, state, { hover: true });
}), _defineProperty(_handleActions, mouseLeave, function (state) {
  return _extends({}, state, { hover: false, linger: false });
}), _defineProperty(_handleActions, mouseDown, function (state) {
  return _extends({}, state, { active: true });
}), _defineProperty(_handleActions, mouseUp, function (state) {
  return _extends({}, state, { active: false });
}), _defineProperty(_handleActions, focus, function (state) {
  return _extends({}, state, { focus: true });
}), _defineProperty(_handleActions, blur, function (state) {
  return _extends({}, state, { focus: false });
}), _defineProperty(_handleActions, linger, function (state) {
  return _extends({}, state, { linger: true });
}), _handleActions));

/**
 * Helpers
 */

function handler(a, b) {
  if (a && !b) return a;
  if (b && !a) return b;
  return [a, b];
}

/**
 * Exports
 */

exports.default = {
  initialState: initialState,
  render: render,
  onUpdate: onUpdate,
  reducer: reducer
};
},{"@f/contains-element":18,"@f/create-action":19,"@f/handle-actions":43,"@f/omit":76,"vdux-delay":199,"vdux/body":231,"vdux/element":233}],199:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _handleActions;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _createAction = require('@f/create-action');

var _createAction2 = _interopRequireDefault(_createAction);

var _handleActions2 = require('@f/handle-actions');

var _handleActions3 = _interopRequireDefault(_handleActions2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Delay component
 */

function initialState() {
  return {
    done: false
  };
}

function onCreate(_ref) {
  var props = _ref.props;
  var local = _ref.local;
  var onEnd = props.onEnd;
  var _props$time = props.time;
  var time = _props$time === undefined ? 0 : _props$time;


  return function (dispatch) {
    dispatch(local(beginTimer)(setTimeout(function () {
      onEnd && dispatch(onEnd());
      dispatch(local(endTimer)());
    }, time)));
  };
}

function render(_ref2) {
  var children = _ref2.children;
  var state = _ref2.state;

  if (!children.length > 1) throw new Error('Delay component accepts only one child');
  if (!state.done || children.length === 0) return (0, _element2.default)('span', null);

  return children[0];
}

function onUpdate(prev, next) {
  if (prev.props.time !== next.props.time) {
    throw new Error('<Delay/> component does not allow you to change the `time` prop');
  }
}

function onRemove(_ref3) {
  var state = _ref3.state;

  if (!state.done) {
    return function () {
      return clearTimeout(state.id);
    };
  }
}

/**
 * Actions
 */

var beginTimer = (0, _createAction2.default)('<Delay/> component: Begin timer', null, function () {
  return { logLevel: 'debug' };
});
var endTimer = (0, _createAction2.default)('<Delay/> component: End timer', null, function () {
  return { logLevel: 'debug' };
});

/**
 * Reducer
 */

var reducer = (0, _handleActions3.default)((_handleActions = {}, _defineProperty(_handleActions, beginTimer, function (state, id) {
  return _extends({}, state, { id: id });
}), _defineProperty(_handleActions, endTimer, function (state) {
  return _extends({}, state, { done: true });
}), _handleActions));

/**
 * Exports
 */

exports.default = {
  initialState: initialState,
  onCreate: onCreate,
  onUpdate: onUpdate,
  render: render,
  reducer: reducer,
  onRemove: onRemove
};
},{"@f/create-action":19,"@f/handle-actions":43,"vdux/element":233}],200:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _serializeForm = require('@f/serialize-form');

var _serializeForm2 = _interopRequireDefault(_serializeForm);

var _identity = require('@f/identity');

var _identity2 = _interopRequireDefault(_identity);

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _noop = require('@f/noop');

var _noop2 = _interopRequireDefault(_noop);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

/**
 * Imports
 */

var defaultValidate = function defaultValidate() {
  return { valid: true };
};

/**
 * Form component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var _props$onSubmit = props.onSubmit;
  var onSubmit = _props$onSubmit === undefined ? _noop2.default : _props$onSubmit;
  var _props$validate = props.validate;
  var validate = _props$validate === undefined ? defaultValidate : _props$validate;
  var _props$cast = props.cast;
  var cast = _props$cast === undefined ? _identity2.default : _props$cast;
  var _props$loading = props.loading;
  var loading = _props$loading === undefined ? false : _props$loading;


  return (0, _element2.default)(
    'form',
    { novalidate: true, onSubmit: handleSubmit, onChange: handleChange },
    children
  );

  function handleSubmit(e) {
    e.preventDefault();

    var form = e.target;
    var model = cast((0, _serializeForm2.default)(form));
    var valid = checkValidity(form, model);

    if (!loading && valid) {
      return onSubmit(model, function (res, err) {
        return err && invalidate(form, err);
      });
    }
  }

  function handleChange(e) {
    var _e$target = e.target;
    var name = _e$target.name;
    var form = _e$target.form;

    checkValidity(form, cast((0, _serializeForm2.default)(form)), name);
  }

  function checkValidity(form, model, name) {
    var _validate = validate(model, name);

    var valid = _validate.valid;
    var errors = _validate.errors;


    if (!valid) {
      invalidate(form, errors, name);
    }

    return valid;
  }

  function invalidate(form, errors, name) {
    if (name) {
      errors = errors.filter(function (_ref2) {
        var field = _ref2.field;
        return field === name;
      });
    }

    errors.forEach(function (_ref3) {
      var field = _ref3.field;
      var message = _ref3.message;

      var ctrl = form.querySelector('[name="' + field + '"]');

      if (ctrl) {
        ctrl.setCustomValidity(message);
        ctrl.checkValidity();
      }
    });
  }
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"@f/identity":48,"@f/noop":73,"@f/serialize-form":86,"vdux/element":233}],201:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _positionElement = require('@f/position-element');

var _positionElement2 = _interopRequireDefault(_positionElement);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Position
 */

/**
 * Imports
 */

function render(_ref) {
  var children = _ref.children;

  if (children.length > 1) throw new Error('Position component accepts only 1 child');
  return children[0];
}

function afterRender(_ref2, node) {
  var props = _ref2.props;
  var placement = props.placement;
  var near = props.near;
  var _props$space = props.space;
  var space = _props$space === undefined ? 0 : _props$space;
  var _props$disable = props.disable;
  var disable = _props$disable === undefined ? false : _props$disable;


  if (!disable) {
    (0, _positionElement2.default)(node, placement, {
      near: near && document.getElementById(near),
      space: space
    });
  }
}

/**
 * Exports
 */

exports.default = {
  render: render,
  afterRender: afterRender
};
},{"@f/position-element":79,"vdux/element":233}],202:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _util = require('../util');

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * getProps
 */

function getProps(props, _ref) {
  var uiTheme = _ref.uiTheme;

  props.$theme = (0, _util.mergeTheme)(uiTheme);

  var _props$circle = props.circle;
  var circle = _props$circle === undefined ? props.$theme.circularAvatars : _props$circle;
  var _props$size = props.size;
  var size = _props$size === undefined ? 32 : _props$size;

  props.circle = circle;
  props.size = size;

  return props;
}

/**
 * Avatar component
 */

function render(_ref2) {
  var props = _ref2.props;
  var $theme = props.$theme;
  var size = props.size;
  var avatarScale = $theme.avatarScale;


  if (avatarScale && avatarScale[size]) {
    size = avatarScale[size];
  }

  return (0, _element2.default)(_Base2.default, _extends({
    tag: 'img',
    'class': (0, _util.classes)(props.class, 'vui-avatar')
  }, props, {
    sq: size }));
}

/**
 * Exports
 */

exports.default = {
  getProps: getProps,
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],203:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * Imports
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          */

var _util = require('../util');

var _vduxCssEmulator = require('vdux-css-emulator');

var _vduxCssEmulator2 = _interopRequireDefault(_vduxCssEmulator);

var _htmlAttrs = require('@f/html-attrs');

var _htmlAttrs2 = _interopRequireDefault(_htmlAttrs);

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _extend = require('@f/extend');

var _extend2 = _interopRequireDefault(_extend);

var _has = require('@f/has');

var _has2 = _interopRequireDefault(_has);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

function getProps(props, context) {
  props.$theme = (0, _util.mergeTheme)(context.uiTheme);
  return props;
}

var eventRegex = /^on[A-Z]/;
var fns = {
  // Padding
  p: (0, _util.scaleSetter)('padding'),
  py: (0, _util.scaleSetter)(['paddingTop', 'paddingBottom']),
  px: (0, _util.scaleSetter)(['paddingLeft', 'paddingRight']),
  pt: (0, _util.scaleSetter)('paddingTop'),
  pb: (0, _util.scaleSetter)('paddingBottom'),
  pl: (0, _util.scaleSetter)('paddingLeft'),
  pr: (0, _util.scaleSetter)('paddingRight'),

  // Margin
  m: (0, _util.scaleSetter)('margin'),
  my: (0, _util.scaleSetter)(['marginTop', 'marginBottom']),
  mx: (0, _util.scaleSetter)(['marginLeft', 'marginRight']),
  mt: (0, _util.scaleSetter)('marginTop'),
  mb: (0, _util.scaleSetter)('marginBottom'),
  ml: (0, _util.scaleSetter)('marginLeft'),
  mr: (0, _util.scaleSetter)('marginRight'),

  // Font
  fontFamily: (0, _util.scaleSetter)('fontFamily', 'fonts'),
  italic: (0, _util.boolSetter)('fontStyle', 'italic'),
  bold: (0, _util.boolSetter)('fontWeight', 'bold'),
  capitalize: (0, _util.boolSetter)('textTransform', 'capitalize'),
  uppercase: (0, _util.boolSetter)('textTransform', 'uppercase'),
  antialiased: (0, _util.boolSetter)('-webkit-font-smoothing', 'antialiased'),
  weight: (0, _util.scaleSetter)('fontWeight', 'weightScale'),
  fs: function fs(style, val, theme, props) {
    (0, _util.setScaled)(style, 'fontSize', val, theme.fontScale);
    if ((0, _has2.default)(val, theme.lineHeightScale) && !(0, _has2.default)('lh', props)) {
      (0, _util.setScaled)(style, 'lineHeight', val, theme.lineHeightScale);
    }
  },
  lh: (0, _util.scaleSetter)('lineHeight', 'lineHeightScale'),

  // Size
  wide: (0, _util.boolSetter)('width', '100%'),
  tall: (0, _util.boolSetter)('height', '100%'),
  sq: (0, _util.scaleSetter)(['width', 'height']),
  w: (0, _util.scaleSetter)('width'),
  h: (0, _util.scaleSetter)('height'),

  // Cursor
  pointer: (0, _util.boolSetter)('cursor', 'pointer'),

  // Position
  absolute: (0, _util.positionSetter)('absolute'),
  relative: (0, _util.positionSetter)('relative'),
  fixed: (0, _util.positionSetter)('fixed'),
  top: function top(style, val) {
    return style.top = val === true ? 0 : val;
  },
  left: function left(style, val) {
    return style.left = val === true ? 0 : val;
  },
  right: function right(style, val) {
    return style.right = val === true ? 0 : val;
  },
  bottom: function bottom(style, val) {
    return style.bottom = val === true ? 0 : val;
  },

  // Color/Background
  color: (0, _util.scaleSetter)('color', 'colors'),
  bgColor: (0, _util.scaleSetter)('backgroundColor', 'colors'),
  bg: function bg(style, val, _ref) {
    var colors = _ref.colors;
    return style.background = val.split(' ').map(function (p) {
      return (0, _has2.default)(p, colors) ? colors[p] : p;
    }).join(' ');
  },

  // Element
  hide: (0, _util.boolSetter)('display', 'none'),
  hidden: (0, _util.boolSetter)('visibility', 'hidden'),

  z: (0, _util.scaleSetter)('zIndex', 'zIndexScale'),
  inlineBlock: (0, _util.boolSetter)('display', 'inline-block'),
  clear: function clear(style, val) {
    return style.clear = val === true ? 'both' : val;
  },
  ellipsis: function ellipsis(style, val) {
    if (val) {
      style.whiteSpace = 'nowrap';
      style.textOverflow = 'ellipsis';
      style.overflow = 'hidden';
    }
  },

  // Rounding
  pill: (0, _util.boolSetter)('borderRadius', 99999),
  circle: (0, _util.boolSetter)('borderRadius', 99999),
  rounded: function rounded(style, val, _ref2) {
    var borderRadius = _ref2.borderRadius;

    if (val === true) style.borderRadius = borderRadius;else if (val === false) style.borderRadius = 0;else if (typeof val === 'string') {
      style.borderRadius = posString(val, borderRadius);
    }
  },

  // Border
  border: (0, _util.borderSetter)('border'),
  borderTop: (0, _util.borderSetter)('borderTop'),
  borderBottom: (0, _util.borderSetter)('borderBottom'),
  borderLeft: (0, _util.borderSetter)('borderLeft'),
  borderRight: (0, _util.borderSetter)('borderRight'),
  borderColor: (0, _util.scaleSetter)('borderColor', 'colors'),
  borderTopColor: (0, _util.scaleSetter)('borderTopColor', 'colors'),
  borderLeftColor: (0, _util.scaleSetter)('borderLeftColor', 'colors'),
  borderRightColor: (0, _util.scaleSetter)('borderRightColor', 'colors'),
  borderBottomColor: (0, _util.scaleSetter)('borderBottomColor', 'colors'),

  borderWidth: function borderWidth(style, val) {
    return style.borderWidth = val;
  },

  // Flexbox
  flex: function flex(style, val, theme, props) {
    if (val) {
      if (val === true) style.flex = '1';else {
        style.flex = '1 1 ' + val;
        if (typeof val === 'string' && val.indexOf('%') !== -1) {
          style['max' + (props.col ? 'Height' : 'Width')] = val;
        }
      }
    }
  },

  column: (0, _util.boolSetter)('flexDirection', 'column'),
  align: function align(style, val) {
    if (val) {
      var _val$split = val.split(' ');

      var _val$split2 = _slicedToArray(_val$split, 2);

      var justify = _val$split2[0];
      var alignItems = _val$split2[1];

      style.justifyContent = (0, _util.flexify)(justify);
      style.alignItems = (0, _util.flexify)(alignItems);
    }
  },
  wrap: (0, _util.boolSetter)('flexWrap', 'wrap'),

  // Shadow
  boxShadow: (0, _util.scaleSetter)('boxShadow', 'shadow')
};

/**
 * Base Component
 */

function render(_ref3) {
  var props = _ref3.props;
  var children = _ref3.children;

  var newProps = {};
  var style = {};

  computeProps(style, newProps, props);

  return (0, _element2.default)(
    _vduxCssEmulator2.default,
    newProps,
    children
  );
}

/**
 * computeProps
 *
 * Decide which props to forward, and process style properties
 */

function computeProps(style, newProps, props) {
  // Apply base styles
  if (props.baseStyle) (0, _extend2.default)(style, props.baseStyle);

  // Separate styles and props (attributes to be placed on the element)
  // and apply shorthand functions

  for (var key in props) {
    var val = props[key];

    if (fns[key]) {
      fns[key](style, val, props.$theme, props);
    } else if (eventRegex.test(key) || _htmlAttrs2.default[key]) {
      newProps[key] = val;
    } else if (val !== undefined && (typeof val === 'undefined' ? 'undefined' : _typeof(val)) !== 'object') {
      style[key] = val;
    }
  }

  // Post processing transformations

  if (props.highlight && style.backgroundColor) {
    style.backgroundColor = (0, _util.highlight)(style.backgroundColor);
  }

  if (props.style) (0, _extend2.default)(style, props.style);

  newProps.style = style;
  newProps.tag = props.tag;
}

/**
 * Exports
 */

exports.default = {
  getProps: getProps,
  render: render
};
},{"../util":229,"@f/extend":33,"@f/has":44,"@f/html-attrs":46,"vdux-css-emulator":198,"vdux/element":233}],204:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Block
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;

  return (0, _element2.default)(
    _Base2.default,
    _extends({ tag: 'div' }, props, { 'class': (0, _util.classes)(props.class, 'vui-block') }),
    children
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],205:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Flexbox cell component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;

  return (0, _element2.default)(
    _Base2.default,
    _extends({}, props, { 'class': (0, _util.classes)(props.class, 'vui-box') }),
    children
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],206:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _Tooltip = require('./Tooltip');

var _Tooltip2 = _interopRequireDefault(_Tooltip);

var _util = require('../util');

var _Block = require('./Block');

var _Block2 = _interopRequireDefault(_Block);

var _icon = require('./icon');

var _icon2 = _interopRequireDefault(_icon);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } /**
                                                                                                                                                                                                                              * Imports
                                                                                                                                                                                                                              */

/**
 * Button
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var text = props.text;
  var _props$bgColor = props.bgColor;
  var bgColor = _props$bgColor === undefined ? 'primary' : _props$bgColor;
  var icon = props.icon;
  var _props$ttUi = props.ttUi;
  var TtUi = _props$ttUi === undefined ? _Tooltip2.default : _props$ttUi;
  var tooltip = props.tooltip;
  var _props$ttPlacement = props.ttPlacement;
  var ttPlacement = _props$ttPlacement === undefined ? 'top' : _props$ttPlacement;
  var ttShown = props.ttShown;

  var restProps = _objectWithoutProperties(props, ['text', 'bgColor', 'icon', 'ttUi', 'tooltip', 'ttPlacement', 'ttShown']);

  if (icon) {
    text = (0, _element2.default)(_icon2.default, { fontSize: 'inherit', name: icon });
    bgColor = 'transparent';
  }

  var tt = tooltip && (0, _element2.default)(
    TtUi,
    { show: ttShown, placement: ttPlacement },
    tooltip
  );

  return (0, _element2.default)(
    _Block2.default,
    _extends({
      tag: 'button',
      type: 'button',
      color: 'white',
      relative: true,
      pointer: true,
      overflow: 'visible',
      textAlign: 'center',
      padding: icon ? 0 : null,
      m: 0,
      borderWidth: 0,
      userSelect: 'none',
      textDecoration: 'none'

    }, restProps, {

      bgColor: bgColor,
      'class': (0, _util.classes)(props.class, 'vui-button') }),
    text || children,
    tt
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Block":204,"./Tooltip":221,"./icon":224,"vdux/element":233}],207:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Card component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;

  return (0, _element2.default)(
    _Base2.default,
    _extends({
      color: 'text',
      bgColor: 'white',
      boxShadow: 'card'
    }, props, {
      'class': (0, _util.classes)(props.class, 'vui-card') }),
    children
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],208:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Divider component
 */

function render(_ref) {
  var props = _ref.props;

  return (0, _element2.default)(_Base2.default, _extends({
    borderTop: 'rgba(0, 0, 0, 0.2)',
    borderBottom: 'rgba(255, 255, 255, 0.2)'
  }, props, {
    'class': (0, _util.classes)(props.class, 'vui-deco-line') }));
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],209:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Divider component
 */

function render(_ref) {
  var props = _ref.props;

  return (0, _element2.default)(_Base2.default, _extends({
    tag: 'hr',
    bgColor: props.color || 'divider'
  }, props, {
    'class': (0, _util.classes)(props.class, 'vui-divider') }));
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],210:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Dropdown container component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;

  return (0, _element2.default)(
    _Base2.default,
    _extends({
      relative: true
    }, props, {
      'class': (0, _util.classes)(props.class, 'vui-dropdown') }),
    children
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],211:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _Document = require('vdux/Document');

var _Document2 = _interopRequireDefault(_Document);

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _noop = require('@f/noop');

var _noop2 = _interopRequireDefault(_noop);

var _menu = require('./menu');

var _menu2 = _interopRequireDefault(_menu);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } /**
                                                                                                                                                                                                                              * Imports
                                                                                                                                                                                                                              */

/**
 * Dropdown container component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var _props$onDismiss = props.onDismiss;
  var onDismiss = _props$onDismiss === undefined ? _noop2.default : _props$onDismiss;
  var left = props.left;
  var top = props.top;
  var open = props.open;

  var restProps = _objectWithoutProperties(props, ['onDismiss', 'left', 'top', 'open']);

  return (0, _element2.default)(
    _menu2.default,
    _extends({
      boxSizing: 'border-box',
      boxShadow: 'menu',
      absolute: {
        left: left ? 0 : 'auto',
        right: left ? 'auto' : 0,
        top: top ? 'auto' : '100%',
        bottom: top ? '100%' : 'auto'
      },
      hide: !open,
      bgColor: 'white',
      color: 'text',
      column: true
    }, restProps, {
      'class': (0, _util.classes)(props.class, 'vui-dropdown-menu') }),
    children,
    open && (0, _element2.default)(_Document2.default, { onClick: onDismiss, onKeypress: { esc: onDismiss } })
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./menu":225,"@f/noop":73,"vdux/Document":230,"vdux/element":233}],212:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Fixed position container
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;

  return (0, _element2.default)(
    _Base2.default,
    _extends({
      fixed: true
    }, props, {
      'class': (0, _util.classes)(props.class, 'vui-fixed') }),
    children
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],213:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Flex container component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;

  var cls = ['vui-flex', props.column ? 'vui-flex-column' : 'vui-flex-row'];

  if (props.class) {
    if (Array.isArray(props.class)) cls = cls.concat(props.class);else cls.push(props.class);
  }

  return (0, _element2.default)(
    _Base2.default,
    _extends({ display: 'flex' }, props, { 'class': cls }),
    children
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"./Base":203,"vdux/element":233}],214:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _reduce = require('@f/reduce');

var _reduce2 = _interopRequireDefault(_reduce);

var _flex = require('./flex');

var _flex2 = _interopRequireDefault(_flex);

var _map = require('@f/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } /**
                                                                                                                                                                                                                              * Imports
                                                                                                                                                                                                                              */

/**
 * Grid
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var _props$itemsPerRow = props.itemsPerRow;
  var itemsPerRow = _props$itemsPerRow === undefined ? 4 : _props$itemsPerRow;
  var columnAlign = props.columnAlign;
  var rowAlign = props.rowAlign;

  var restProps = _objectWithoutProperties(props, ['itemsPerRow', 'columnAlign', 'rowAlign']);

  var columns = toColumns(children, itemsPerRow);

  return (0, _element2.default)(
    _flex2.default,
    _extends({}, restProps, { align: rowAlign }),
    (0, _map2.default)(function (items) {
      return (0, _element2.default)(
        _flex2.default,
        { column: true, align: columnAlign },
        items
      );
    }, columns)
  );
}

/**
 * Helpers
 */

function toColumns(items, n) {
  return (0, _reduce2.default)(function (memo, item, i) {
    if (!memo[i % n]) memo.push([]);
    memo[i % n].push(item);
    return memo;
  }, [], items);
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"./flex":223,"@f/map":71,"@f/reduce":83,"vdux/element":233}],215:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _util = require('../util');

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _text = require('./text');

var _text2 = _interopRequireDefault(_text);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } /**
                                                                                                                                                                                                                              * Imports
                                                                                                                                                                                                                              */

/**
 * getProps
 */

function getProps(props, _ref) {
  var _ref$uiTheme = _ref.uiTheme;
  var uiTheme = _ref$uiTheme === undefined ? {} : _ref$uiTheme;

  props.$theme = (0, _util.mergeTheme)(uiTheme);
  return props;
}

/**
 * Icon
 */

function render(_ref2) {
  var props = _ref2.props;
  var $theme = props.$theme;
  var name = props.name;
  var _props$iconTag = props.iconTag;
  var iconTag = _props$iconTag === undefined ? $theme.iconTag : _props$iconTag;
  var _props$iconClass = props.iconClass;
  var iconClass = _props$iconClass === undefined ? $theme.iconClass : _props$iconClass;

  var restProps = _objectWithoutProperties(props, ['$theme', 'name', 'iconTag', 'iconClass']);

  var cls = [iconClass, 'vui-icon'];
  if (props.class) {
    if (Array.isArray(props.class)) cls = cls.concat(props.class);else cls.push(props.class);
  }

  return (0, _element2.default)(
    _text2.default,
    _extends({ tag: iconTag }, restProps, { 'class': cls }),
    props.name
  );
}

/**
 * Exports
 */

exports.default = {
  getProps: getProps,
  render: render
};
},{"../util":229,"./text":226,"vdux/element":233}],216:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Button = require('./Button');

var _Button2 = _interopRequireDefault(_Button);

var _Block = require('./Block');

var _Block2 = _interopRequireDefault(_Block);

var _Icon = require('./Icon');

var _Icon2 = _interopRequireDefault(_Icon);

var _Flex = require('./Flex');

var _Flex2 = _interopRequireDefault(_Flex);

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

var _Text = require('./Text');

var _Text2 = _interopRequireDefault(_Text);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } /**
                                                                                                                                                                                                                              * Imports
                                                                                                                                                                                                                              */

/**
 * IconButton component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var _props$divider = props.divider;
  var divider = _props$divider === undefined ? true : _props$divider;
  var img = props.img;
  var icon = props.icon;
  var _props$iconSize = props.iconSize;
  var iconSize = _props$iconSize === undefined ? '25px' : _props$iconSize;
  var _props$h = props.h;
  var h = _props$h === undefined ? '43px' : _props$h;

  var btnProps = _objectWithoutProperties(props, ['divider', 'img', 'icon', 'iconSize', 'h']);

  var pic = img ? (0, _element2.default)(_Base2.default, { tag: 'img', sq: iconSize, mr: '6px', src: img }) : (0, _element2.default)(_Icon2.default, { name: icon, sq: iconSize, mr: '6px' });

  return (0, _element2.default)(
    _Button2.default,
    _extends({ 'class': (0, _util.classes)(props.class, 'vui-icon-button'), rounded: true, h: h, px: '5px' }, btnProps),
    (0, _element2.default)(
      _Flex2.default,
      { align: 'start center', tall: true },
      pic,
      divider === true ? (0, _element2.default)(_Block2.default, { h: '100%', borderLeft: 'rgba(52, 52, 52, 0.08)' }) : divider,
      (0, _element2.default)(
        _Text2.default,
        { mx: 'auto' },
        children
      )
    )
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"./Block":204,"./Button":206,"./Flex":213,"./Icon":215,"./Text":220,"vdux/element":233}],217:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _inputAttrs = require('@f/input-attrs');

var _inputAttrs2 = _interopRequireDefault(_inputAttrs);

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Tooltip = require('./Tooltip');

var _Tooltip2 = _interopRequireDefault(_Tooltip);

var _block = require('./block');

var _block2 = _interopRequireDefault(_block);

var _pick = require('@f/pick');

var _pick2 = _interopRequireDefault(_pick);

var _omit = require('@f/omit');

var _omit2 = _interopRequireDefault(_omit);

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

var _text = require('./text');

var _text2 = _interopRequireDefault(_text);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

var inputPropNames = ['invalid', 'label', 'type', 'name', 'rounded', 'bgColor', 'labelStyle', 'border', 'inputProps', 'onInvalid'].concat(_inputAttrs2.default);
var filterProps = (0, _omit2.default)(inputPropNames);

/**
 * Input component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var message = props.message;
  var name = props.name;
  var label = props.label;
  var labelClass = props.labelClass;
  var _props$labelProps = props.labelProps;
  var labelProps = _props$labelProps === undefined ? {} : _props$labelProps;
  var inputClass = props.inputClass;
  var _props$inputProps = props.inputProps;
  var inputProps = _props$inputProps === undefined ? {} : _props$inputProps;
  var invalid = props.invalid;
  var border = props.border;
  var _props$errorPlacement = props.errorPlacement;
  var errorPlacement = _props$errorPlacement === undefined ? 'left' : _props$errorPlacement;

  var filteredProps = filterProps(props);
  var restInputAttrs = (0, _pick2.default)(inputPropNames, props);

  return (0, _element2.default)(
    _block2.default,
    _extends({
      mb: 's',
      relative: true,
      overflow: 'visible',
      color: invalid ? 'error' : null
    }, filteredProps, {
      'class': (0, _util.classes)(props.class, 'vui-input-container') }),
    (0, _element2.default)(
      _Base2.default,
      _extends({ tag: 'label', 'for': name, 'class': (0, _util.classes)(labelClass, 'vui-label') }, labelProps),
      label || children
    ),
    (0, _element2.default)(_Base2.default, _extends({
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      display: 'block',
      wide: true,
      m: 0,
      color: 'inherit',
      fs: 'inherit',
      tag: 'input',
      type: 'text',
      border: border && (invalid ? 'error' : 'border')
    }, restInputAttrs, inputProps, {
      'class': (0, _util.classes)(inputClass, 'vui-input') })),
    message && (0, _element2.default)(
      _Tooltip2.default,
      { fs: 'xxs', p: '0px 20px', lh: '30px', placement: errorPlacement, show: invalid, bgColor: 'error' },
      message
    )
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"./Tooltip":221,"./block":222,"./text":226,"@f/input-attrs":50,"@f/omit":76,"@f/pick":77,"vdux/element":233}],218:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _util = require('../util');

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _block = require('./block');

var _block2 = _interopRequireDefault(_block);

var _omit = require('@f/omit');

var _omit2 = _interopRequireDefault(_omit);

var _flex = require('./flex');

var _flex2 = _interopRequireDefault(_flex);

var _map = require('@f/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

var getProps = (0, _util.getThemeProps)(['scale']);
var filterProps = (0, _omit2.default)(['spacing', 'itemStyle', 'itemProps', 'class']);

/**
 * Menu component
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var itemStyle = props.itemStyle;
  var _props$itemProps = props.itemProps;
  var itemProps = _props$itemProps === undefined ? {} : _props$itemProps;
  var $theme = props.$theme;


  return (0, _element2.default)(
    _flex2.default,
    _extends({}, filterProps(props), { 'class': [props.class, 'vui-menu'] }),
    (0, _map2.default)(function (child) {
      return (0, _element2.default)(
        _block2.default,
        _extends({}, itemProps, { baseStyle: getBaseItemStyle(props, $theme), style: itemStyle }),
        child
      );
    }, children)
  );
}

/**
 * Child item styles
 */

function getBaseItemStyle(_ref2, _ref3) {
  var spacing = _ref2.spacing;
  var column = _ref2.column;
  var _ref3$scale = _ref3.scale;
  var scale = _ref3$scale === undefined ? [] : _ref3$scale;

  var margin = scale[spacing] ? scale[spacing] : spacing;

  return column ? { marginBottom: margin } : { marginRight: margin };
}

/**
 * Exports
 */

exports.default = {
  render: render,
  getProps: getProps
};
},{"../util":229,"./block":222,"./flex":223,"@f/map":71,"@f/omit":76,"vdux/element":233}],219:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Block = require('./Block');

var _Block2 = _interopRequireDefault(_Block);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * getProps
 */

function getProps(props) {
  if (!props.color) props.color = 'text';
  if (!props.bgColor) props.bgColor = 'white';

  return props;
}

/**
 * MenuItem
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;

  return (0, _element2.default)(
    _Block2.default,
    _extends({
      px: 'm',
      py: 's',
      pointer: true,
      m: 0,
      textDecoration: 'none'
    }, props, {
      'class': (0, _util.classes)(props.class, 'vui-menu-item') }),
    props.text || children
  );
}

/**
 * Exports
 */

exports.default = {
  getProps: getProps,
  render: render
};
},{"../util":229,"./Block":204,"vdux/element":233}],220:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                                   */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Base = require('./Base');

var _Base2 = _interopRequireDefault(_Base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Text
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;

  return (0, _element2.default)(
    _Base2.default,
    _extends({
      tag: 'span'
    }, props, {
      'class': (0, _util.classes)(props.class, 'vui-text') }),
    children
  );
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Base":203,"vdux/element":233}],221:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _vduxPosition = require('vdux-position');

var _vduxPosition2 = _interopRequireDefault(_vduxPosition);

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _util = require('../util');

var _Block = require('./Block');

var _Block2 = _interopRequireDefault(_Block);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } /**
                                                                                                                                                                                                                              * Imports
                                                                                                                                                                                                                              */

/**
 * Constants
 */

var width = '6px';

/**
 * Tooltip
 */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var _props$placement = props.placement;
  var placement = _props$placement === undefined ? 'top' : _props$placement;
  var _props$space = props.space;
  var space = _props$space === undefined ? 0 : _props$space;
  var _props$color = props.color;
  var color = _props$color === undefined ? 'white' : _props$color;
  var show = props.show;
  var _props$bgColor = props.bgColor;
  var bgColor = _props$bgColor === undefined ? 'black' : _props$bgColor;

  var restProps = _objectWithoutProperties(props, ['placement', 'space', 'color', 'show', 'bgColor']);

  var margin = {};

  if (placement === 'top') margin.mt = '-3px';else if (placement === 'bottom') margin.mb = '-3px';else if (placement === 'right') margin.mr = '-3px';else if (placement === 'left') margin.ml = '-3px';

  return (0, _element2.default)(
    _vduxPosition2.default,
    { placement: placement, space: space, disable: !show },
    (0, _element2.default)(
      _Block2.default,
      _extends({
        absolute: true,
        userSelect: 'none'
      }, margin, {
        py: width,
        top: '-10000px',
        opacity: show ? 1 : 0,
        transition: 'opacity .15s linear',
        whiteSpace: 'nowrap',
        z: 'tooltip',
        'class': (0, _util.classes)(props.class, 'vui-tooltip') }),
      (0, _element2.default)(_Block2.default, _extends({
        absolute: true,
        sq: 0,
        borderColor: 'transparent',
        borderStyle: 'solid'
      }, getArrowStyle(placement, bgColor), {
        'class': 'vui-tooltip-arrow' })),
      (0, _element2.default)(
        _Block2.default,
        _extends({ 'class': 'vui-tooltip-inner', fs: 'xxs', py: 6, px: 9, rounded: true, bgColor: bgColor, color: 'white' }, restProps),
        children
      )
    )
  );
}

/**
 * Compute base styles
 */

function getArrowStyle(placement, color) {
  switch (placement) {
    case 'top':
      return {
        bottom: 0,
        left: '50%',
        marginLeft: '-' + width,
        borderWidth: width + ' ' + width + ' 0',
        borderTopColor: color,
        marginTop: '-3px'
      };
    case 'bottom':
      return {
        top: 0,
        left: '50%',
        marginLeft: '-' + width,
        borderWidth: '0 ' + width + ' ' + width,
        borderBottomColor: color
      };
    case 'right':
      return {
        top: '50%',
        right: '100%',
        marginTop: '-' + width,
        borderWidth: width + ' ' + width + ' ' + width + ' 0',
        borderRightColor: color
      };
    case 'left':
      return {
        top: '50%',
        left: '100%',
        marginTop: '-' + width,
        borderWidth: width + ' 0 ' + width + ' ' + width,
        borderLeftColor: color
      };
    default:
      throw new Error('Unknown tooltip placement: "' + placement + '"');
  }
}

/**
 * Exports
 */

exports.default = {
  render: render
};
},{"../util":229,"./Block":204,"vdux-position":201,"vdux/element":233}],222:[function(require,module,exports){
arguments[4][204][0].apply(exports,arguments)
},{"../util":229,"./Base":203,"dup":204,"vdux/element":233}],223:[function(require,module,exports){
arguments[4][213][0].apply(exports,arguments)
},{"./Base":203,"dup":213,"vdux/element":233}],224:[function(require,module,exports){
arguments[4][215][0].apply(exports,arguments)
},{"../util":229,"./text":226,"dup":215,"vdux/element":233}],225:[function(require,module,exports){
arguments[4][218][0].apply(exports,arguments)
},{"../util":229,"./block":222,"./flex":223,"@f/map":71,"@f/omit":76,"dup":218,"vdux/element":233}],226:[function(require,module,exports){
arguments[4][220][0].apply(exports,arguments)
},{"../util":229,"./Base":203,"dup":220,"vdux/element":233}],227:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/**
 * Default theme for <Base/> component and those that depend on it
 */

var baseColors = {
  black: '#111',
  white: '#fff',
  gray: '#ddd',
  midgray: '#888',
  blue: '#08e',
  red: '#f52',
  orange: '#f70',
  green: '#1c7'
};

exports.default = {
  circularAvatars: true,

  colors: _extends({}, baseColors, {
    primary: baseColors.blue,
    secondary: baseColors.midgray,
    default: baseColors.black,
    info: baseColors.blue,
    success: baseColors.green,
    warning: baseColors.orange,
    error: baseColors.red,
    divider: baseColors.black,
    text: baseColors.black
  }),

  iconTag: 'md-icon',
  iconClass: 'material-icons',

  borderRadius: 2,

  shadow: {
    card: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    menu: '0 0 20px 0 rgba(52, 52, 52, 0.2)'
  },

  scale: {
    z: 0,
    xs: 4,
    s: 8,
    m: 16,
    l: 32,
    xl: 64
  },

  fontScale: {
    xxl: 48,
    xl: 32,
    l: 24,
    m: 20,
    s: 16,
    xs: 14,
    xxs: 12
  },

  lineHeightScale: {
    xxl: '1.2em',
    xl: '1.2em',
    l: '1.2em',
    s: '1.4em',
    xs: '1.2em',
    xxs: '1.2em'
  },

  zIndexScale: {
    tooltip: 99999
  }
};
},{}],228:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultTheme = exports.Tooltip = exports.Divider = exports.DecoLine = exports.DropdownMenu = exports.Dropdown = exports.IconButton = exports.Button = exports.MenuItem = exports.Menu = exports.Icon = exports.Fixed = exports.Text = exports.Input = exports.Grid = exports.Flex = exports.Card = exports.Box = exports.Block = exports.Base = exports.Avatar = undefined;

var _DropdownMenu = require('./components/DropdownMenu');

var _DropdownMenu2 = _interopRequireDefault(_DropdownMenu);

var _IconButton = require('./components/IconButton');

var _IconButton2 = _interopRequireDefault(_IconButton);

var _Dropdown = require('./components/Dropdown');

var _Dropdown2 = _interopRequireDefault(_Dropdown);

var _MenuItem = require('./components/MenuItem');

var _MenuItem2 = _interopRequireDefault(_MenuItem);

var _DecoLine = require('./components/DecoLine');

var _DecoLine2 = _interopRequireDefault(_DecoLine);

var _Divider = require('./components/Divider');

var _Divider2 = _interopRequireDefault(_Divider);

var _Tooltip = require('./components/Tooltip');

var _Tooltip2 = _interopRequireDefault(_Tooltip);

var _defaultTheme = require('./default-theme');

var _defaultTheme2 = _interopRequireDefault(_defaultTheme);

var _Button = require('./components/Button');

var _Button2 = _interopRequireDefault(_Button);

var _Avatar = require('./components/Avatar');

var _Avatar2 = _interopRequireDefault(_Avatar);

var _Fixed = require('./components/Fixed');

var _Fixed2 = _interopRequireDefault(_Fixed);

var _Block = require('./components/Block');

var _Block2 = _interopRequireDefault(_Block);

var _Input = require('./components/Input');

var _Input2 = _interopRequireDefault(_Input);

var _Base = require('./components/Base');

var _Base2 = _interopRequireDefault(_Base);

var _Grid = require('./components/Grid');

var _Grid2 = _interopRequireDefault(_Grid);

var _Card = require('./components/Card');

var _Card2 = _interopRequireDefault(_Card);

var _Text = require('./components/Text');

var _Text2 = _interopRequireDefault(_Text);

var _Flex = require('./components/Flex');

var _Flex2 = _interopRequireDefault(_Flex);

var _Icon = require('./components/Icon');

var _Icon2 = _interopRequireDefault(_Icon);

var _Menu = require('./components/Menu');

var _Menu2 = _interopRequireDefault(_Menu);

var _Box = require('./components/Box');

var _Box2 = _interopRequireDefault(_Box);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Exports
 */

exports.
// Components
Avatar = _Avatar2.default;
exports.Base = _Base2.default;
exports.Block = _Block2.default;
exports.Box = _Box2.default;
exports.Card = _Card2.default;
exports.Flex = _Flex2.default;
exports.Grid = _Grid2.default;
exports.Input = _Input2.default;
exports.Text = _Text2.default;
exports.Fixed = _Fixed2.default;
exports.Icon = _Icon2.default;
exports.Menu = _Menu2.default;
exports.MenuItem = _MenuItem2.default;
exports.Button = _Button2.default;
exports.IconButton = _IconButton2.default;
exports.Dropdown = _Dropdown2.default;
exports.DropdownMenu = _DropdownMenu2.default;
exports.DecoLine = _DecoLine2.default;
exports.Divider = _Divider2.default;
exports.Tooltip = _Tooltip2.default;
exports.

// Default theme
defaultTheme = _defaultTheme2.default; /**
                                        * Imports
                                        */
},{"./components/Avatar":202,"./components/Base":203,"./components/Block":204,"./components/Box":205,"./components/Button":206,"./components/Card":207,"./components/DecoLine":208,"./components/Divider":209,"./components/Dropdown":210,"./components/DropdownMenu":211,"./components/Fixed":212,"./components/Flex":213,"./components/Grid":214,"./components/Icon":215,"./components/IconButton":216,"./components/Input":217,"./components/Menu":218,"./components/MenuItem":219,"./components/Text":220,"./components/Tooltip":221,"./default-theme":227}],229:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.classes = exports.mergeTheme = exports.getThemeProps = exports.highlight = exports.flexify = exports.setScaled = exports.borderSetter = exports.boolSetter = exports.positionSetter = exports.scaleSetter = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; }; /**
                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                   */

var _defaultTheme = require('./default-theme');

var _defaultTheme2 = _interopRequireDefault(_defaultTheme);

var _extend = require('@f/extend');

var _extend2 = _interopRequireDefault(_extend);

var _pick = require('@f/pick');

var _pick2 = _interopRequireDefault(_pick);

var _color = require('color');

var _color2 = _interopRequireDefault(_color);

var _has = require('@f/has');

var _has2 = _interopRequireDefault(_has);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * scaleSetter
 *
 * Set a style property from a given theme scale
 */

function scaleSetter(styleKey) {
  var themeScaleKey = arguments.length <= 1 || arguments[1] === undefined ? 'scale' : arguments[1];

  if (Array.isArray(styleKey)) {
    return function (style, val, theme) {
      var scale = theme[themeScaleKey];

      for (var i = 0; i < styleKey.length; ++i) {
        setScaled(style, styleKey[i], val, theme[themeScaleKey]);
      }
    };
  } else {
    return function (style, val, theme) {
      return setScaled(style, styleKey, val, theme[themeScaleKey]);
    };
  }
}

/**
 * boolSetter
 *
 * Set a constant value if the property is true,
 * do nothing otherwise.
 */

function boolSetter(styleKey, value) {
  return function (style, val) {
    return val && (style[styleKey] = value);
  };
}

/**
 * borderSetter
 *
 * Set a 1px solid border. If you pass a string, that string
 * is used as a color (indexed into your theme colors).
 */

function borderSetter(borderKey) {
  var colorKey = borderKey + 'Color';
  var styleKey = borderKey + 'Style';
  var widthKey = borderKey + 'Width';

  return function (style, val, _ref, _ref2) {
    var colors = _ref.colors;
    var _ref2$borderWidth = _ref2.borderWidth;
    var borderWidth = _ref2$borderWidth === undefined ? '1px' : _ref2$borderWidth;

    if (val) {
      if (typeof val === 'string') {
        // If the string being set has spaces in it,
        // assume it's a shorthand for specifying all
        // the properties, rather than a named color
        if (/\s/.test(val)) {
          style[borderKey] = val;
          return;
        } else {
          setScaled(style, colorKey, val, colors);
        }
      }

      style[styleKey] = 'solid';
      style[widthKey] = borderWidth;
    }
  };
}

/**
 *  position(obj, str)
 *
 * Set position on a style object
 *
 *  * obj - Object. Obj to set style on
 *  * props - Object with keys absolute|relative|fixed set to position strings of
 *            the form `bottom right` or `bottom 10px right 5px`.
 *            i.e. `(top|bottom) (n)? (left|right) (n)?`
 *  * scale - The scale from which to select sizes
 */

var posRe = /^(top|bottom)(?:\s(\d+[a-zA-Z]+))?\s(left|right)(?:\s(\d+[a-zA-Z]+))?$/;

function positionSetter(styleKey) {
  return function (style, val, _ref3) {
    var scale = _ref3.scale;

    style.position = styleKey;

    if (typeof val === 'string') {
      var parts = posRe.exec(val);

      setScaled(style, parts[1], parts[2] || 0, scale);
      setScaled(style, parts[3], parts[4] || 0, scale);
    } else if ((typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'object') {
      setScaled(style, 'top', val.top, scale);
      setScaled(style, 'left', val.left, scale);
      setScaled(style, 'right', val.right, scale);
      setScaled(style, 'bottom', val.bottom, scale);
    }
  };
}

/**
 * setScaled
 *
 * Set a value from a scale if the scale has
 * a corresponding key for that value
 */

function setScaled(obj, key, val, scale) {
  if (typeof val !== 'undefined') {
    obj[key] = scale && (0, _has2.default)(val, scale) ? scale[val] : val;
  }
}

/**
 * posString
 *
 * Generate a position string
 * given a position and a number
 */

function posString(pos, n) {
  switch (pos) {
    case 'top':
      return n + 'px 0 0 0';
    case 'right':
      return '0 ' + n + 'px 0 0';
    case 'bottom':
      return '0 0 ' + n + 'px 0';
    case 'left':
      return '0 0 0 ' + n + 'px';
  }
}

/**
 * highlight
 *
 * Takes in a color and if that color is dark, lightens it
 * and if it is light, darkens it. This allows you to make
 * nice rollover effects where an element appears to
 * highlight when the mouse is over it.
 */

function highlight(color) {
  var amount = arguments.length <= 1 || arguments[1] === undefined ? 0.1 : arguments[1];

  if (color === 'transparent') return color;

  var clr = (0, _color2.default)(color);

  return clr.light() ? clr.darken(amount).rgbaString() : clr.lighten(amount).rgbaString();
}

function getThemeProps(themeProps) {
  return function (props) {
    var context = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    var _context$uiTheme = context.uiTheme;
    var uiTheme = _context$uiTheme === undefined ? {} : _context$uiTheme;

    props.$theme = (0, _pick2.default)(themeProps, uiTheme, _defaultTheme2.default);
    return props;
  };
}

/**
 * mergeTheme(ctxTheme)
 *
 * Merge the contextual theme with the default theme. Memoize this
 * so that we allocate/extend every time we render any components,
 * especially since the contextual theme should change only extremely
 * rarely, if ever.
 */

var lastCtxTheme = null;
var lastMergedTheme = null;

function mergeTheme(ctxTheme) {
  if (lastCtxTheme === ctxTheme && lastMergedTheme) return lastMergedTheme;
  lastCtxTheme = ctxTheme;
  lastMergedTheme = (0, _extend2.default)({}, _defaultTheme2.default, ctxTheme);
  return lastMergedTheme;
}

/**
 * classes
 *
 * Takes two class arguments and if both are truthy,
 * returns an array of both, otherwise just returns
 * the truthy one
 */

function classes(a, b) {
  return a && b ? Array.isArray(a) ? a.concat(b) : [a, b] : a ? a : b;
}

/**
 * flexify
 *
 * Just adds 'flex-' to 'start' or 'end' so we can use
 * a nicer syntax with our elements
 */

function flexify(str) {
  return str === 'start' || str === 'end' ? 'flex-' + str : str;
}

/**
 * Exports
 */

exports.scaleSetter = scaleSetter;
exports.positionSetter = positionSetter;
exports.boolSetter = boolSetter;
exports.borderSetter = borderSetter;
exports.setScaled = setScaled;
exports.flexify = flexify;
exports.highlight = highlight;
exports.getThemeProps = getThemeProps;
exports.mergeTheme = mergeTheme;
exports.classes = classes;
},{"./default-theme":227,"@f/extend":33,"@f/has":44,"@f/pick":77,"color":112}],230:[function(require,module,exports){
/**
 * Document component
 */

module.exports = require('./lib/global-listener').default(typeof document === 'undefined' ? {} : document)

},{"./lib/global-listener":235}],231:[function(require,module,exports){
/**
 * Body component
 */

module.exports = require('./lib/global-listener').default(function () {
  return document.body
})

},{"./lib/global-listener":235}],232:[function(require,module,exports){
/**
 * Convenience so that you can do
 * require('vdux/dom')
 */

module.exports = require('./lib/dom')

},{"./lib/dom":234}],233:[function(require,module,exports){
/**
 * Convenience for accessing element, so you can
 * require('vdux/element')
 */

exports = module.exports = require('virtex-element')

},{"virtex-element":242}],234:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _applyMiddleware = require('redux/lib/applyMiddleware');

var _applyMiddleware2 = _interopRequireDefault(_applyMiddleware);

var _delegant = require('delegant');

var _delegant2 = _interopRequireDefault(_delegant);

var _createStore = require('redux/lib/createStore');

var _createStore2 = _interopRequireDefault(_createStore);

var _virtexDom = require('virtex-dom');

var _virtexDom2 = _interopRequireDefault(_virtexDom);

var _isDomLoaded = require('@f/is-dom-loaded');

var _isDomLoaded2 = _interopRequireDefault(_isDomLoaded);

var _virtexLocal = require('virtex-local');

var _virtexLocal2 = _interopRequireDefault(_virtexLocal);

var _virtexComponent = require('virtex-component');

var _virtexComponent2 = _interopRequireDefault(_virtexComponent);

var _emptyElement = require('@f/empty-element');

var _emptyElement2 = _interopRequireDefault(_emptyElement);

var _isObject = require('@f/is-object');

var _isObject2 = _interopRequireDefault(_isObject);

var _queue = require('@f/queue');

var _queue2 = _interopRequireDefault(_queue);

var _debounce = require('@f/debounce');

var _debounce2 = _interopRequireDefault(_debounce);

var _foreach = require('@f/foreach');

var _foreach2 = _interopRequireDefault(_foreach);

var _reduxMulti = require('redux-multi');

var _reduxMulti2 = _interopRequireDefault(_reduxMulti);

var _reduxFalsy = require('redux-falsy');

var _reduxFalsy2 = _interopRequireDefault(_reduxFalsy);

var _reduxThunk = require('redux-thunk');

var _reduxThunk2 = _interopRequireDefault(_reduxThunk);

var _equal = require('@f/equal');

var _equal2 = _interopRequireDefault(_equal);

var _virtex2 = require('virtex');

var _virtex3 = _interopRequireDefault(_virtex2);

var _map = require('@f/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * Imports
                                                                                                                                                                                                     */

/**
 * vdux
 */

function vdux() {
  var opts = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var _opts$middleware = opts.middleware;
  var middleware = _opts$middleware === undefined ? [] : _opts$middleware;
  var _opts$reducer = opts.reducer;
  var reducer = _opts$reducer === undefined ? function (state) {
    return state;
  } : _opts$reducer;
  var _opts$initialState = opts.initialState;
  var initialState = _opts$initialState === undefined ? {} : _opts$initialState;
  var node = opts.node;
  var prerendered = opts.prerendered;

  /**
   * Create redux store
   */

  var prevTree = undefined;
  var context = {};
  var forceUpdate = false;
  var rendering = false;
  var delegated = false;
  var dirty = {};
  var components = {};
  var postRenderQueue = (0, _queue2.default)();
  var store = _applyMiddleware2.default.apply(undefined, [_reduxFalsy2.default, _reduxMulti2.default, _virtexDom2.default, (0, _virtexLocal2.default)('ui', dirty), (0, _virtexComponent2.default)({
    components: components,
    postRender: postRenderQueue.add,
    getContext: function getContext() {
      return context;
    },
    ignoreShouldUpdate: function ignoreShouldUpdate() {
      return forceUpdate;
    }
  }), _reduxThunk2.default].concat(_toConsumableArray(middleware)))(_createStore2.default)((0, _virtexLocal.mount)('ui', reducer), initialState);

  /**
   * Initialize virtex
   */

  var _virtex = (0, _virtex3.default)(store.dispatch);

  var create = _virtex.create;
  var update = _virtex.update;
  var updatePaths = _virtex.updatePaths;

  return {
    replaceReducer: function replaceReducer(_reducer) {
      reducer = _reducer;
      store.replaceReducer((0, _virtexLocal.mount)('ui', reducer));
    },
    dispatch: function dispatch(action) {
      store.dispatch(action);
    },
    getState: function getState() {
      return store.getState();
    },
    subscribe: function subscribe(fn) {
      if (!(0, _isDomLoaded2.default)()) {
        throw new Error('vdux: Please wait until the document (i.e. DOMContentLoaded) is ready before calling subscribe');
      }

      var debouncedFn = (0, _debounce2.default)(function () {
        rendering ? debouncedFn() : fn(store.getState());
      });

      /**
       * Create the Virtual DOM <-> Redux cycle
       */

      var stop = [];
      stop.push(store.subscribe(debouncedFn));

      if (!delegated) {
        stop.push((0, _delegant2.default)(document, store.dispatch));
        stop.push((0, _delegant.delegateGlobal)(window, store.dispatch));
        delegated = true;
      }

      /**
       * Initial render
       */

      debouncedFn();
      return function () {
        return stop.forEach(function (fn) {
          return fn();
        });
      };
    },
    render: function render(tree) {
      var _context = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var force = arguments[2];

      // If there is a context update, we need
      // to do a forced full re-render
      if (!(0, _equal2.default)(context, _context)) {
        context = _context;
        force = true;
      }

      forceUpdate = force;
      rendering = true;

      prevTree ? updateDom(prevTree, tree) : createDom(tree);

      prevTree = tree;
      forceUpdate = false;

      // Run any pending afterRender lifecycle hooks
      var nextTicks = postRenderQueue.flush();

      // Give afterRender hooks a guaranteed way to execute some code
      // on the next tick but before the next render
      setTimeout(function () {
        (0, _foreach2.default)(function run(fn) {
          if ('function' === typeof fn) fn();
          if (Array.isArray(fn)) (0, _foreach2.default)(run, fn);
        }, nextTicks);

        rendering = false;
      });

      return node.firstChild;
    }
  };

  /**
   * Sync the virtual dom and the actual dom
   */

  function createDom(tree) {
    node = node || document.body;

    if (!prerendered) {
      (0, _emptyElement2.default)(node);
      node.appendChild(create(tree).element);
    } else {
      create(tree, 'a', node.firstChild);
    }

    return node.firstChild;
  }

  function updateDom(oldTree, newTree) {
    update(oldTree, newTree);
    updateDirty();
    return node.firstChild;
  }

  function updateDirty() {
    (0, _foreach2.default)(function (path) {
      // Check that it's still dirty, since the re-rendering of a higher component
      // may cause one of the lower ones to get re-rendered
      if (dirty[path]) {
        var _component = components[path];

        if (_component) {
          var prev = _extends({}, _component);

          // Clear cached vnodes/elements
          _component.vnode = null;
          update(prev, _component, path);
        }
      }

      // Sort by shortest dirty paths first, so that if possible
      // we get some of the higher re-renders cleaning up some
      // of the lower ones
    }, Object.keys(dirty).sort(function (a, b) {
      return a.length - b.length;
    }));
  }
}

/**
 * Exports
 */

exports.default = vdux;
},{"@f/debounce":23,"@f/empty-element":28,"@f/equal":31,"@f/foreach":37,"@f/is-dom-loaded":53,"@f/is-object":60,"@f/map":71,"@f/queue":80,"delegant":118,"redux-falsy":171,"redux-multi":173,"redux-thunk":174,"redux/lib/applyMiddleware":175,"redux/lib/createStore":177,"virtex":247,"virtex-component":236,"virtex-dom":238,"virtex-local":243}],235:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _eventHandler = require('@f/event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _virtexElement = require('virtex-element');

var _virtexElement2 = _interopRequireDefault(_virtexElement);

var _foreach = require('@f/foreach');

var _foreach2 = _interopRequireDefault(_foreach);

var _evStore = require('ev-store');

var _evStore2 = _interopRequireDefault(_evStore);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Create a global listener component
 */

/**
 * Imports
 */

function globalListener() {
  var node = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var store = undefined;

  /**
   * onCreate
   */

  function onCreate(_ref) {
    var path = _ref.path;
    var props = _ref.props;

    // Allow node to be passed in as a function so that we can late-bind it, for
    // things like document.body, which are only created after the DOM is ready
    store = store || (0, _evStore2.default)('function' === typeof node ? node() : node);
    listen(path, props);
  }

  /**
   * Special window component
   */

  function render(_ref2) {
    var props = _ref2.props;
    var children = _ref2.children;
    var path = _ref2.path;

    if (children.length > 1) {
      throw new Error('Window component may have only 1 child');
    }

    return children[0] || (0, _virtexElement2.default)('span', { 'class': 'global-listener' });
  }

  /**
   * onUpdate - Clear and reset the handlers
   */

  function onUpdate(prev, next) {
    clear(prev.path);
    listen(next.path, next.props);
  }

  /**
   * onRemove - Clear all the handlers
   */

  function onRemove(_ref3) {
    var path = _ref3.path;

    clear(path);
  }

  /**
   * Helpers
   */

  function clear(path) {
    (0, _foreach2.default)(function (name) {
      delete store[name][path];
    }, store[path]);
    delete store[path];
  }

  function listen(path, props) {
    store[path] = [];
    (0, _foreach2.default)(function (fn, key) {
      var name = key.slice(2).toLowerCase(); // onResize -> resize
      store[path].push(name);
      store[name] = store[name] || {};
      store[name][path] = (0, _eventHandler2.default)(fn);
    }, props);
  }

  return {
    onCreate: onCreate,
    render: render,
    onUpdate: onUpdate,
    onRemove: onRemove
  };
}

/**
 * Exports
 */

exports.default = globalListener;
},{"@f/event-handler":32,"@f/foreach":37,"ev-store":138,"virtex-element":242}],236:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _defaults = require('@f/defaults');

var _defaults2 = _interopRequireDefault(_defaults);

var _identity = require('@f/identity');

var _identity2 = _interopRequireDefault(_identity);

var _equalArray = require('@f/equal-array');

var _equalArray2 = _interopRequireDefault(_equalArray);

var _equalObj = require('@f/equal-obj');

var _equalObj2 = _interopRequireDefault(_equalObj);

var _virtex = require('virtex');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

var _actions$types = _virtex.actions.types; /**
                                             * Imports
                                             */

var CREATE_THUNK = _actions$types.CREATE_THUNK;
var UPDATE_THUNK = _actions$types.UPDATE_THUNK;
var DESTROY_THUNK = _actions$types.DESTROY_THUNK;

/**
 * virtex-component
 */

function middleware() {
  var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var _config$components = config.components;
  var components = _config$components === undefined ? {} : _config$components;
  var _config$postRender = config.postRender;
  var postRender = _config$postRender === undefined ? function () {} : _config$postRender;
  var _config$ignoreShouldU = config.ignoreShouldUpdate;
  var ignoreShouldUpdate = _config$ignoreShouldU === undefined ? function () {
    return false;
  } : _config$ignoreShouldU;
  var _config$getContext = config.getContext;
  var getContext = _config$getContext === undefined ? function () {
    return {};
  } : _config$getContext;


  return function (_ref) {
    var dispatch = _ref.dispatch;

    var maybeDispatch = function maybeDispatch(action) {
      return action && dispatch(action);
    };

    return function (next) {
      return function (action) {
        switch (action.type) {
          case CREATE_THUNK:
            components[action.vnode.path] = action.vnode;
            return create(action.vnode);
          case UPDATE_THUNK:
            if (action.prev) {
              components[action.vnode.path] = action.vnode;
            }
            return update(action.vnode, action.prev);
          case DESTROY_THUNK:
            delete components[action.vnode.path];
            return destroy(action.vnode);
          default:
            return next(action);
        }
      };
    };

    function create(thunk) {
      var component = thunk.type;
      var onCreate = component.onCreate;
      var afterRender = component.afterRender;
      var _component$getProps = component.getProps;
      var getProps = _component$getProps === undefined ? _identity2.default : _component$getProps;


      thunk.props = getProps(thunk.props || {}, getContext());

      // Call the onCreate hook
      if (onCreate) maybeDispatch(onCreate(thunk));
      if (afterRender) postRender(function () {
        return maybeDispatch(afterRender(thunk, (0, _virtex.findDOMNode)(thunk)));
      });

      return thunk.vnode = render(component, thunk);
    }

    function update(thunk, prev) {
      if (thunk.vnode) return thunk.vnode;

      var component = thunk.type;
      var onUpdate = component.onUpdate;
      var afterRender = component.afterRender;
      var _component$getProps2 = component.getProps;
      var getProps = _component$getProps2 === undefined ? _identity2.default : _component$getProps2;


      thunk.props = getProps(thunk.props || {}, getContext());
      (0, _defaults2.default)(thunk, prev);

      if (ignoreShouldUpdate() || shouldUpdate(prev, thunk)) {
        if (onUpdate) maybeDispatch(onUpdate(prev, thunk));
        if (afterRender) postRender(function () {
          return maybeDispatch(afterRender(thunk, (0, _virtex.findDOMNode)(thunk)));
        });

        return thunk.vnode = render(component, thunk);
      }

      return thunk.vnode = prev.vnode;
    }

    function destroy(thunk) {
      var _thunk$type = thunk.type;
      var onRemove = _thunk$type.onRemove;
      var _thunk$type$getProps = _thunk$type.getProps;
      var getProps = _thunk$type$getProps === undefined ? _identity2.default : _thunk$type$getProps;


      thunk.props = getProps(thunk.props || {}, getContext());
      onRemove && maybeDispatch(onRemove(thunk));
    }
  };
}

function render(component, thunk) {
  return typeof component === 'function' ? component(thunk) : component.render(thunk);
}

function shouldUpdate(prev, next) {
  return (next.type.shouldUpdate || defaultShouldUpdate)(prev, next);
}

function defaultShouldUpdate(prev, next) {
  return !(0, _equalArray2.default)(prev.children, next.children) || !(0, _equalObj2.default)(prev.props, next.props);
}

/**
 * Exports
 */

exports.default = middleware;
},{"@f/defaults":24,"@f/equal-array":29,"@f/equal-obj":30,"@f/identity":48,"virtex":247}],237:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createElement = require('@f/create-element');

var _createElement2 = _interopRequireDefault(_createElement);

var _setAttribute = require('./setAttribute');

var _setAttribute2 = _interopRequireDefault(_setAttribute);

var _foreach = require('@f/foreach');

var _foreach2 = _interopRequireDefault(_foreach);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Create a DOM element
 */

function createNode(vnode, children, element) {
  var type = vnode.type;
  var node = void 0;

  if (!element) {
    if (type === '#text') {
      vnode.element = document.createTextNode(vnode.props.nodeValue);
      return vnode;
    }

    node = vnode.element = (0, _createElement2.default)(type);
  } else {
    node = vnode.element = element;
  }

  (0, _foreach2.default)(function (child) {
    return node.appendChild(child.element);
  }, children);
  (0, _foreach2.default)(function (value, name) {
    return (0, _setAttribute2.default)(node, name, value);
  }, vnode.props);
  return vnode;
}

/**
 * Exports
 */

/**
 * Imports
 */

exports.default = createNode;
},{"./setAttribute":240,"@f/create-element":20,"@f/foreach":37}],238:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _replaceElement = require('@f/replace-element');

var _replaceElement2 = _interopRequireDefault(_replaceElement);

var _insertElement = require('@f/insert-element');

var _insertElement2 = _interopRequireDefault(_insertElement);

var _removeElement = require('@f/remove-element');

var _removeElement2 = _interopRequireDefault(_removeElement);

var _updateNode = require('./updateNode');

var _updateNode2 = _interopRequireDefault(_updateNode);

var _createNode = require('./createNode');

var _createNode2 = _interopRequireDefault(_createNode);

var _foreach = require('@f/foreach');

var _foreach2 = _interopRequireDefault(_foreach);

var _virtex = require('virtex');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

var _actions$types = _virtex.actions.types; /**
                                             * Imports
                                             */

var CREATE_NODE = _actions$types.CREATE_NODE;
var UPDATE_NODE = _actions$types.UPDATE_NODE;
var REMOVE_NODE = _actions$types.REMOVE_NODE;
var REPLACE_NODE = _actions$types.REPLACE_NODE;
var INSERT_NODE = _actions$types.INSERT_NODE;

/**
 * Virtex DOM effects driver
 */

function dom() {
  return function (next) {
    return function (action) {
      switch (action.type) {
        case CREATE_NODE:
          return (0, _createNode2.default)(action.vnode, action.children, action.element);
        case UPDATE_NODE:
          return (0, _updateNode2.default)(action.prev, action.vnode);
        case REMOVE_NODE:
          (0, _removeElement2.default)(action.vnode.element);
          return action.vnode;
        case REPLACE_NODE:
          (0, _replaceElement2.default)(action.vnode.element, action.prev.element);
          return action.vnode;
        case INSERT_NODE:
          (0, _insertElement2.default)(action.vnode.element, action.newVnode.element, action.pos);
          return action.vnode;
      }

      return next(action);
    };
  };
}

/**
 * Exports
 */

exports.default = dom;
},{"./createNode":237,"./updateNode":241,"@f/foreach":37,"@f/insert-element":51,"@f/remove-element":84,"@f/replace-element":85,"virtex":247}],239:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _setValue = require('@f/set-value');

var _setValue2 = _interopRequireDefault(_setValue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Remove an attribute from an element
 */

function removeAttribute(node, name) {
  switch (name) {
    case 'checked':
    case 'disabled':
    case 'selected':
      node[name] = false;
      break;
    case 'innerHTML':
      node.innerHTML = '';
      break;
    case 'value':
      (0, _setValue2.default)(node, null);
      break;
    default:
      node.removeAttribute(name);
      break;
  }
}

/**
 * Exports
 */

/**
 * Imports
 */

exports.default = removeAttribute;
},{"@f/set-value":90}],240:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _removeAttribute = require('./removeAttribute');

var _removeAttribute2 = _interopRequireDefault(_removeAttribute);

var _isValidAttr = require('@f/is-valid-attr');

var _isValidAttr2 = _interopRequireDefault(_isValidAttr);

var _applyStyles = require('@f/apply-styles');

var _applyStyles2 = _interopRequireDefault(_applyStyles);

var _setAttribute = require('@f/set-attribute');

var _setAttribute2 = _interopRequireDefault(_setAttribute);

var _setValue = require('@f/set-value');

var _setValue2 = _interopRequireDefault(_setValue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Set an attribute on an element
 */

function setAttribute(node, name, value, prevValue) {
  if (typeof value === 'function') {
    value = value(node, name);
  }

  if (name === 'style') {
    (0, _applyStyles2.default)(node, value, prevValue);
  } else if ((0, _isValidAttr2.default)(value)) {
    switch (name) {
      case 'nodeValue':
      case 'checked':
      case 'disabled':
      case 'selected':
      case 'innerHTML':
      case 'textContent':
      case 'defaultValue':
      case 'defaultChecked':
        node[name] = value;
        break;
      case 'value':
        (0, _setValue2.default)(node, value);
        break;
      default:
        (0, _setAttribute2.default)(node, name, value);
        break;
    }
  } else {
    (0, _removeAttribute2.default)(node, name);
  }
}

/**
 * Exports
 */

/**
 * Imports
 */

exports.default = setAttribute;
},{"./removeAttribute":239,"@f/apply-styles":8,"@f/is-valid-attr":64,"@f/set-attribute":87,"@f/set-value":90}],241:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _removeAttribute = require('./removeAttribute');

var _removeAttribute2 = _interopRequireDefault(_removeAttribute);

var _setAttribute = require('./setAttribute');

var _setAttribute2 = _interopRequireDefault(_setAttribute);

var _isUndefined = require('@f/is-undefined');

var _isUndefined2 = _interopRequireDefault(_isUndefined);

var _foreach = require('@f/foreach');

var _foreach2 = _interopRequireDefault(_foreach);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Update element
 */

/**
 * Imports
 */

function updateElement(prev, next) {
  var node = next.element = prev.element;

  /**
   * Diff attributes
   */

  var pattrs = prev.props;
  var nattrs = next.props;

  (0, _foreach2.default)(function (val, key) {
    if (!nattrs || (0, _isUndefined2.default)(nattrs[key])) {
      (0, _removeAttribute2.default)(node, key);
    }
  }, pattrs);

  (0, _foreach2.default)(function (val, key) {
    if (!pattrs) (0, _setAttribute2.default)(node, key, val);else if (val !== pattrs[key]) (0, _setAttribute2.default)(node, key, val, pattrs[key]);
  }, nattrs);

  return next;
}

/**
 * Exports
 */

exports.default = updateElement;
},{"./removeAttribute":239,"./setAttribute":240,"@f/foreach":37,"@f/is-undefined":63}],242:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _eventHandler = require('@f/event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _virtex = require('virtex');

var _capitalize = require('@f/capitalize');

var _capitalize2 = _interopRequireDefault(_capitalize);

var _focusElement = require('@f/focus-element');

var _focusElement2 = _interopRequireDefault(_focusElement);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _isObject = require('@f/is-object');

var _isObject2 = _interopRequireDefault(_isObject);

var _keychord = require('@f/keychord');

var _keychord2 = _interopRequireDefault(_keychord);

var _domEvents = require('@f/dom-events');

var _domEvents2 = _interopRequireDefault(_domEvents);

var _evStore = require('ev-store');

var _evStore2 = _interopRequireDefault(_evStore);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

var eventRegex = new RegExp('^on(?:' + _domEvents2.default.join('|') + ')$', 'i');

/**
 * virtex-element
 */

/**
 * Imports
 */

function element(tag, attrs) {
  // Only apply sugar to native elements
  if (typeof tag === 'string' && attrs) {
    for (var key in attrs) {
      attrs[key] = sugar(attrs[key], key);
    }
  }

  return _virtex.element.apply(null, arguments);
}

function sugar(value, name) {
  switch (name) {
    case 'class':
      return (0, _classnames2.default)(value);
    case 'autofocus':
      return value && function (node) {
        return setTimeout(function () {
          return (0, _focusElement2.default)(node);
        });
      };
    default:
      return eventRegex.test(name) ? bindEvent(name.slice(2).toLowerCase(), value) : value;
  }
}

function bindEvent(name, fn) {
  return function (node) {
    return (0, _evStore2.default)(node)[name] = (0, _eventHandler2.default)(fn);
  };
}

/**
 * Exports
 */

exports.default = element;
},{"@f/capitalize":12,"@f/dom-events":25,"@f/event-handler":32,"@f/focus-element":34,"@f/is-object":60,"@f/keychord":66,"classnames":107,"ev-store":138,"virtex":247}],243:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mount = undefined;

var _reduxEphemeral = require('redux-ephemeral');

var _reduxEphemeral2 = _interopRequireDefault(_reduxEphemeral);

var _objectEqual = require('@f/object-equal');

var _objectEqual2 = _interopRequireDefault(_objectEqual);

var _arrayEqual = require('@f/array-equal');

var _arrayEqual2 = _interopRequireDefault(_arrayEqual);

var _getProp = require('@f/get-prop');

var _getProp2 = _interopRequireDefault(_getProp);

var _virtex = require('virtex');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constants
 */

var _actions$types = _virtex.actions.types; /**
                                             * Imports
                                             */

var CREATE_THUNK = _actions$types.CREATE_THUNK;
var UPDATE_THUNK = _actions$types.UPDATE_THUNK;
var DESTROY_THUNK = _actions$types.DESTROY_THUNK;

/**
 * Provide local state to virtex components
 */

function local(prop) {
  var dirty = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  return function (_ref) {
    var getState = _ref.getState;
    var dispatch = _ref.dispatch;

    var state = function state() {
      return (0, _getProp2.default)(prop, getState());
    };

    return function (next) {
      return function (action) {
        switch (action.type) {
          case CREATE_THUNK:
            delete dirty[action.vnode.path];
            create(dispatch, action.vnode);
            break;
          case UPDATE_THUNK:
            // Prevent the clearing of dirtiness
            // / updating of state if we're just
            // rendering a cached node
            if (!action.vnode.vnode) {
              delete dirty[action.vnode.path];
              update(state, action.vnode, action.prev);
            }
            break;
          case DESTROY_THUNK:
            delete dirty[action.vnode.path];
            destroy(dispatch, action.vnode);
            break;
        }

        if ((0, _reduxEphemeral.isEphemeral)(action)) {
          dirty[action.meta.ephemeral.key] = true;
        }

        return next(action);
      };
    };
  };
}

function create(dispatch, thunk) {
  var component = thunk.type;
  var _component$initialSta = component.initialState;
  var initialState = _component$initialSta === undefined ? function () {
    return {};
  } : _component$initialSta;


  prepare(thunk, initialState);

  // If a component does not have a reducer, it does not
  // get any local state
  if (component.reducer) {
    dispatch((0, _reduxEphemeral.createEphemeral)(thunk.path, thunk.state));
  }
}

function update(getState, thunk, prev) {
  prepare(thunk, (0, _reduxEphemeral.lookup)(getState(), thunk.path));
}

function destroy(dispatch, thunk) {
  thunk.type.reducer && dispatch((0, _reduxEphemeral.destroyEphemeral)(thunk.path));
}

function shouldUpdate(prev, next) {
  return prev.state !== next.state || !(0, _arrayEqual2.default)(prev.children, next.children) || !(0, _objectEqual2.default)(prev.props, next.props);
}

function prepare(thunk, state) {
  thunk.type.shouldUpdate = thunk.type.shouldUpdate || shouldUpdate;
  thunk.local = function (fn) {
    for (var _len = arguments.length, outerArgs = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      outerArgs[_key - 1] = arguments[_key];
    }

    if (typeof fn !== 'function') throw new Error('virtex-local: non-function passed to `local()`. Did you pass the wrong handler?');
    return function () {
      for (var _len2 = arguments.length, innerArgs = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        innerArgs[_key2] = arguments[_key2];
      }

      return (0, _reduxEphemeral.toEphemeral)(thunk.path, thunk.type.reducer, fn.apply(thunk, outerArgs.concat(innerArgs)));
    };
  };

  thunk.state = typeof state === 'function' ? state(thunk) : state;
}

/**
 * Exports
 */

exports.default = local;
exports.mount = _reduxEphemeral2.default;
},{"@f/array-equal":9,"@f/get-prop":41,"@f/object-equal":74,"redux-ephemeral":170,"virtex":247}],244:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Action types
 */

var types = {
  CREATE_NODE: 'CREATE_NODE',
  UPDATE_NODE: 'UPDATE_NODE',
  REPLACE_NODE: 'REPLACE_NODE',
  REMOVE_NODE: 'REMOVE_NODE',
  INSERT_NODE: 'INSERT_NODE',
  CREATE_THUNK: 'CREATE_THUNK',
  UPDATE_THUNK: 'UPDATE_THUNK',
  DESTROY_THUNK: 'DESTROY_THUNK'
};

/**
 * Action creators for effectful things
 */

function vnodeAction(type) {
  return function (vnode, prev) {
    return {
      type: type,
      vnode: vnode,
      prev: prev
    };
  };
}

var createThunk = vnodeAction(types.CREATE_THUNK);
var updateThunk = vnodeAction(types.UPDATE_THUNK);
var destroyThunk = vnodeAction(types.DESTROY_THUNK);
var replaceNode = vnodeAction(types.REPLACE_NODE);
var removeNode = vnodeAction(types.REMOVE_NODE);

function createNode(vnode, children, element) {
  return {
    type: types.CREATE_NODE,
    vnode: vnode,
    children: children,
    element: element
  };
}

function updateNode(vnode, prev, children) {
  return {
    type: types.UPDATE_NODE,
    vnode: vnode,
    prev: prev,
    children: children
  };
}

function insertNode(vnode, newVnode, pos) {
  return {
    type: types.INSERT_NODE,
    vnode: vnode,
    newVnode: newVnode,
    pos: pos
  };
}

/**
 * Exports
 */

exports.createNode = createNode;
exports.insertNode = insertNode;
exports.updateNode = updateNode;
exports.replaceNode = replaceNode;
exports.removeNode = removeNode;
exports.createThunk = createThunk;
exports.updateThunk = updateThunk;
exports.destroyThunk = destroyThunk;
exports.types = types;
},{}],245:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _mapArray = require('@f/map-array');

var _mapArray2 = _interopRequireDefault(_mapArray);

var _util = require('./util');

var _actions = require('./actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Create the initial document fragment
 */

function create(effect) {
  return function (vnode) {
    var path = arguments.length <= 1 || arguments[1] === undefined ? 'a' : arguments[1];
    var element = arguments[2];
    return createRecursive(vnode, path, element);
  };

  function createRecursive(vnode, path, element) {
    vnode.path = path;

    if ((0, _util.isThunk)(vnode)) {
      var next = effect((0, _actions.createThunk)(vnode));

      if (!next) {
        throw new Error('Component returned null/undefined. Components must return valid virtual nodes.');
      }

      return createRecursive(next, (0, _util.createPath)(next, path, 0), element);
    }

    return effect((0, _actions.createNode)(vnode, (0, _mapArray2.default)(createChild(path, element), vnode.children), element));
  }

  function createChild(path, element) {
    return element ? function (child, i) {
      return createRecursive(child, (0, _util.createPath)(child, path, i), element.childNodes[i]);
    } : function (child, i) {
      return createRecursive(child, (0, _util.createPath)(child, path, i));
    };
  }
}

/**
 * Exports
 */

/**
 * Imports
 */

exports.default = create;
},{"./actions":244,"./util":249,"@f/map-array":68}],246:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; }; /**
                                                                                                                                                                                                                                                   * Imports
                                                                                                                                                                                                                                                   */

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _isUndefined = require('@f/is-undefined');

var _isUndefined2 = _interopRequireDefault(_isUndefined);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Vnode creator
 */

function element(type, props) {
  if (!type) throw new Error('Virtex error: Invalid component. Did you import a component that doesn\'t exist?');

  var len = arguments.length;
  var children = [];

  for (var i = 2, j = 0; i < len; ++i) {
    j += filterFlatten(arguments[i], children, j);
  }

  var key = undefined;
  if (props && !(0, _isUndefined2.default)(props.key)) {
    key = props.key;
    if (Object.keys(props).length === 1) {
      props = undefined;
    } else {
      props.key = undefined;
    }
  }

  return {
    key: key,
    type: type,
    props: props,
    children: children
  };
}

/**
 * Very fast in-place, single-pass filter/flatten
 * algorithm
 */

function filterFlatten(item, arr, arrStart) {
  var added = 0;

  switch (type(item)) {
    case 'array':
      var len = item.length;
      for (var i = 0; i < len; ++i) {
        added += filterFlatten(item[i], arr, arrStart + added);
      }
      return added;
    case 'boolean':
    case 'null':
    case 'undefined':
      return 0;
    case 'string':
    case 'number':
      arr[arrStart] = element('#text', { nodeValue: item });
      break;
    default:
      arr[arrStart] = item;
      break;
  }

  return 1;
}

function type(val) {
  if (Array.isArray(val)) return 'array';
  if (val === null) return 'null';
  return typeof val === 'undefined' ? 'undefined' : _typeof(val);
}

/**
 * Exports
 */

exports.default = element;
},{"@f/is-undefined":63}],247:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findDOMNode = exports.actions = exports.element = undefined;

var _actions = require('./actions');

var actions = _interopRequireWildcard(_actions);

var _util = require('./util');

var _element = require('./element');

var _element2 = _interopRequireDefault(_element);

var _update = require('./update');

var _update2 = _interopRequireDefault(_update);

var _create = require('./create');

var _create2 = _interopRequireDefault(_create);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 * Virtex
 */

function virtex(effect) {
  return {
    create: (0, _create2.default)(effect),
    update: (0, _update2.default)(effect)
  };
}

/**
 * Exports
 */

/**
 * Imports
 */

exports.default = virtex;
exports.element = _element2.default;
exports.actions = actions;
exports.findDOMNode = _util.findDOMNode;
},{"./actions":244,"./create":245,"./element":246,"./update":248,"./util":249}],248:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _actions = require('./actions');

var _util = require('./util');

var _dift = require('dift');

var _dift2 = _interopRequireDefault(_dift);

var _foreach = require('@f/foreach');

var _foreach2 = _interopRequireDefault(_foreach);

var _create2 = require('./create');

var _create3 = _interopRequireDefault(_create2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Diff and render two vnode trees
 */

function update(effect) {
  var create = (0, _create3.default)(effect);
  return function (prev, next) {
    var path = arguments.length <= 2 || arguments[2] === undefined ? 'a' : arguments[2];
    return updateRecursive(prev, next, path);
  };

  function updateRecursive(prev, next, path) {
    next.path = path;

    if (!(0, _util.isSameNode)(prev, next)) {
      unrenderThunks(prev);

      while ((0, _util.isThunk)(prev)) {
        prev = effect((0, _actions.updateThunk)(prev));
      }

      next = create(next, path);
      effect((0, _actions.replaceNode)(next, prev));
    } else if ((0, _util.isThunk)(next)) {
      next = effect((0, _actions.updateThunk)(next, prev));
      prev = effect((0, _actions.updateThunk)(prev));

      if (!next) {
        throw new Error('Component returned null/undefined. Components must return valid virtual nodes.');
      }

      return updateRecursive(prev, next, (0, _util.createPath)(next, path, 0));
    } else if (prev !== next) {
      (function () {
        /**
         * Diff children
         */

        var children = new Array(next.children.length);
        (0, _dift2.default)(prev.children, next.children, function (type, pItem, nItem, pos) {
          switch (type) {
            case _dift.UPDATE:
              children[pos] = updateRecursive(pItem, nItem, (0, _util.createPath)(nItem, path, pos));
              return;
            case _dift.CREATE:
              children[pos] = create(nItem, (0, _util.createPath)(nItem, path, pos));
              return effect((0, _actions.insertNode)(prev, children[pos], pos));
            case _dift.MOVE:
              children[pos] = updateRecursive(pItem, nItem, (0, _util.createPath)(nItem, path, pos));
              return effect((0, _actions.insertNode)(prev, children[pos], pos));
            case _dift.REMOVE:
              return effect((0, _actions.removeNode)(unrenderThunks(pItem)));
          }
        }, _util.getKey);

        effect((0, _actions.updateNode)(next, prev, children));
      })();
    }

    return next;
  }

  function unrenderThunks(vnode) {
    while ((0, _util.isThunk)(vnode)) {
      effect((0, _actions.destroyThunk)(vnode));
      vnode = effect((0, _actions.updateThunk)(vnode));
    }

    (0, _foreach2.default)(unrenderThunks, vnode.children);
    return vnode;
  }
}

/**
 * Exports
 */

/**
 * Imports
 */

exports.default = update;
},{"./actions":244,"./create":245,"./util":249,"@f/foreach":37,"dift":120}],249:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getKey = exports.findDOMNode = exports.createPath = exports.isSameNode = exports.isThunk = undefined;

var _isString = require('@f/is-string');

var _isString2 = _interopRequireDefault(_isString);

var _isUndefined = require('@f/is-undefined');

var _isUndefined2 = _interopRequireDefault(_isUndefined);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Utilities
 */

/**
 * Imports
 */

function isThunk(a) {
  return !(0, _isString2.default)(a.type);
}

function isSameNode(a, b) {
  return a.type === b.type;
}

function getKey(a) {
  return a.key;
}

function createPath(vnode, path, pos) {
  var key = getKey(vnode);
  var part = (0, _isUndefined2.default)(key) ? pos : key;

  return path + '.' + part;
}

function findDOMNode(vnode) {
  var p = vnode;
  while (isThunk(p)) {
    p = p.vnode;
  }return p.element;
}

/**
 * Exports
 */

exports.isThunk = isThunk;
exports.isSameNode = isSameNode;
exports.createPath = createPath;
exports.findDOMNode = findDOMNode;
exports.getKey = getKey;
},{"@f/is-string":61,"@f/is-undefined":63}],250:[function(require,module,exports){
'use strict';

var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split('')
  , length = 64
  , map = {}
  , seed = 0
  , i = 0
  , prev;

/**
 * Return a string representing the specified number.
 *
 * @param {Number} num The number to convert.
 * @returns {String} The string representation of the number.
 * @api public
 */
function encode(num) {
  var encoded = '';

  do {
    encoded = alphabet[num % length] + encoded;
    num = Math.floor(num / length);
  } while (num > 0);

  return encoded;
}

/**
 * Return the integer value specified by the given string.
 *
 * @param {String} str The string to convert.
 * @returns {Number} The integer value represented by the string.
 * @api public
 */
function decode(str) {
  var decoded = 0;

  for (i = 0; i < str.length; i++) {
    decoded = decoded * length + map[str.charAt(i)];
  }

  return decoded;
}

/**
 * Yeast: A tiny growing id generator.
 *
 * @returns {String} A unique id.
 * @api public
 */
function yeast() {
  var now = encode(+new Date());

  if (now !== prev) return seed = 0, prev = now;
  return now +'.'+ encode(seed++);
}

//
// Map each character to its index.
//
for (; i < length; i++) map[alphabet[i]] = i;

//
// Expose the `yeast`, `encode` and `decode` functions.
//
yeast.encode = encode;
yeast.decode = decode;
module.exports = yeast;

},{}],251:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addTeam = exports.registerCommand = exports.initializeApp = exports.submitForm = exports.ADD_TEAM = exports.COMMAND_REGISTERED = exports.SUBMIT_FORM = exports.URL_DID_CHANGE = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _hashids = require('hashids');

var _hashids2 = _interopRequireDefault(_hashids);

var _reduxEffectsLocation = require('redux-effects-location');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var hashids = new _hashids2.default('the saltiest ocean', 4);
var URL_DID_CHANGE = 'URL_DID_CHANGE';
var SUBMIT_FORM = 'SUBMIT_FORM';
var COMMAND_REGISTERED = 'COMMAND_REGISTERED';
var ADD_TEAM = 'ADD_TEAM';

function initializeApp() {
  return (0, _reduxEffectsLocation.bindUrl)(urlChange);
}

function submitForm(rules) {
  var id = hashids.encode(Math.floor(Math.random() * 1000) + 1);
  return [(0, _reduxEffectsLocation.setUrl)('/game/' + id), {
    type: SUBMIT_FORM,
    payload: _extends({}, rules, { id: id })
  }];
}

function urlChange(url) {
  return {
    type: URL_DID_CHANGE,
    payload: url
  };
}

function registerCommand(num, name) {
  return {
    type: COMMAND_REGISTERED,
    payload: {
      num: num,
      name: name
    }
  };
}

function addTeam(name, color) {
  return {
    type: ADD_TEAM,
    payload: {
      name: name,
      color: color
    }
  };
}

exports.URL_DID_CHANGE = URL_DID_CHANGE;
exports.SUBMIT_FORM = SUBMIT_FORM;
exports.COMMAND_REGISTERED = COMMAND_REGISTERED;
exports.ADD_TEAM = ADD_TEAM;
exports.submitForm = submitForm;
exports.initializeApp = initializeApp;
exports.registerCommand = registerCommand;
exports.addTeam = addTeam;

},{"hashids":142,"redux-effects-location":169}],252:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _router = require('./router');

var _router2 = _interopRequireDefault(_router);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Render
 */

function render(props) {
  var url = props.url;

  return (0, _router2.default)(url || '/', props);
}

/**
 * Exports
 */

/**
 * Imports
 */

exports.default = render;

},{"./router":267}],253:[function(require,module,exports){
'use strict';

var _domready = require('@f/domready');

var _domready2 = _interopRequireDefault(_domready);

var _dom = require('vdux/dom');

var _dom2 = _interopRequireDefault(_dom);

var _reducer = require('./reducer');

var _reducer2 = _interopRequireDefault(_reducer);

var _jssSimple = require('jss-simple');

var jss = _interopRequireWildcard(_jssSimple);

var _reduxLogger = require('redux-logger');

var _reduxLogger2 = _interopRequireDefault(_reduxLogger);

var _reduxEffectsLocation = require('redux-effects-location');

var _reduxEffectsLocation2 = _interopRequireDefault(_reduxEffectsLocation);

var _reduxMulti = require('redux-multi');

var _reduxMulti2 = _interopRequireDefault(_reduxMulti);

var _server = require('./middleware/server');

var _server2 = _interopRequireDefault(_server);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Imports
 */

var app = require('./app').default;

var initialState = {
  url: '/'
};

/**
 * App
 */

var _vdux = (0, _dom2.default)({
  reducer: _reducer2.default,
  initialState: initialState,
  middleware: [_reduxMulti2.default, (0, _reduxEffectsLocation2.default)(), (0, _server2.default)(), (0, _reduxLogger2.default)()]
});

var subscribe = _vdux.subscribe;
var render = _vdux.render;
var replaceReducer = _vdux.replaceReducer;


(0, _domready2.default)(function () {
  subscribe(function (state) {
    jss.attach();
    render(app(state));
  });
});

if (module.hot) {
  module.hot.accept(['./app', './reducer'], function () {
    replaceReducer(require('./reducer').default);
    app = require('./app').default;
  });
}

},{"./app":252,"./middleware/server":262,"./reducer":266,"@f/domready":26,"jss-simple":147,"redux-effects-location":169,"redux-logger":172,"redux-multi":173,"vdux/dom":232}],254:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxUi = require('vdux-ui');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx element */


function render(_ref) {
  var props = _ref.props;
  var increments = props.increments;
  var onClick = props.onClick;


  return (0, _element2.default)(
    _vduxUi.Block,
    { h: '10%', borderBottom: '1px solid #e5e5e5' },
    (0, _element2.default)(
      _vduxUi.Flex,
      { tall: true, flex: '1', align: 'center center' },
      increments.map(function (inc, i) {
        return (0, _element2.default)(
          _vduxUi.Box,
          { tall: true, wide: true },
          (0, _element2.default)(
            _vduxUi.Button,
            {
              wide: true,
              tall: true,
              fs: '18px',
              bgColor: 'transparent',
              color: 'black',
              weight: '600',
              borderRight: i < increments.length - 1 ? '1px solid #e5e5e5' : '0',
              outline: 'none',
              onClick: onClick({ description: inc.description, points: inc.points })
            },
            inc.description
          )
        );
      })
    )
  );
}

exports.default = {
  render: render
};

},{"vdux-ui":228,"vdux/element":233}],255:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxUi = require('vdux-ui');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx element */

function render(_ref) {
  var props = _ref.props;
  var messages = props.messages;


  return (0, _element2.default)(
    _vduxUi.Block,
    { p: messages.length > 0 && '10px', maxHeight: '50%', overflowX: 'hidden', overflowY: 'auto' },
    messages.reverse().map(function (_ref2) {
      var description = _ref2.description;
      var points = _ref2.points;

      return (0, _element2.default)(
        _vduxUi.Flex,
        { fs: '18px', weight: '300', p: '2px 15px' },
        (0, _element2.default)(
          _vduxUi.Box,
          { wide: true },
          (0, _element2.default)(
            _vduxUi.Text,
            null,
            description
          )
        ),
        (0, _element2.default)(
          _vduxUi.Box,
          null,
          (0, _element2.default)(
            _vduxUi.Text,
            null,
            points
          )
        )
      );
    })
  );
}

exports.default = {
  render: render
};

},{"vdux-ui":228,"vdux/element":233}],256:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxUi = require('vdux-ui');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx element */


function render() {
  return (0, _element2.default)(
    _vduxUi.Card,
    null,
    (0, _element2.default)(
      _vduxUi.Flex,
      { align: 'center center' },
      (0, _element2.default)(
        _vduxUi.Text,
        { p: '60px', fs: '40px' },
        ' Waiting For Teams To Join '
      )
    )
  );
}

exports.default = {
  render: render
};

},{"vdux-ui":228,"vdux/element":233}],257:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxUi = require('vdux-ui');

var _stringTemplate = require('string-template');

var _stringTemplate2 = _interopRequireDefault(_stringTemplate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function render(_ref) {
  var props = _ref.props;
  var rule = props.rule;
  var _props$points = props.points;
  var points = _props$points === undefined ? 0 : _props$points;
  var _props$color = props.color;
  var color = _props$color === undefined ? 'green' : _props$color;
  var _props$commands = props.commands;
  var commands = _props$commands === undefined ? 1 : _props$commands;


  var calculatedPoints = void 0;

  if (isNaN(commands) || commands === 0) {
    calculatedPoints = points;
  } else {
    var exp = (0, _stringTemplate2.default)(rule, {
      points: points,
      commands: commands
    });
    calculatedPoints = Math.floor(eval(exp)) || 0;
  }

  return (0, _element2.default)(
    _vduxUi.Flex,
    { h: '40%', color: 'white', column: true, align: 'center center', bgColor: color },
    (0, _element2.default)(
      _vduxUi.Box,
      null,
      (0, _element2.default)(
        _vduxUi.Text,
        { fs: '6em', weight: '600' },
        calculatedPoints
      )
    ),
    (0, _element2.default)(
      _vduxUi.Box,
      null,
      (0, _element2.default)(
        _vduxUi.Text,
        { fs: '1.5em' },
        isNaN(commands) ? 0 : commands
      )
    )
  );
} /** @jsx element*/

exports.default = {
  render: render
};

},{"string-template":193,"vdux-ui":228,"vdux/element":233}],258:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /** @jsx element */


var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _pointsBox = require('./pointsBox');

var _pointsBox2 = _interopRequireDefault(_pointsBox);

var _cardButtons = require('./cardButtons');

var _cardButtons2 = _interopRequireDefault(_cardButtons);

var _log = require('./log');

var _log2 = _interopRequireDefault(_log);

var _vduxUi = require('vdux-ui');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var ADD_POINTS = 'ADD_POINTS';

function initialState() {
  return {
    points: 0,
    messages: []
  };
}

function render(_ref) {
  var props = _ref.props;
  var local = _ref.local;
  var state = _ref.state;
  var rule = props.rule;
  var commands = props.commands;
  var increments = props.increments;
  var name = props.name;
  var color = props.color;
  var points = state.points;
  var messages = state.messages;


  return (0, _element2.default)(
    _vduxUi.Card,
    { minHeight: '450px', h: '100%', w: '400px', m: '0 10px' },
    (0, _element2.default)(
      _vduxUi.Text,
      { absolute: true, m: '8px', fs: '25px', color: 'white' },
      name
    ),
    (0, _element2.default)(_pointsBox2.default, { color: color, rule: rule, points: Number(points), commands: Number(commands) }),
    (0, _element2.default)(_cardButtons2.default, { onClick: function onClick(p) {
        return local(addPoints(p));
      }, increments: increments }),
    (0, _element2.default)(_log2.default, { messages: messages })
  );
}

function addPoints(p) {
  return function () {
    return {
      type: ADD_POINTS,
      payload: p
    };
  };
}

function reducer(state, action) {
  switch (action.type) {
    case ADD_POINTS:
      var _action$payload = action.payload;
      var points = _action$payload.points;
      var description = _action$payload.description;

      return _extends({}, state, {
        points: Number(state.points) + Number(points),
        messages: [].concat(_toConsumableArray(state.messages), [{ description: description, points: points }])
      });
  }
}

exports.default = {
  initialState: initialState,
  reducer: reducer,
  render: render
};

},{"./cardButtons":254,"./log":255,"./pointsBox":257,"vdux-ui":228,"vdux/element":233}],259:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /** @jsx element */

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxUi = require('vdux-ui');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SET_ERROR = 'SET_ERROR';
var CLEAR_ERROR = 'CLEAR_ERROR';

function render(_ref) {
  var state = _ref.state;
  var props = _ref.props;
  var local = _ref.local;
  var error = state.error;
  var label = props.label;
  var name = props.name;


  return (0, _element2.default)(
    _vduxUi.Block,
    { margin: '5px 0', relative: true },
    (0, _element2.default)('input', {
      required: true,
      onChange: local(clearError),
      placeholder: label,
      name: name,
      onInvalid: local(setError) }),
    (0, _element2.default)(
      _vduxUi.Tooltip,
      { bgColor: 'red', placement: 'right', show: error },
      error
    )
  );
}

function clearError() {
  return {
    type: CLEAR_ERROR
  };
}

function setError(e) {
  return {
    type: SET_ERROR,
    payload: e.target.validationMessage
  };
}

function initialState() {
  return {
    error: ''
  };
}

function reducer(state, action) {
  switch (action.type) {
    case SET_ERROR:
      return _extends({}, state, {
        error: action.payload
      });
    case CLEAR_ERROR:
      return _extends({}, state, {
        error: ''
      });
  }
  return state;
}

exports.default = {
  initialState: initialState,
  reducer: reducer,
  render: render
};

},{"vdux-ui":228,"vdux/element":233}],260:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxUi = require('vdux-ui');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx element */

function render(_ref) {
  var props = _ref.props;
  var children = _ref.children;
  var title = props.title;
  var erase = props.erase;
  var onErase = props.onErase;

  return (0, _element2.default)(
    _vduxUi.Block,
    null,
    (0, _element2.default)(
      _vduxUi.Block,
      { p: '5px' },
      (0, _element2.default)(
        _vduxUi.Flex,
        { align: 'space-between center', margin: '0 0 10px 0' },
        (0, _element2.default)(
          _vduxUi.Text,
          { weight: '600', display: 'block' },
          title
        ),
        erase && (0, _element2.default)(
          _vduxUi.Button,
          { onClick: onErase, outline: 'none', bgColor: 'white', p: '0', color: 'rgb(17, 17, 17)' },
          (0, _element2.default)(_vduxUi.Icon, { name: 'delete' })
        )
      ),
      children
    ),
    (0, _element2.default)(_vduxUi.Divider, null)
  );
}

exports.default = {
  render: render
};

},{"vdux-ui":228,"vdux/element":233}],261:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxUi = require('vdux-ui');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var styles = {
  container: {
    fontFamily: '\'Roboto\', sans-serif'
  }
};

function render(_ref) {
  var children = _ref.children;

  return (0, _element2.default)(
    _vduxUi.Flex,
    { style: styles.container, align: 'center center', absolute: true, wide: true, tall: true },
    (0, _element2.default)(
      _vduxUi.Box,
      { auto: true },
      children
    )
  );
}

exports.default = {
  render: render
};

},{"vdux-ui":228,"vdux/element":233}],262:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _socket = require('socket.io-client');

var _socket2 = _interopRequireDefault(_socket);

var _actions = require('../actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
  return function (_ref) {
    var dispatch = _ref.dispatch;
    var getState = _ref.getState;

    var socket = _socket2.default.connect(window.location.origin);
    socket.on('command', function (_ref2) {
      var id = _ref2.id;
      var num = _ref2.num;
      var team = _ref2.team;

      if (getState().id === id) {
        dispatch((0, _actions.registerCommand)(num, team));
      }
    });
    socket.on('add team', function (_ref3) {
      var id = _ref3.id;
      var team = _ref3.team;
      var color = _ref3.color;

      if (getState().id === id) {
        dispatch((0, _actions.addTeam)(team, color));
      }
    });
    return function (next) {
      return function (action) {
        return next(action);
      };
    };
  };
};
// import {websocket} from '../../config'

},{"../actions":251,"socket.io-client":182}],263:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /** @jsx element */


var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxForm = require('vdux-form');

var _vduxForm2 = _interopRequireDefault(_vduxForm);

var _textField = require('../components/textField');

var _textField2 = _interopRequireDefault(_textField);

var _textFields = require('../components/textFields');

var _textFields2 = _interopRequireDefault(_textFields);

var _createAction = require('@f/create-action');

var _createAction2 = _interopRequireDefault(_createAction);

var _splice = require('@f/splice');

var _splice2 = _interopRequireDefault(_splice);

var _vduxUi = require('vdux-ui');

var _actions = require('../actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var ADD_INCREMENT = 'ADD_INCREMENT';
var RM_INCREMENT = 'RM_INCREMENT';
var rmIncrement = (0, _createAction2.default)(RM_INCREMENT);
var addIncrement = (0, _createAction2.default)(ADD_INCREMENT);

function initialState() {
  return {
    increment: [{
      description: '',
      points: ''
    }]
  };
}

function render(_ref) {
  var state = _ref.state;
  var local = _ref.local;
  var increment = state.increment;

  return (0, _element2.default)(
    _vduxForm2.default,
    { cast: cast, validate: validate, onSubmit: _actions.submitForm },
    (0, _element2.default)(
      _vduxUi.Card,
      { p: '20px' },
      (0, _element2.default)(
        _vduxUi.Flex,
        { column: true, align: 'space-between' },
        (0, _element2.default)(
          _textFields2.default,
          { title: 'Points Expression' },
          (0, _element2.default)(_textField2.default, { name: 'rule', label: 'points expression' })
        ),
        increment.map(function (inc, i) {
          var id = i + 1;
          return (0, _element2.default)(
            _textFields2.default,
            { onErase: removeInc(i), erase: id > 1 && id === increment.length, title: 'Goal #' + id },
            (0, _element2.default)(_textField2.default, { name: 'description' + id, label: 'Goal' }),
            (0, _element2.default)(_textField2.default, { name: 'points' + id, label: 'Points' })
          );
        }),
        (0, _element2.default)(
          _vduxUi.Block,
          { p: '0 5px' },
          (0, _element2.default)(
            _vduxUi.Button,
            { weight: '600', fs: '1em', w: '200px', padding: '10px', margin: '5px 0', onClick: local(addIncrement) },
            'Add points category'
          ),
          (0, _element2.default)('input', { type: 'submit' })
        )
      )
    )
  );

  function removeInc(id) {
    return local(rmIncrement.bind(this, id));
  }
}

function cast(model) {
  var increments = [];
  for (var field in model) {
    var match = field.match(/\d/gi);
    var num = match ? match[0] - 1 : undefined;
    var word = field.split(/\d/gi)[0];
    if (!isNaN(num)) {
      if (!increments[num]) {
        increments[num] = {};
      }
      increments[num][word] = model[field];
    }
  }
  return {
    increments: increments,
    rule: model.rule
  };
}

function validate(_ref2) {
  var rule = _ref2.rule;
  var increments = _ref2.increments;

  var re = /(\{points\})(.*\{commands\})|(\{commands\})(.*\{points\})/gi;
  if (!rule.match(re)) {
    return {
      valid: false,
      errors: [{
        field: 'rule',
        message: 'rule must contain {points} and {commands}'
      }]
    };
  }
  for (var i in increments) {
    var inc = increments[i];
    if (!inc.description) {
      return {
        valid: false,
        errors: [{
          field: 'description' + (Number(i) + 1),
          message: 'required'
        }]
      };
    }
    if (isNaN(inc.points)) {
      console.log(inc.points);
      return {
        valid: false,
        errors: [{
          field: 'points' + (Number(i) + 1),
          message: 'must be a number'
        }]
      };
    }
  }

  return {
    valid: true
  };
}

function reducer(state, action) {
  switch (action.type) {
    case ADD_INCREMENT:
      return _extends({}, state, {
        increment: [].concat(_toConsumableArray(state.increment), [{}])
      });
    case RM_INCREMENT:
      return _extends({}, state, {
        increment: (0, _splice2.default)(state.increment, action.payload, 1)
      });
  }
  return state;
}

exports.default = {
  initialState: initialState,
  reducer: reducer,
  render: render
};

},{"../actions":251,"../components/textField":259,"../components/textFields":260,"@f/create-action":19,"@f/splice":92,"vdux-form":200,"vdux-ui":228,"vdux/element":233}],264:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _team = require('../components/team');

var _team2 = _interopRequireDefault(_team);

var _noTeams = require('../components/noTeams');

var _noTeams2 = _interopRequireDefault(_noTeams);

var _vduxUi = require('vdux-ui');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx element */

function render(_ref) {
  var props = _ref.props;
  var state = _ref.state;
  var local = _ref.local;
  var _props$increments = props.increments;
  var increments = _props$increments === undefined ? [] : _props$increments;
  var _props$rule = props.rule;
  var rule = _props$rule === undefined ? '{points} / {commands}' : _props$rule;
  var _props$teams = props.teams;
  var teams = _props$teams === undefined ? {} : _props$teams;

  return (0, _element2.default)(
    _vduxUi.Flex,
    { h: '80vh', column: true, align: 'space-between' },
    (0, _element2.default)(
      _vduxUi.Flex,
      { h: '100%' },
      getTeams().length < 1 ? (0, _element2.default)(_noTeams2.default, null) : getTeams()
    )
  );

  function getTeams() {
    var results = [];
    for (var team in teams) {
      results.push((0, _element2.default)(_team2.default, {
        name: team,
        rule: rule,
        color: teams[team].color,
        commands: teams[team].commands,
        increments: increments }));
    }
    return results;
  }
}

exports.default = {
  render: render
};

},{"../components/noTeams":256,"../components/team":258,"vdux-ui":228,"vdux/element":233}],265:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _vduxUi = require('vdux-ui');

var _reduxEffectsLocation = require('redux-effects-location');

var _actions = require('../actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx element */

function onCreate() {
  return (0, _actions.initializeApp)();
}

function render() {
  return (0, _element2.default)(
    _vduxUi.Button,
    { onClick: function onClick() {
        return (0, _reduxEffectsLocation.setUrl)('/form');
      }, h: '100px', w: '300px', fs: '36px' },
    'Create Game'
  );
}

exports.default = {
  render: render,
  onCreate: onCreate
};

},{"../actions":251,"redux-effects-location":169,"vdux-ui":228,"vdux/element":233}],266:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _setProp = require('@f/set-prop');

var _setProp2 = _interopRequireDefault(_setProp);

var _actions = require('./actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function reducer(state, action) {
  switch (action.type) {
    case _actions.URL_DID_CHANGE:
      return _extends({}, state, {
        url: action.payload
      });
    case _actions.SUBMIT_FORM:
      {
        return _extends({}, state, {
          rule: action.payload.rule,
          increments: action.payload.increments,
          id: action.payload.id,
          teams: {},
          commands: 0
        });
      }
    case _actions.ADD_TEAM:
      {
        return _extends({}, state, {
          teams: (0, _setProp2.default)(action.payload.name, state.teams, { color: action.payload.color })
        });
      }
    case _actions.COMMAND_REGISTERED:
      {
        return _extends({}, state, {
          teams: (0, _setProp2.default)(action.payload.name, state.teams, _extends({}, state.teams[action.payload.name], {
            commands: action.payload.num
          }))
        });
      }
  }
  return state;
}

exports.default = reducer;

},{"./actions":251,"@f/set-prop":88}],267:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _home = require('./pages/home');

var _home2 = _interopRequireDefault(_home);

var _form = require('./pages/form');

var _form2 = _interopRequireDefault(_form);

var _game = require('./pages/game');

var _game2 = _interopRequireDefault(_game);

var _centered = require('./layouts/centered');

var _centered2 = _interopRequireDefault(_centered);

var _element = require('vdux/element');

var _element2 = _interopRequireDefault(_element);

var _enroute = require('enroute');

var _enroute2 = _interopRequireDefault(_enroute);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Routes
 */

/** @jsx element */

/**
 * Imports
 */

var router = (0, _enroute2.default)({
  '/': home,
  '/form': form,
  '/game/:id': game
});

/**
 * Pages
 */

function home(params, props) {
  return (0, _element2.default)(
    _centered2.default,
    null,
    (0, _element2.default)(_home2.default, props)
  );
}

function form(params, props) {
  return (0, _element2.default)(
    _centered2.default,
    null,
    (0, _element2.default)(_form2.default, props)
  );
}

function game(params, props) {
  if (props.rule) {
    return (0, _element2.default)(
      _centered2.default,
      null,
      (0, _element2.default)(_game2.default, props)
    );
  }
}

/**
 * Exports
 */

exports.default = router;

},{"./layouts/centered":261,"./pages/form":263,"./pages/game":264,"./pages/home":265,"enroute":135,"vdux/element":233}]},{},[253]);
