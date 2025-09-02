import { History, HistoryModel } from "../models/history";

export class HistoryService
{
    static async getHistoryByVideoId(video_id: string): Promise<History | undefined>
    {
        return await HistoryModel.findOne<History>({post_id: video_id});
    }
    static async updateHistory(video_id: string, payload: History)
    {
        let history = await HistoryModel.findOne<History>({post_id: video_id});
        if (history === undefined || history === null) {
            await HistoryModel.create({post_id: video_id, last_comment_position: payload?.last_comment_position});
            return;
        }
        await HistoryModel.updateById<History>(history?.id, payload);
    }
    static async updateLastCommentPosition(id: string, num: number)
    {
        await this.updateHistory(id, {last_comment_position: num});
    }

    static async getLastCommentPosition(id: string): Promise <number | undefined>
    {
        return (await this.getHistoryByVideoId(id))?.last_comment_position;
    }
}