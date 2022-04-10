const path = require('path');
const webpack = require('webpack');

module.exports =
/**
 * @param {import('karma').Config} config
 */
(config) => {
  const browsers = config.browsers;
  /** @type {import('karma').ConfigOptions} */
  const options = {
    basePath: '',
    frameworks: ["jasmine"],
    files: ["test/setup.ts"],
    preprocessors: {
      "test/setup.ts": ["webpack", "sourcemap"]
    },
    webpack: {
      mode: "development",
      resolve: {
        extensions: [".ts", ".js"],
        modules: [path.resolve(__dirname, 'node_modules')],
        alias: {
          src: path.resolve(__dirname, 'src'),
          'aurelia-typed-observable-plugin': path.resolve(__dirname, 'src/index.ts'),
          test: path.resolve(__dirname, 'test')
        }
      },
      devtool: "inline-source-map",
      module: {
        rules: [
          {
            test: /\.ts$/,
            loader: "ts-loader",
            exclude: /node_modules/
          }
        ]
      },
      plugins: [
        new webpack.SourceMapDevToolPlugin({
          test: /\.(ts|js|css)($|\?)/i
        })
      ]
    },
    mime: {
      "text/x-typescript": ["ts"]
    },
    reporters: ["mocha", "progress"],
    webpackServer: { noInfo: config.noInfo },
    browsers: Array.isArray(browsers) && browsers.length > 0 ? browsers : ['ChromeHeadless'],
    logLevel: config.LOG_INFO,
    customLaunchers: {
      ChromeDebugging: {
        base: "Chrome",
        flags: ["--remote-debugging-port=9333"],
        debug: true
      }
    },
    mochaReporter: {
      ignoreSkipped: true
    },
    singleRun: false
  };

  if (config.coverage) {
    options.webpack.module.rules.push({
      enforce: "post",
      exclude: /(node_modules|\.spec\.ts$)/,
      loader: "istanbul-instrumenter-loader",
      options: { esModules: true },
      test: /src[\/\\].+\.ts$/
    });
    options.reporters.push("coverage-istanbul");
    options.coverageIstanbulReporter = {
      reports: ["html", "lcovonly", "text-summary"],
      fixWebpackSourcePaths: true
    };
  }

  config.set(options);
};
