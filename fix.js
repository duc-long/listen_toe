const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');
c = c.replace(/\\\$\\{/g, '${');
fs.writeFileSync('src/main.js', c);
console.log('Fixed main.js');
