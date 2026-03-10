const fs = require('fs');
const path = require('path');

const distDir = path.join(process.cwd(), 'dist');

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));
