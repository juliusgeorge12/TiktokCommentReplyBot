"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryService = void 0;
const history_1 = require("../models/history");
class HistoryService {
    static async getHistoryByVideoId(video_id) {
        return await history_1.HistoryModel.findOne({ post_id: video_id });
    }
    static async updateHistory(video_id, payload) {
        let history = await history_1.HistoryModel.findOne({ post_id: video_id });
        if (history === undefined || history === null) {
            await history_1.HistoryModel.create({ post_id: video_id, last_comment_position: payload?.last_comment_position });
            return;
        }
        await history_1.HistoryModel.updateById(history?.id, payload);
    }
    static async updateLastCommentPosition(id, num) {
        await this.updateHistory(id, { last_comment_position: num });
    }
    static async getLastCommentPosition(id) {
        return (await this.getHistoryByVideoId(id))?.last_comment_position;
    }
}
exports.HistoryService = HistoryService;
