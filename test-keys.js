const fs = require('fs');

const data = JSON.parse(fs.readFileSync('src/data/tests.json', 'utf8'));

data.forEach(test => {
  let answers = {};
  let currentQ = 1;
  test.parts.forEach(part => {
     let lines = part.fullRawText.split('\n');
     for(let i=0; i<lines.length; i++) {
        let l = lines[i].trim();
        
        // Matches Part 1 & Part 3 & 4 answers: "### A" or "### 32(newline)### B"
        let m1 = l.match(/^###\s*([A-D])$/);
        if (m1) {
           answers[currentQ] = m1[1];
           currentQ++;
           continue;
        }
        
        // Matches Part 2: "B Có một công viên..."
        let m2 = l.match(/^([A-D])\s+[\p{Lu}Đ]/u);
        if (m2 && l.length > 5) {
           answers[currentQ] = m2[1];
           currentQ++;
           continue;
        }
     }
  });
  console.log(`Test ${test.id} parsed ${Object.keys(answers).length} answers.`);
});
