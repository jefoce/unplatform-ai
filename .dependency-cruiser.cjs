/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Import cycles break module init order and hide design problems.',
      from: {},
      to: { circular: true, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'core-is-pure',
      severity: 'error',
      comment: 'src/core imports only src/core and packages.',
      from: { path: '^src/core/' },
      to: { path: '^src/(server|features|lib|ui|app)/' },
    },
    {
      name: 'server-stays-server',
      severity: 'error',
      comment: 'src/server never imports UI or client helpers.',
      from: { path: '^src/server/' },
      to: { path: '^src/(features|ui|lib)/' },
    },
    {
      name: 'client-never-imports-server',
      severity: 'error',
      from: { path: '^src/(features|ui|lib)/' },
      to: { path: '^src/server/' },
    },
    {
      name: 'ui-is-generic',
      severity: 'error',
      comment: 'src/ui and src/lib know nothing about features.',
      from: { path: '^src/(ui|lib)/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'tauri-only-in-platform',
      severity: 'error',
      from: { pathNot: '^src/lib/platform/desktop\\.ts$' },
      to: { path: '@tauri-apps' },
    },
    {
      name: 'node-builtins-only-on-server',
      severity: 'error',
      comment: 'Client and core code run in the webview.',
      from: { path: '^src/(features|ui|lib|core)/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-dev-deps-in-app',
      severity: 'error',
      comment:
        'ffmpeg-static is dev-only and loaded behind a NODE_ENV check (src/server/media/ffmpeg.ts).',
      from: { path: '^src/' },
      to: {
        dependencyTypes: ['npm-dev'],
        pathNot: 'node_modules/(@types/|ffmpeg-static/)',
      },
    },
    {
      name: 'feature-cycles',
      severity: 'warn',
      comment: 'Two features importing each other. Move the shared part to core, lib or ui.',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: '^src/features/$1/',
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(\\.next|src-tauri|docs|tests/fixtures)/' },
    // Runtime graph only: cycles and layers depend on emitted imports, not on types.
    tsPreCompilationDeps: false,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
}
