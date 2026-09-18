const fs = require('fs');
const { parseGIF, decompressFrames } = require('gifuct-js');

const buffer = fs.readFileSync('public/adam.jpg'); // just testing import
console.log("GIF library is ready");
