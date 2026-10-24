// 사용: node mkpatch.js patch.json [base]  → 반영 링크 출력
const fs = require('fs'); const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
p.kind = 'money-patch'; p.id = p.id || ('p' + Date.now().toString(36));
const b = Buffer.from(JSON.stringify(p), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.log((process.argv[3] || 'https://onnonlee.github.io/financial-dashboard/') + '#/apply?d=' + b);
