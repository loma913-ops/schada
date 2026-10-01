const fs = require('fs');

const harPath = 'C:/Users/lm913/Downloads/schada.org.har';
const data = JSON.parse(fs.readFileSync(harPath, 'utf8'));
const entries = data.log.entries.filter(e => e.request.url.includes('firestore.googleapis.com'));

const endpointCounts = {};
entries.forEach((e) => {
  const url = new URL(e.request.url);
  const path = url.pathname;
  endpointCounts[path] = (endpointCounts[path] || 0) + 1;
});

console.log('Firestore path breakdown:');
console.log(JSON.stringify(endpointCounts, null, 2));

console.log('\nDetailed request summary:');
entries.forEach((e, idx) => {
  const url = new URL(e.request.url);
  console.log(`[${idx+1}] ${e.startedDateTime} | ${e.request.method} ${url.pathname} | status: ${e.response.status} | time: ${Math.round(e.time)}ms`);
  if (e.request.postData && e.request.postData.text) {
    const text = e.request.postData.text;
    console.log('   Payload:', text.substring(0, 300).replace(/\n/g, ' '));
  }
  if (e.response.content && e.response.content.text) {
    const resText = e.response.content.text;
    console.log('   Response snippet:', resText.substring(0, 200).replace(/\n/g, ' '));
  }
});
