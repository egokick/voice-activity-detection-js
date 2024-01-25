const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './index.js', // Your main JavaScript file
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  }, plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'index.html', to: 'index.html' },
        { from: path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm'), to: 'ort-wasm-simd.wasm' },

        // Add other assets to copy if necessary
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: 'javascript/auto',
        use: {
          loader: 'file-loader',
          options: {
            outputPath: 'wasm', // Output WebAssembly files to 'dist/wasm'
          },
        },
      },
    ],
  },
  experiments: {
    asyncWebAssembly: true, // Enable WebAssembly support
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
	open: true
  },
};
