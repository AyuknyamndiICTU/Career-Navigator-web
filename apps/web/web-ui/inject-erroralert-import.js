const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(path.join(__dirname, 'src/app'), (filePath) => {
  if (!filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('<ErrorAlert') && !content.includes('import ErrorAlert')) {
    // Find the last import line
    let lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, "import ErrorAlert from '@/components/ErrorAlert';");
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      console.log(`Injected ErrorAlert import into ${filePath}`);
    } else {
      console.log(`Warning: No imports found in ${filePath}, cannot inject safely.`);
    }
  }
});
