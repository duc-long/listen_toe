const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');
// Split by literal '\${' and join with '${'
c = c.split('\\${').join('${');
fs.writeFileSync('src/main.js', c);
console.log('Fixed main.js template literals');
