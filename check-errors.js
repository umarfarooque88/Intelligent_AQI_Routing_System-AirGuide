const { chromium } = require('playwright');

async function checkErrors() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleMessages = [];
  const errors = [];
  const failedRequests = [];
  
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      errors.push(text);
    }
  });
  
  page.on('pageerror', err => {
    errors.push(`Page Error: ${err.message}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  try {
    await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);
    
    console.log('=== Console Messages ===');
    consoleMessages.forEach(m => {
      console.log(`[${m.type.toUpperCase()}] ${m.text}`);
    });
    
    console.log('\n=== Errors Only ===');
    errors.forEach(e => console.log(e));
    
    console.log('\n=== Failed Requests ===');
    failedRequests.forEach(r => {
      console.log(`[${r.status}] ${r.url}`);
    });
    
    if (errors.length === 0) {
      console.log('No console errors found!');
    }
    
    const title = await page.title();
    console.log('\nPage Title:', title);
    
    const bodyContent = await page.evaluate(() => document.body.innerHTML.length);
    console.log('Body content length:', bodyContent);
    
  } catch (err) {
    console.error('Navigation error:', err.message);
  }
  
  await browser.close();
}

checkErrors();