import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const rootDist = path.join(root, 'dist');
const clientDist = path.join(root, 'client', 'dist');

// If root dist exists, copy to client/dist (for Firebase)
if (fs.existsSync(rootDist)) {
  fs.cpSync(rootDist, clientDist, { recursive: true });
} else if (fs.existsSync(clientDist)) {
  fs.cpSync(clientDist, rootDist, { recursive: true });
}

console.log('✓ Synchronized dist and client/dist folders');
