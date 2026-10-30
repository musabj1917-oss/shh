module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod v4 ships ESM with `export * as ns from ...`; Metro fails without this.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
