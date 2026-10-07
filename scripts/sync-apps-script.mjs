import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync(
  new URL('../shared/core.js', import.meta.url),
  'utf8',
);
writeFileSync(
  new URL('../apps-script/Core.gs', import.meta.url),
  '// Generated from shared/core.js by npm run sync:apps-script.\n' +
    source.replace(/^export /gm, ''),
);
