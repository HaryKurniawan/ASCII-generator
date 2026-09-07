const https = require('https');
const fs = require('fs');

const url = 'https://i.pinimg.com/originals/82/58/e7/8258e7f864197c36a448106203cf36f2.jpg';

https.get(url, (res) => {
  const file = fs.createWriteStream('adam.jpg');
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Downloaded');
  });
});
