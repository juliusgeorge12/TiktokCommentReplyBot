// ipcHandlers.ts
import { ipcMain } from 'electron';
import { BotService, SettingService, PostService, ActivityService, VideoService, HashTagService, CommentService } from '../../../packages/core';
import { activateBot } from './utils/activateBot';
import { deactivateBot } from './utils/deactivateBot';
import { ProcessManager } from './processManager';
import { checkRequirements } from './utils/checkRequirements';
import { fetchVideo } from './utils/fetchVideo';

export function registerIpcHandlers() {
  ipcMain.handle('bot:get-status', async () => {
    return await SettingService.getBotStatus();
  });

  ipcMain.handle('bot:activate', async (_event, botId: number) => {
    await activateBot(botId);
  });

  ipcMain.handle('bot:deactivate', async (_event, botId: number) => {
    return await deactivateBot(botId);
  });

  ipcMain.handle('bot:list', async () => {
    return await BotService.listBot();
  });

  ipcMain.handle('bot:add', async (_event, payload) => {
    return await BotService.createBot(payload);
  });

  ipcMain.handle('bot:get', async (_event, id) => {
    return await BotService.getBot(id);
  });

  ipcMain.handle('bot:edit', async (_event, id, payload) => {
    return await BotService.editBot(id, payload);
  });

  ipcMain.handle('bot:delete', async (_event, id: number) => {
    return await BotService.deleteBot(id);
  });

  ipcMain.handle('setting:update', async (_event, payload: object) => {
    return await SettingService.updateGeneralSetting(payload);
  });

  ipcMain.handle('setting', async (_event, setting: string, payload: object) => {
    return await SettingService.getSetting();
  });

  ipcMain.handle('activities:list', async () => {
    return await ActivityService.list();
  });

  ipcMain.handle('activities:clear', async () => {
    return await ActivityService.clearActivities();
  });

  ipcMain.handle('hashtag:add', async (_event, payload) => {
    return await HashTagService.addHashtag(payload);
  });

  ipcMain.handle('hashtag:list', async () => {
    return await HashTagService.listHashtags();
  });

  ipcMain.handle('hashtag:delete', async (_event, id: number) => {
    return await HashTagService.deleteHashtag(id);
  });

  ipcMain.handle('hashtag:clear', async () => {
    return await HashTagService.clearHashtags();
  });

  ipcMain.handle('comment:list', async () => {
    return await CommentService.listComment();
  });

  ipcMain.handle('comment:get', async (_event, id: number) => {
    return await CommentService.getComment(id);
  });

  ipcMain.handle('comment:add', async (_event, payload) => {
    return await CommentService.addComment(payload);
  });

  ipcMain.handle('comment:delete', async (_event, id: any) => {
    return await CommentService.deleteComment(id);
  });

  ipcMain.handle('comment:edit', async (_event, id: any, payload) => {
    return await CommentService.editComment(id, payload);
  });

  ipcMain.handle('pending-videos:list', async () => {
    return await VideoService.listPendingVideos();
  });

  ipcMain.handle('video:queue:add', async (_event, payload: string | string[]) => {
    if (!Array.isArray(payload)) {
      //parse the string by splitting by new lines or commas
      payload = payload.split(/[\n,]+/).map(link => link.trim()).filter(link => link.length > 0);
    }
    return await VideoService.queueVideos(payload);
  });

  ipcMain.handle('video:queue:clear', async () => {
    return await VideoService.clearVideoQueue();
  });
  
  ipcMain.handle('video:fetch', async (_event, hashtagId: number, maxVideos: number) => {
    let hashtag = (await HashTagService.getHashtagById(hashtagId))?.text ?? 'funnycats';
    const setting = await SettingService.getSetting();
    const max_auto_find_videos = setting.max_auto_find_videos;
    maxVideos = maxVideos >= max_auto_find_videos ? max_auto_find_videos : maxVideos;
    //remove the # from the beginining of the hashtag
    if (typeof hashtag === 'string' && hashtag.startsWith('#')) {
      hashtag = hashtag.slice(1);
    }
    return await fetchVideo(hashtag, maxVideos, setting.run_in_background ?? true);
  });

  ipcMain.handle('pending-videos:approve', async (_event, id: any) => {
    return await VideoService.approvePendingVideo(id);
  });

  ipcMain.handle('pending-videos:remove', async (_event, id: any) => {
    return await VideoService.removePendingVideo(id);
  });

  ipcMain.handle('metrics', async () => {
    return {
      'bot': await BotService.botCount(),
      'video_commented_on': await PostService.getPostCount(),
      'unapproved_videos': await VideoService.pendingVideoCount(),
      'pending_videos': await VideoService.videoQueueCount(),
    };
  });

  ipcMain.handle('header:status', async () => {
    return {
      bot_status: await SettingService.getBotStatus(),
      background_status: await SettingService.runInBackgroundMode(),
      test_mode: await SettingService.runInTestMode()
    }
  });

  ipcMain.handle('run-in-test-mode', async (_event, bool: boolean) => {
    await SettingService.useTestMode(bool);
  });

  ipcMain.handle('run-in-background-mode', async (_event, bool: boolean) => {
    await SettingService.useBackgroundMode(bool);
  });

  ipcMain.handle('bot:start', async () => {
    try {
      if ((await checkRequirements())) {
        const previousBotStatus = await SettingService.getBotStatus();
        if (previousBotStatus == 'stopped') {
          ProcessManager.start('task-runner', 'task-runner');
        }
        await SettingService.updateBotStatus('running');
      }
    } catch(error) {
      throw error;
    }
  });

  ipcMain.handle('bot:pause', async () => {
    await SettingService.updateBotStatus('paused');
  });

  ipcMain.handle('bot:stop', async () => {
    //TODO: implement logic for stopping background task-scheduler and task-runner
    ProcessManager.stop('task-runner');
    await SettingService.updateBotStatus('stopped');
  });
}
 