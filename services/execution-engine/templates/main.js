// Node.js 22 starter template. Read all stdin, write to stdout.
const data = require('node:fs').readFileSync(0, 'utf8').trim().split(/\s+/);
if (data.length >= 2) {
  console.log(Number(data[0]) + Number(data[1]));
}
