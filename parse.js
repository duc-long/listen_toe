const fs = require('fs');

const content = fs.readFileSync('transcript.md', 'utf8');
const lines = content.split(/\r?\n/);

const data = { tests: [] };
let currentTest = null;
let currentPart = null;

let tempText = "";

for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    // Strip markdown formatting if any
    line = line.replace(/^```/, '');
    if (!line) continue;
    if (line === 'STT Transcript Đáp' || line === 'án' || line === 'Dịch nghĩa tiếng Việt') continue;

    const testMatch = line.match(/^### SCRIPT AND KEY LC TEST (\d+)/);
    if (testMatch) {
        currentTest = { id: parseInt(testMatch[1]), parts: [] };
        data.tests.push(currentTest);
        continue;
    }

    const partMatch = line.match(/^### PART (\d+)/);
    if (partMatch) {
        if (!currentTest) {
            currentTest = { id: 1, parts: [] };
            data.tests.push(currentTest);
        }
        currentPart = { id: parseInt(partMatch[1]), content: [] };
        currentTest.parts.push(currentPart);
        continue;
    }
    
    if (currentPart) {
        tempText += line + "\n";
    }
}

// Write the raw blocks to a debug file to see if we grabbed text correctly
fs.writeFileSync('debug_parse.json', JSON.stringify(data, null, 2));
console.log('Saved debug_parse.json with test and part structure.');
