// Web polyfills for React Native components on web
if (typeof global === 'undefined') {
  global = globalThis;
}

// Polyfill for TextEncoder/TextDecoder if needed
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}