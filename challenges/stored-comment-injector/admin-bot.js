// Admin Bot - Simulates admin visiting the comment board
// Requires: npm install puppeteer

const puppeteer = require('puppeteer');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8000';
const VISIT_INTERVAL = parseInt(process.env.VISIT_INTERVAL || '30000'); // 30 seconds

async function visitAsAdmin() {
  console.log(`[${new Date().toISOString()}] Admin bot starting visit...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    console.log('  → Initializing admin bot...');

    // Visit initialization URL to receive secret into localStorage
    await page.goto(`${TARGET_URL}/?admin_bot=true`, {
      waitUntil: 'networkidle0',
      timeout: 20000
    });

    // Wait for localStorage to be set
    await page.waitForTimeout(2000);

    // Check if secret was stored
    const secret = await page.evaluate(() => {
      return localStorage.getItem('admin_secret');
    });

    if (secret) {
      console.log(`  ✓ Admin secret stored: ${secret.substring(0, 10)}...`);
    } else {
      console.log('  ✗ Warning: Admin secret not found in localStorage');
    }

    console.log('  → Visiting main page to review comments...');
    // Visit the main page (where XSS payloads will execute)
    await page.goto(TARGET_URL, {
      waitUntil: 'networkidle0',
      timeout: 20000
    });

    // Stay on page for a bit (let any XSS execute)
    await page.waitForTimeout(3000);

    console.log('  ✓ Visit completed');

  } catch (error) {
    console.error(`  ✗ Error during visit: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  console.log('=================================');
  console.log('CTF Admin Bot Started');
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Interval: ${VISIT_INTERVAL}ms`);
  console.log('=================================\n');

  // Initial visit
  await visitAsAdmin();

  // Schedule regular visits
  setInterval(async () => {
    await visitAsAdmin();
  }, VISIT_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nAdmin bot shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nAdmin bot shutting down...');
  process.exit(0);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
