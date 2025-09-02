"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("../../../../packages/core");
const shared_1 = require("../../../../packages/shared");
const replyComment_1 = require("./utils/replyComment");
let shouldStop = false;
let shuttingDown = false;
async function launch(Bot, runInBackground = false) {
    const profile = (0, shared_1.getChromeProfile)(core_1.BotService.getBotProfileName(Bot.id));
    const browser = await (0, shared_1.BrowserLauncher)(profile, runInBackground);
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
async function startTaskRunnerLoop(interval = 60) {
    interval = interval * 1000;
    shared_1.logger.info("TaskRunner started.", 'task-runner');
    while (!shouldStop) {
        const setting = await core_1.SettingService.getSetting();
        const BotStatus = 'running'; //setting.bot_status;
        const PostInterval = (setting?.post_interval ?? 5) * 1000;
        const PostPerDay = setting?.post_per_day ?? 5;
        if (BotStatus === "running") {
            try {
                let startTime = Date.now();
                let Bot = await core_1.BotService.getIdleBot();
                if (!Bot) {
                    throw new Error(`No active bot available kindly activate a bot first`);
                }
                const runInBackground = setting.run_in_background;
                let videoQue = await core_1.VideoService.listVideoQueue(1, 20);
                if (videoQue.total < 1) {
                    shared_1.logger.info('No video in video queue', 'task-runner');
                    await (0, shared_1.sleep)(interval);
                    continue;
                }
                let browser_page = await launch(Bot, runInBackground);
                let browser = browser_page.browser;
                let Page = browser_page.Page;
                let nextPage = 1;
                let PostCommentedOn = 0;
                let videos = null;
                while (nextPage <= videoQue.pages && PostCommentedOn < PostPerDay) {
                    videos = videoQue.data;
                    for (const video of videos) {
                        //if bot has been running for over 1 hour close the browser
                        //and switch account
                        if ((startTime + (60 * 60)) > Date.now()) {
                            await browser.close();
                            Bot = await core_1.BotService.getIdleBot();
                            browser_page = await launch(Bot, runInBackground);
                            browser = browser_page.browser;
                            Page = browser_page.Page;
                        }
                        try {
                            try {
                                await (0, replyComment_1.replyComment)(Page, setting, video.link);
                            }
                            catch (error) {
                                const banDetected = await Page.evaluate(() => {
                                    const text = document.body.innerText.toLowerCase();
                                    const keywords = ['account banned', 'suspended', 'violated our community guidelines'];
                                    return keywords.some(keyword => text.includes(keyword));
                                });
                                if (banDetected) {
                                    core_1.ActivityService.addActivity({
                                        description: `Error commenting on video: the bot account ${Bot.name} has been banned`,
                                        video_link: video.link,
                                        status: 'success'
                                    });
                                    await core_1.BotService.updateBotHealth(Bot.id, 'banned');
                                }
                                else {
                                    // More reliably, check the entire page content for keywords
                                    const bodyText = await Page.evaluate(() => document.body.textContent);
                                    const banKeywords = ['banned', 'suspended', 'violated our community guidelines'];
                                    if (banKeywords.some(keyword => bodyText.toLowerCase().includes(keyword))) {
                                        core_1.ActivityService.addActivity({
                                            description: 'Error commenting on video the bot account ' + Bot.name + ' has been banned',
                                            video_link: video.link,
                                            status: 'success'
                                        });
                                        await core_1.BotService.updateBotHealth(Bot.id, 'banned');
                                    }
                                }
                                throw error;
                            }
                            core_1.ActivityService.addActivity({ description: 'Done replying comments on video', video_link: video.link, status: 'success' });
                        }
                        catch (error) {
                            shared_1.logger.error(`error occured while trying to reply to comments on video [${video.link}], error: ${error.message}`, 'task-runner');
                            core_1.ActivityService.addActivity({ description: 'Something went wrong while trying to reply to comments on video', video_link: video.link, status: 'failed' });
                        }
                        shared_1.logger.info(`Done Commenting on video: ${video.link}`, 'task-runner');
                        PostCommentedOn++;
                        core_1.VideoService.removeVideoFromQueue(video.id);
                        await core_1.BotService.setLastUsedBot(Bot.id);
                        await (0, shared_1.sleep)(PostInterval);
                    }
                    ;
                    videoQue = await core_1.VideoService.listVideoQueue(nextPage + 1, 20);
                    nextPage++;
                }
                await browser.close();
            }
            catch (error) {
                shared_1.logger.error("Error in TaskRunner loop:", 'task-runner', error);
            }
        }
        await (0, shared_1.sleep)(interval);
    }
    shared_1.logger.info("TaskRunner exiting loop...", 'task-runner');
    await core_1.db.destroy();
    shared_1.logger.info("DB connection closed. Exiting.", 'task-runner');
    process.exit(0);
}
function setupGracefulExit() {
    const stop = () => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        shared_1.logger.info("Received shutdown signal...", 'task-runner');
        shouldStop = true;
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    process.on("unhandledRejection", (err) => {
        shared_1.logger.error("Unhandled rejection:", 'task-runner', err);
        stop();
    });
    process.on("uncaughtException", (err) => {
        shared_1.logger.error("Uncaught exception:", 'task-runner', err);
        stop();
    });
}
setupGracefulExit();
startTaskRunnerLoop().catch(async (err) => {
    shared_1.logger.error("Fatal error in taskrunner: " + err.message, 'task-runner', err);
    await core_1.db.destroy();
    process.exit(1);
});
//# sourceMappingURL=index.js.map