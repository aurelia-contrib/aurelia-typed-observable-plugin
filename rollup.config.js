import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';

const { name } = pkg;
const inputFileName = 'src/index.ts';

/** @type {import('rollup').RollupOptions[]} */
const options = [
  {
    input: inputFileName,
    output: [{
      file: 'dist/es2015/index.js',
      format: 'es'
    }],
    plugins: [
      typescript({
        target: 'es2017',
        removeComments: true
      })
    ]
  },
  {
    input: inputFileName,
    output: [{
      file: `dist/es2017/${name}.js`,
      format: 'esm'
    }],
    plugins: [
      typescript({
        target: 'es2017',
        removeComments: true
      })
    ]
  },
  process.env.NODE_ENV !== 'production'
    && {
      input: inputFileName,
      output: [
        { file: 'dist/amd/index.js', format: 'amd', amd: { id: name } },
        { file: 'dist/commonjs/index.js', format: 'cjs' },
        { file: 'dist/native-modules/index.js', format: 'es' },
        { file: `dist/system/${name}.js`, format: 'system' },
      ],
      plugins: [
        typescript({
          target: 'es5',
          removeComments: true
        })
      ]
    }
].map(config => {
  if (!config) return undefined;

  config.external = [
    'aurelia-binding',
    'aurelia-dependency-injection',
    'aurelia-pal',
    'aurelia-templating',
    'aurelia-templating-resources',
    'aurelia-task-queue',
    'aurelia-logging',
    'aurelia-path',
    'aurelia-loader',
    'aurelia-metadata'
  ];
  config.output.forEach(output => output.sourcemap = true);
  config.onwarn = /** @param {import('rollup').RollupWarning} warning */ (warning, warn) => {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  };
  return config;
});

export default options;