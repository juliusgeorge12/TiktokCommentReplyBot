"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateBot = activateBot;
const core_1 = require("../../../../packages/core");
const shared_1 = require("../../../../packages/shared");
async function activateBot(botId) {
    let browser = null;
    try {
        const Bot = await core_1.BotService.getBot(botId);
        if (!Bot) {
            throw new Error(`Bot account with id: ${botId} not found`);
        }
        const profile = (0, shared_1.getChromeProfile)(core_1.BotService.getBotProfileName(botId));
        browser = await (0, shared_1.BrowserLauncher)(profile, false);
        const Pages = await browser.pages();
        const Page = Pages.length > 0 ? Pages[0] : await browser.newPage();
        // Navigate to Facebook
        await Page.goto('https://www.tiktok.com/tag/funnycats', { waitUntil: 'networkidle2', timeout: 0 });
        // Check if user is logged in
        const cookies = await browser.cookies();
        const isLoggedIn = cookies.some(cookie => cookie.name.includes('sessionid'));
        if (!isLoggedIn) {
            // Redirect to login page
            await Page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'networkidle2', timeout: 0 });
            // Wait for username input
            await Page.waitForSelector('input[name="username"]', { timeout: 10000 });
            await Page.type('input[name="username"]', Bot.email ?? '', { delay: 50 });
            // Wait for password input
            try {
                await Page.waitForSelector('input[autocomplete="new-password"]', { timeout: 10000 });
                await Page.type('input[autocomplete="new-password"]', Bot.password ?? '', { delay: 50 });
            }
            catch {
                console.log("autocomplete selector not found, falling back to placeholder...");
                await Page.waitForSelector('input[placeholder="Password"]', { timeout: 10000 });
                await Page.type('input[placeholder="Password"]', Bot.password ?? '', { delay: 50 });
            }
            // Wait for login button to be enabled
            await Page.waitForSelector('button[data-e2e="login-button"]:not([disabled])', { timeout: 10000 });
            // Click login
            await Page.click('button[data-e2e="login-button"]');
            await Page.waitForNavigation({ timeout: 0 });
            let hasLoggedIn = await Page.evaluate(() => {
                return document.cookie.includes('sessionid=');
            });
            while (!hasLoggedIn) {
                await Page.waitForNavigation({ timeout: 0 });
                hasLoggedIn = await Page.evaluate(() => {
                    return document.cookie.includes('sessionid=');
                });
            }
        }
        await (0, shared_1.sleep)(5000);
        await browser.close();
        await core_1.BotService.updateBotStatus(botId, 'active');
    }
    catch (err) {
        if (browser) {
            try {
                await browser.close();
            }
            catch (closeErr) {
                console.error(`[activateBot] Failed to close browser:`, closeErr);
            }
        }
        console.error(`[activateBot] Error:`, err);
        shared_1.logger.error(`[activateBot] Error activating bot with id ${botId}: ${err}`);
        throw new Error(`Failed to activate bot with id: ${botId}. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
}
