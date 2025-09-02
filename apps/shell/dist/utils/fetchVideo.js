"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchVideo = fetchVideo;
const core_1 = require("../../../../packages/core");
const shared_1 = require("../../../../packages/shared");
const waitForNewItems_1 = require("./waitForNewItems");
async function fetchVideo(hashtag, maxVideos, runInBackground = true) {
    let browser = null;
    try {
        const Bot = await core_1.BotService.getIdleBot();
        if (!Bot) {
            throw new Error(`No active bot available kindly activate a bot first`);
        }
        const profile = (0, shared_1.getChromeProfile)(core_1.BotService.getBotProfileName(Bot.id));
        browser = await (0, shared_1.BrowserLauncher)(profile, runInBackground);
        const Pages = await browser.pages();
        const Page = Pages.length > 0 ? Pages[0] : await browser.newPage();
        const defaultUA = await Page.browser().userAgent();
        // Override it if you want to remove "HeadlessChrome"
        await Page.setUserAgent(defaultUA.replace("HeadlessChrome", "Chrome"));
        // Navigate to the hashtag page
        await Page.goto(`https://www.tiktok.com/tag/${hashtag}?sort_field=1`, { waitUntil: 'networkidle2', timeout: 0 });
        const contentChallenge = await Page.$('div#main-content-challenge');
        if (!contentChallenge) {
            throw new Error('Content challenge not found.');
        }
        await Page.waitForSelector('div[data-e2e="challenge-item-list"]', { timeout: 20000 });
        const challengeItemList = await contentChallenge.$('div[data-e2e="challenge-item-list"]');
        if (!challengeItemList) {
            throw new Error('Challenge item list not found.');
        }
        await (0, shared_1.sleep)(2000);
        //contentChallenge.
        const findNextChallengeElement = async (current) => {
            if (!current)
                return null;
            let next = await current.evaluateHandle(el => el.nextElementSibling);
            let nextEl = next.asElement();
            let attempts = 0;
            const MAX_ATTEMPTS = 100;
            while (nextEl && attempts++ < MAX_ATTEMPTS) {
                const hasChallengeElement = await nextEl.$('div[data-e2e="challenge-item"]');
                if (hasChallengeElement) {
                    return hasChallengeElement;
                }
                next = await nextEl.evaluateHandle(el => el.nextElementSibling);
                nextEl = next.asElement();
            }
            return null;
        };
        let pendingVideos = [];
        let challengeElement = await challengeItemList.$('div[data-e2e="challenge-item"]');
        let batchItems = 30;
        let processCounter = 0;
        while (challengeElement && pendingVideos.length < maxVideos) {
            await challengeElement.scrollIntoView();
            const videoLink = await challengeElement.$('a[href*="/video/"]');
            if (videoLink) {
                const href = await videoLink.evaluate(el => el.href);
                if (!(await core_1.VideoService.videoHasBeenFetched(href))) {
                    pendingVideos.push(href);
                    await core_1.VideoService.addFetchedVideo(href);
                }
            }
            const parentElement = await challengeElement.evaluateHandle(el => el.parentElement);
            processCounter++;
            if (processCounter === batchItems) {
                processCounter = 0;
                await Page.evaluate(() => {
                    window.scrollBy({
                        top: window.innerHeight,
                        behavior: 'smooth'
                    });
                });
                batchItems = (await (0, waitForNewItems_1.waitForNewItems)(Page, 'div[data-e2e="challenge-item"]', 10000)).length;
            }
            challengeElement = await findNextChallengeElement(parentElement);
            //await sleep(5000);
        }
        await core_1.VideoService.addPendingVideos(pendingVideos, hashtag);
        await browser.close();
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
        console.error(`failed to fetch videos: `, err);
        shared_1.logger.error(`Error fetching videos bot: ${err}`);
        throw new Error(`Error fetching videos bot. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
}
