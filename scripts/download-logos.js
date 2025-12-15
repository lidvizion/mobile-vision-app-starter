#!/usr/bin/env node

/**
 * Script to download official logos for AI models
 * Run with: node scripts/download-logos.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const logosDir = path.join(process.cwd(), 'public', 'logos');

// Ensure logos directory exists
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

// Logo URLs - Update these with actual official logo URLs
const logos = [
  {
    name: 'anthropic-claude.svg',
    url: 'https://www.anthropic.com/favicon.ico', // Placeholder - replace with actual SVG URL
    description: 'Anthropic Claude logo'
  },
  {
    name: 'openai-logo.svg',
    url: 'https://openai.com/favicon.ico', // Placeholder - replace with actual SVG URL
    description: 'OpenAI logo'
  },
  {
    name: 'xai-grok.svg',
    url: 'https://x.ai/favicon.ico', // Placeholder - replace with actual SVG URL
    description: 'xAI Grok logo'
  }
];

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        file.close();
        fs.unlinkSync(filepath);
        downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      } else {
        file.close();
        fs.unlinkSync(filepath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

async function downloadLogos() {
  console.log('Downloading logos...\n');
  
  for (const logo of logos) {
    const filepath = path.join(logosDir, logo.name);
    try {
      console.log(`Downloading ${logo.description}...`);
      await downloadFile(logo.url, filepath);
      console.log(`✓ Downloaded ${logo.name}\n`);
    } catch (error) {
      console.error(`✗ Failed to download ${logo.name}: ${error.message}\n`);
    }
  }
  
  console.log('Done! Please verify the downloaded logos.');
}

downloadLogos();

