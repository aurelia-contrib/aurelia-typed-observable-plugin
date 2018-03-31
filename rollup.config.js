import typescript from 'rollup-plugin-typescript2';

export default ([
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/es2015/index.js',
      format: 'es'
    },
    plugins: [
      typescript({
        useTsconfigDeclarationDir: true,
        tsconfigOverride: {
          compilerOptions: {
            target: 'es2015'
          },
          include: ['src']
        },
        cacheRoot: '.rollupcache'
      })
    ]
  }
].concat(process.env.NODE_ENV !== 'production'
  ? []
  : [{
    input: 'src/index.ts',
    output: [
      { file: 'dist/commonjs/index.js', format: 'cjs' },
      { file: 'dist/amd/index.js', format: 'amd', amd: { id: 'aurelia-typed-observable-plugin' } },
      { file: 'dist/native-modules/index.js', format: 'es' }
    ],
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: {
            declaration: false,
            declarationDir: null
          }
        },
        cacheRoot: '.rollupcache',
      })
    ]
  }]
));

