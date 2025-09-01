import { ActivityService, BotAccount, BotService, db, PaginatedResult, SettingService, VideoQueue, VideoService } from "../../../../packages/core";
import { Browser, BrowserLauncher, ChromeProfile, getChromeProfile, logger, sleep } from "../../../../packages/shared";
import { replyComment } from "./utils/replyComment";

let shouldStop = false;
let shuttingDown = false;

async function launch(Bot: BotAccount | undefined, runInBackground: boolean = false) {
    const profile: ChromeProfile = getChromeProfile(BotService.getBotProfileName(Bot.id));
    const browser: Browser = await BrowserLauncher(profile, runInBackground);
    const Pages = await browser.pages();
    const Page = Pages.length > 0 ? Pages[0] : await browser.newPage();
    const defaultUA = await Page.browser().userAgent();
    // Override it if you want to remove "HeadlessChrome"
    await Page.setUserAgent(defaultUA.replace("HeadlessChrome", "Chrome"));
    return {
        browser: browser,
        Page: Page
    };
}

async function startTaskRunnerLoop(interval: number = 60) {
    interval = interval * 1000;
    logger.info("TaskRunner started.", 'task-runner');
    while (!shouldStop) {
        const setting = await SettingService.getSetting();
        const BotStatus = 'running';//setting.bot_status;
        const PostInterval = (setting?.post_interval ?? 5) * 1000;
        const PostPerDay = setting?.post_per_day ?? 5;
        if (BotStatus === "running") {
            try {
                let startTime = Date.now()
                let Bot: BotAccount | undefined = await BotService.getIdleBot();
                if (!Bot) {
                    throw new Error(`No active bot available kindly activate a bot first`);
                }
                const runInBackground: boolean = setting.run_in_background;
                let videoQue: PaginatedResult<VideoQueue> = await VideoService.listVideoQueue(1, 20);
                if (videoQue.total < 1) {
                    logger.info('No video in video queue', 'task-runner');
                    await sleep(interval);
                    continue;
                }
                let browser_page = await launch(Bot, runInBackground);
                let browser = browser_page.browser;
                let Page = browser_page.Page;
                let nextPage = 1;
                let PostCommentedOn = 0;
                let videos: VideoQueue[] = null;
                
                while(nextPage <= videoQue.pages && PostCommentedOn < PostPerDay) {
                    videos = videoQue.data;
                    for (const video of videos) {
                        //if bot has been running for over 1 hour close the browser
                        //and switch account
                        if ((startTime + (60 * 60)) > Date.now()) {
                            await browser.close();
                            Bot = await BotService.getIdleBot();
                            browser_page = await launch(Bot, runInBackground);
                            browser = browser_page.browser;
                            Page = browser_page.Page;
                        }
                        try {
                            try {
                                await replyComment(Page, setting, video.link);
                            } catch (error) {
                                const banModal = await Page.$('div:has-text("Account banned")');
                                if (banModal) {
                                    ActivityService.addActivity(
                                        {
                                            description: 'Error commenting on video the bot account ' + Bot.name + ' has been banned',
                                            video_link: video.link,
                                            status: 'success'
                                        }
                                    );
                                    await BotService.updateBotHealth(Bot.id, 'banned');
                                } else {
                                    // More reliably, check the entire page content for keywords
                                    const bodyText = await Page.evaluate(() => document.body.textContent);
                                    const banKeywords = ['banned', 'suspended', 'violated our community guidelines'];
                                    if (banKeywords.some(keyword => bodyText.toLowerCase().includes(keyword))) {
                                        ActivityService.addActivity(
                                            {
                                                description: 'Error commenting on video the bot account ' + Bot.name + ' has been banned',
                                                video_link: video.link,
                                                status: 'success'
                                            }
                                        );
                                        await BotService.updateBotHealth(Bot.id, 'banned');
                                    }
                                }
                                throw error;
                            }
                            ActivityService.addActivity({description: 'Done replying comments on video', video_link: video.link, status: 'success'});
                        } catch (error) {
                            logger.error(`error occured while trying to reply to comments on video [${video.link}], error: ${error.message}`, 'task-runner');
                            ActivityService.addActivity({description: 'Something went wrong while trying to reply to comments on video', video_link: video.link, status: 'failed'});
                        }
                        logger.info(`Done Commenting on video: ${video.link}`, 'task-runner');
                        PostCommentedOn++;
                        VideoService.removeVideoFromQueue(video.id);
                        await BotService.setLastUsedBot(Bot.id);
                        await sleep(PostInterval);
                    };
                    videoQue = await VideoService.listVideoQueue(nextPage + 1, 20);
                    nextPage++;
                }
                await browser.close();
            } catch (error) {
                logger.error("Error in TaskRunner loop:", 'task-runner', error);
            }
        }
        await sleep(interval);
    }
    logger.info("TaskRunner exiting loop...", 'task-runner');
    await db.destroy();
    logger.info("DB connection closed. Exiting.", 'task-runner');
    process.exit(0);
}

function setupGracefulExit() {
    const stop = () => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info("Received shutdown signal...", 'task-runner');
        shouldStop = true;
    };

    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);

    process.on("unhandledRejection", (err) => {
        logger.error("Unhandled rejection:", 'task-runner', err);
        stop();
    });

    process.on("uncaughtException", (err) => {
        logger.error("Uncaught exception:", 'task-runner', err);
        stop();
    });
}

setupGracefulExit();

startTaskRunnerLoop().catch(async (err) => {
    logger.error("Fatal error in taskrunner: " + err.message, 'task-runner', err);
    await db.destroy();
    process.exit(1);
});
