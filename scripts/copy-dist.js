import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const clientDist = path.join(root, 'client', 'dist');
const rootDist = path.join(root, 'dist');

// Always copy the freshly built client/dist to root dist
if (fs.existsSync(clientDist)) {
  fs.cpSync(clientDist, rootDist, { recursive: true });
  console.log('✓ Synchronized client/dist to root dist');
}
