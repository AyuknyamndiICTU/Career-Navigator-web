const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') && !file.includes('ErrorAlert.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('c:/Career Navigator web/apps/web/web-ui/src');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const regex1 = /\{error && \(\s*<div[^>]*bg-red-50[^>]*>\s*\{error\}\s*<\/div>\s*\)\}/g;
  if (regex1.test(content)) {
    content = content.replace(regex1, '<ErrorAlert error={error} />');
    changed = true;
  }
  
  const regex2 = /error \? \(\s*<div[^>]*bg-red-50[^>]*>\s*\{error\}\s*<\/div>\s*\) : /g;
  if (regex2.test(content)) {
    content = content.replace(regex2, 'error ? <ErrorAlert error={error} /> : ');
    changed = true;
  }

  // A specific one for jobs page
  const regex3 = /<div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">\s*\{error\}\s*<\/div>/g;
  if (regex3.test(content)) {
    content = content.replace(regex3, '<ErrorAlert error={error} className="mt-4" />');
    changed = true;
  }

  if (changed) {
    if (!content.includes('import ErrorAlert')) {
      content = content.replace(/(import [^\n]+;\n)+/, match => match + "import ErrorAlert from '@/components/ErrorAlert';\n");
    }
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
