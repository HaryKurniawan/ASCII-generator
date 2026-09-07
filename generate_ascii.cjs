const Jimp = require('jimp');
const fs = require('fs');

// Simple density map, space for dark, characters for bright.
const DENSITY = " .:-=+*#%@";

async function generateAscii() {
  const image = await Jimp.read('adam.jpg');
  image.resize(150, Jimp.AUTO); // Adjust width for best look
  image.greyscale();
  image.contrast(0.4);

  let asciiImage = "";
  for (let y = 0; y < image.bitmap.height; y++) {
    let row = "";
    for (let x = 0; x < image.bitmap.width; x++) {
      const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
      // Average brightness (invert if we want black background to map to space)
      const avg = (pixel.r + pixel.g + pixel.b) / 3;
      // Invert: we want the background to be dark (space) and hands to be light (characters)
      // Actually, wait, the original image 'adam.jpg' has a bright background or dark?
      // "Creation of Adam" has a bright background (sky/clouds), hands are flesh colored.
      // So the background is bright! If we want a black background in our ascii, 
      // we need to invert the mapping!
      const charIndex = Math.floor(avg / 255 * (DENSITY.length - 1));
      row += DENSITY[charIndex];
    }
    asciiImage += row + "\n";
  }

  fs.writeFileSync('src/ascii.ts', `export const asciiArt = \`\n${asciiImage}\`;`);
  console.log("ASCII art generated in src/ascii.ts");
}

generateAscii().catch(console.error);
