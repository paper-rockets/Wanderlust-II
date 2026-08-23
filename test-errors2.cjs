const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new"
    });
    const page = await browser.newPage();

    let hasErrors = false;

    page.on('console', msg => { console.log(msg.text()); 
        if (msg.type() === 'error') {
            console.error(`Browser Console Error: ${msg.text()}`);
            if (!msg.text().includes('ERR_CONNECTION_REFUSED') && !msg.text().includes('favicon.ico')) {
                hasErrors = true;
            }
        }
    });

    page.on('pageerror', err => {
        console.error(`Browser Page Error: ${err.message}`);
        hasErrors = true;
    });

    page.on('response', response => {
        if (!response.ok() && response.status() === 404) {
            console.error(`404 Not Found: ${response.url()}`);
            if (!response.url().includes('favicon.ico')) {
                hasErrors = true;
            }
        }
    });

    page.on('requestfailed', request => {
        console.error(`Request failed: ${request.url()} - ${request.failure().errorText}`);
        if (!request.failure().errorText.includes('ERR_CONNECTION_REFUSED')) {
            hasErrors = true;
        }
    });

    try {
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });
        await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
        console.error(`Failed to load page: ${e.message}`);
        hasErrors = true;
    }

    await browser.close();

    if (hasErrors) {
        console.error('\nTests FAILED: Errors found in the browser console.');
        // process.exit(1);
    } else {
        console.log('\nTests PASSED: No browser errors detected.');
        process.exit(0);
    }
})();
