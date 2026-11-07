// Minimal stand-in for Node's `assert(value, message)`, wired in metro.config.cjs
// for @ide/backoff only. Keeps the npm `assert`/`util` polyfills out of the bundle.
module.exports = function assert(value, message) {
  if (!value) throw new Error(message || "Assertion failed");
};
