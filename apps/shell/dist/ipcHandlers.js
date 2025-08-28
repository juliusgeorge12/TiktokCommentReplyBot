"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
// ipcHandlers.ts
const electron_1 = require("electron");
const core_1 = require("../../../packages/core");
const activateBot_1 = require("./utils/activateBot");
const deactivateBot_1 = require("./utils/deactivateBot");
const processManager_1 = require("./processManager");
const checkRequirements_1 = require("./utils/checkRequirements");
const fetchVideo_1 = require("./utils/fetchVideo");
function registerIpcHandlers() {
    electron_1.ipcMain.handle('bot:get-status', async () => {
        return await core_1.SettingService.getBotStatus();
    });
    electron_1.ipcMain.handle('bot:activate', async (_event, botId) => {
        await (0, activateBot_1.activateBot)(botId);
    });
    electron_1.ipcMain.handle('bot:deactivate', async (_event, botId) => {
        return await (0, deactivateBot_1.deactivateBot)(botId);
    });
    electron_1.ipcMain.handle('bot:list', async () => {
        return await core_1.BotService.listBot();
    });
    electron_1.ipcMain.handle('bot:add', async (_event, payload) => {
        return await core_1.BotService.createBot(payload);
    });
    electron_1.ipcMain.handle('bot:get', async (_event, id) => {
        return await core_1.BotService.getBot(id);
    });
    electron_1.ipcMain.handle('bot:edit', async (_event, id, payload) => {
        return await core_1.BotService.editBot(id, payload);
    });
    electron_1.ipcMain.handle('bot:delete', async (_event, id) => {
        return await core_1.BotService.deleteBot(id);
    });
    electron_1.ipcMain.handle('setting:update', async (_event, payload) => {
        return await core_1.SettingService.updateGeneralSetting(payload);
    });
    electron_1.ipcMain.handle('setting', async (_event, setting, payload) => {
        return await core_1.SettingService.getSetting();
    });
    electron_1.ipcMain.handle('activities:list', async () => {
        return await core_1.ActivityService.list();
    });
    electron_1.ipcMain.handle('activities:clear', async () => {
        return await core_1.ActivityService.clearActivities();
    });
    electron_1.ipcMain.handle('hashtag:add', async (_event, payload) => {
        return await core_1.HashTagService.addHashtag(payload);
    });
    electron_1.ipcMain.handle('hashtag:list', async () => {
        return await core_1.HashTagService.listHashtags();
    });
    electron_1.ipcMain.handle('hashtag:delete', async (_event, id) => {
        return await core_1.HashTagService.deleteHashtag(id);
    });
    electron_1.ipcMain.handle('hashtag:clear', async () => {
        return await core_1.HashTagService.clearHashtags();
    });
    electron_1.ipcMain.handle('comment:list', async () => {
        return await core_1.CommentService.listComment();
    });
    electron_1.ipcMain.handle('comment:get', async (_event, id) => {
        return await core_1.CommentService.getComment(id);
    });
    electron_1.ipcMain.handle('comment:add', async (_event, payload) => {
        return await core_1.CommentService.addComment(payload);
    });
    electron_1.ipcMain.handle('comment:delete', async (_event, id) => {
        return await core_1.CommentService.deleteComment(id);
    });
    electron_1.ipcMain.handle('comment:edit', async (_event, id, payload) => {
        return await core_1.CommentService.editComment(id, payload);
    });
    electron_1.ipcMain.handle('pending-videos:list', async () => {
        return await core_1.VideoService.listPendingVideos();
    });
    electron_1.ipcMain.handle('video:queue:add', async (_event, payload) => {
        if (!Array.isArray(payload)) {
            //parse the string by splitting by new lines or commas
            payload = payload.split(/[\n,]+/).map(link => link.trim()).filter(link => link.length > 0);
        }
        return await core_1.VideoService.queueVideos(payload);
    });
    electron_1.ipcMain.handle('video:queue:clear', async () => {
        return await core_1.VideoService.clearVideoQueue();
    });
    electron_1.ipcMain.handle('video:fetch', async (_event, hashtagId, maxVideos) => {
        let hashtag = (await core_1.HashTagService.getHashtagById(hashtagId))?.text ?? 'funnycats';
        const setting = await core_1.SettingService.getSetting();
        const max_auto_find_videos = setting.max_auto_find_videos;
        maxVideos = maxVideos >= max_auto_find_videos ? max_auto_find_videos : maxVideos;
        //remove the # from the beginining of the hashtag
        if (typeof hashtag === 'string' && hashtag.startsWith('#')) {
            hashtag = hashtag.slice(1);
        }
        return await (0, fetchVideo_1.fetchVideo)(hashtag, maxVideos, setting.run_in_background ?? true);
    });
    electron_1.ipcMain.handle('pending-videos:approve', async (_event, id) => {
        return await core_1.VideoService.approvePendingVideo(id);
    });
    electron_1.ipcMain.handle('pending-videos:remove', async (_event, id) => {
        return await core_1.VideoService.removePendingVideo(id);
    });
    electron_1.ipcMain.handle('metrics', async () => {
        return {
            'bot': await core_1.BotService.botCount(),
            'video_commented_on': await core_1.PostService.getPostCount(),
            'unapproved_videos': await core_1.VideoService.pendingVideoCount(),
            'pending_videos': await core_1.VideoService.videoQueueCount(),
        };
    });
    electron_1.ipcMain.handle('header:status', async () => {
        return {
            bot_status: await core_1.SettingService.getBotStatus(),
            background_status: await core_1.SettingService.runInBackgroundMode(),
            test_mode: await core_1.SettingService.runInTestMode()
        };
    });
    electron_1.ipcMain.handle('run-in-test-mode', async (_event, bool) => {
        await core_1.SettingService.useTestMode(bool);
    });
    electron_1.ipcMain.handle('run-in-background-mode', async (_event, bool) => {
        await core_1.SettingService.useBackgroundMode(bool);
    });
    electron_1.ipcMain.handle('bot:start', async () => {
        try {
            if ((await (0, checkRequirements_1.checkRequirements)())) {
                const previousBotStatus = await core_1.SettingService.getBotStatus();
                if (previousBotStatus == 'stopped') {
                    processManager_1.ProcessManager.start('task-runner', 'task-runner');
                }
                await core_1.SettingService.updateBotStatus('running');
            }
        }
        catch (error) {
            throw error;
        }
    });
    electron_1.ipcMain.handle('bot:pause', async () => {
        await core_1.SettingService.updateBotStatus('paused');
    });
    electron_1.ipcMain.handle('bot:stop', async () => {
        //TODO: implement logic for stopping background task-scheduler and task-runner
        processManager_1.ProcessManager.stop('task-runner');
        await core_1.SettingService.updateBotStatus('stopped');
    });
}
