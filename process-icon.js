import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source and output paths
const sourceImage = 'C:\\Users\\matts\\Videos\\touchgrasskickass.png';
const outputDir = __dirname;

// Icon configurations
const icons = [
  { name: 'icon.png', size: 512 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'favicon.ico', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 }
];

async function generateIcons() {
  try {
    // Check if source image exists
    try {
      await fs.access(sourceImage);
    } catch (err) {
      console.error(`Source image not found at: ${sourceImage}`);
      console.error('Please make sure the image exists at the specified path.');
      process.exit(1);
    }

    console.log('Generating icons...');
    
    // Create each icon
    for (const icon of icons) {
      const outputPath = path.join(outputDir, icon.name);
      
      try {
        await sharp(sourceImage)
          .resize(icon.size, icon.size)
          .toFile(outputPath);
        
        console.log(`✓ Created ${icon.name} (${icon.size}x${icon.size})`);
      } catch (err) {
        console.error(`Error creating ${icon.name}:`, err.message);
      }
    }
    
    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the generation
generateIcons();
