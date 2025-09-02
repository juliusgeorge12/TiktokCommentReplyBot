import { BotAccount, BotService, VideoService } from '../../../../packages/core';
import { Browser, ChromeProfile, BrowserLauncher, getChromeProfile, sleep, logger} from "../../../../packages/shared";
import type { ElementHandle } from "puppeteer";
import { waitForNewItems } from './waitForNewItems';

export async function fetchVideo(hashtag: string, maxVideos: number, runInBackground: boolean = true) {
    let browser: Browser | null = null;
    try {
        const Bot: BotAccount | undefined = await BotService.getIdleBot();
        if (!Bot) {
            throw new Error(`No active bot available kindly activate a bot first`);
        }

        const profile: ChromeProfile = getChromeProfile(BotService.getBotProfileName(Bot.id));
        browser = await BrowserLauncher(profile, runInBackground);
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
        await Page.waitForSelector('div[data-e2e="challenge-item-list"]', {timeout: 20000});
        const challengeItemList = await contentChallenge.$('div[data-e2e="challenge-item-list"]');
        if (!challengeItemList) {
            throw new Error('Challenge item list not found.');
        }
        await sleep(2000);
        //contentChallenge.
        const findNextChallengeElement = async (current: ElementHandle<HTMLElement>): Promise<ElementHandle<HTMLDivElement> | null> => {
            if (!current) return null;
            let next = await current.evaluateHandle(el => (el as Element).nextElementSibling);
            let nextEl = next.asElement();
            let attempts = 0;
            const MAX_ATTEMPTS = 100;
            while (nextEl && attempts++ < MAX_ATTEMPTS) {
                const hasChallengeElement = await nextEl.$('div[data-e2e="challenge-item"]');
                if (hasChallengeElement) {
                    return hasChallengeElement as ElementHandle<HTMLDivElement>;
                }

                next = await nextEl.evaluateHandle(el => (el as Element).nextElementSibling);
                nextEl = next.asElement();
            }
            return null;
        };
        let pendingVideos: string[] = [];
        let challengeElement = await challengeItemList.$('div[data-e2e="challenge-item"]');
        let batchItems = 30;
        let processCounter = 0;
        while (challengeElement && pendingVideos.length < maxVideos) {
            await challengeElement.scrollIntoView();
            const videoLink = await challengeElement.$('a[href*="/video/"]');
            if (videoLink) {
                const href = await videoLink.evaluate(el => el.href);
                if( !(await VideoService.videoHasBeenFetched(href))) {
                    pendingVideos.push(href);
                    await VideoService.addFetchedVideo(href);
                }
            }
            const parentElement = await challengeElement.evaluateHandle(el => (el as Element).parentElement);
            processCounter++;
            if (processCounter === batchItems) {
                processCounter = 0;
                await Page.evaluate(() => {
                    window.scrollBy({ 
                        top: window.innerHeight, 
                        behavior: 'smooth' 
                    });
                });
                batchItems = (await waitForNewItems(Page, 'div[data-e2e="challenge-item"]', 10000)).length;
            }
            challengeElement = await findNextChallengeElement(parentElement as ElementHandle<HTMLElement>);
            //await sleep(5000);
        }
        await VideoService.addPendingVideos(pendingVideos, hashtag);
        await browser.close();
    } catch (err) {
        if (browser) {
            try {
                await browser.close();
            } catch (closeErr) {
                console.error(`[activateBot] Failed to close browser:`, closeErr);
            }
        }
        console.error(`failed to fetch videos: `, err);
        logger.error(`Error fetching videos bot: ${err}`);
        throw new Error(`Error fetching videos bot. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
}