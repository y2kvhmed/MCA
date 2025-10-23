const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for web
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;