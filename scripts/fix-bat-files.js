import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const files = fs.readdirSync(rootDir).filter(f => f.endsWith('.bat'));

files.forEach(file => {
  const filePath = path.join(rootDir, file);
  const raw = fs.readFileSync(filePath, 'utf8');
  // Normalize all line endings to CRLF
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, normalized, 'utf8');
  console.log(`Converted ${file} to CRLF`);
});

// Remove temporary test files
['test_run.bat', 'test_sync.bat', 'test_crlf.bat'].forEach(f => {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`Removed temporary ${f}`);
  }
});
