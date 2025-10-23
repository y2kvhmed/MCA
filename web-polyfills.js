// Web polyfills for React Native Web compatibility
// This file ensures the app works properly on web platforms

// Polyfill for TextEncoder/TextDecoder (needed for some crypto operations)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Polyfill for Buffer (needed for file operations)
if (typeof global.Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

// Polyfill for process (needed for environment variables)
if (typeof global.process === 'undefined') {
  global.process = require('process');
}

// Polyfill for crypto (needed for secure operations)
if (typeof global.crypto === 'undefined') {
  global.crypto = require('crypto');
}

// Ensure fetch is available
if (typeof global.fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

console.log('✅ Web polyfills loaded successfully');