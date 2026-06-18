const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(srcDir);
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('@/')) {
        // Calculate relative path to src
        const relToSrc = path.relative(path.dirname(file), srcDir).replace(/\\/g, '/');
        const prefix = relToSrc === '' ? '.' : relToSrc;
        
        // Replace all @/ with prefix/
        // E.g., @/components/foo -> ../../components/foo
        const newContent = content.replace(/@\//g, prefix + '/');
        
        if (content !== newContent) {
            fs.writeFileSync(file, newContent, 'utf8');
            changedCount++;
            console.log(`Fixed aliases in ${path.relative(__dirname, file)} -> prefix used: ${prefix}`);
        }
    }
});

console.log(`Successfully fixed aliases in ${changedCount} files!`);
