const https = require('https');
const fs = require('fs');

// High res cropped hands
const url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg/800px-Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg';

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
     https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res2) => {
        const file = fs.createWriteStream('public/adam_painting.jpg');
        res2.pipe(file);
        file.on('finish', () => console.log('Downloaded redirected'));
     });
  } else {
    const file = fs.createWriteStream('public/adam_painting.jpg');
    res.pipe(file);
    file.on('finish', () => console.log('Downloaded directly'));
  }
});
