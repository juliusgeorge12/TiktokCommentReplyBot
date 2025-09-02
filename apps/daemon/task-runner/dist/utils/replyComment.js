"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyComment = replyComment;
const shared_1 = require("../../../../../packages/shared");
const core_1 = require("../../../../../packages/core");
const extractTiktokVideoId_1 = require("./extractTiktokVideoId");
const shuffle_1 = require("./shuffle");
async function replyComment(Page, Setting, video_url) {
    const MAX_COMMENTS = Setting?.maximum_comments ?? 50;
    const DELAY_BETWEEN_REPLY = Setting?.delay_between_reply ?? 5;
    const RUN_IN_TESTMODE = Setting?.test_mode ?? true;
    const postId = (0, extractTiktokVideoId_1.extractTikTokVideoId)(video_url);
    const lastCommentPosition = (await core_1.HistoryService.getLastCommentPosition(postId ?? '')) ?? 0;
    const Comments = await core_1.CommentService.listComment();
    let lastUsedTextIndex = 0;
    const splitEmojis = (str) => {
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
        return [...segmenter.segment(str)].map(seg => seg.segment);
    };
    const getReplyText = () => {
        const comment = Comments[lastUsedTextIndex];
        let text = comment?.text ?? '';
        //shuffle the emojis and append them to the text
        if (comment?.emojis) {
            const emoji = comment.emojis;
            const emojis = emoji.split(/[\s,]+/).map(e => e.trim());
            console.log(emojis);
            text += ' ' + (0, shuffle_1.shuffle)(emojis).join('');
        }
        if (lastUsedTextIndex < Comments.length - 1) {
            lastUsedTextIndex++;
        }
        else {
            lastUsedTextIndex = 0;
        }
        return text;
    };
    await Page.goto(video_url, { waitUntil: 'networkidle2', timeout: 0 });
    await Page.waitForSelector('#main-content-video_detail');
    await Page.keyboard.press('PageDown');
    await (0, shared_1.sleep)(2000);
    const commentIcon = await Page.$('[data-e2e="comment-icon"]');
    if (!commentIcon) {
        throw new Error('Comment icon not found.');
    }
    commentIcon.click();
    await (0, shared_1.sleep)(3000);
    await Page.waitForSelector('[data-e2e="comment-level-1"]');
    const commentCount = await Page.$eval('[class*="CommentTitle"]', el => {
        const text = el.textContent.trim();
        const match = text.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    });
    if (commentCount < 1) {
        return;
    }
    const replyCount = Math.min(commentCount, MAX_COMMENTS);
    const findNextCommentcontainer = async (current) => {
        if (!current)
            return null;
        let next = await current.evaluateHandle(el => el.nextElementSibling);
        let nextEl = next.asElement();
        let attempts = 0;
        const MAX_ATTEMPTS = 100;
        while (nextEl && attempts++ < MAX_ATTEMPTS) {
            const hasCommentElement = await nextEl.$('[data-e2e="comment-level-1"]');
            if (hasCommentElement) {
                return nextEl;
            }
            next = await nextEl.evaluateHandle(el => el.nextElementSibling);
            nextEl = next.asElement();
        }
        return null;
    };
    const CommentListContainer = await Page.$('[class*="CommentListContainer"]');
    let commentContainer = await CommentListContainer.$('[class*="CommentObjectWrapper"], [class*="CommentItemContainer"]');
    let commentReplied = 0;
    while (commentReplied < replyCount && commentContainer) {
        await commentContainer.scrollIntoView();
        const NextComment = await findNextCommentcontainer(commentContainer);
        if (!(commentReplied < lastCommentPosition)) {
            const replyText = getReplyText();
            const ReplyBtn = await commentContainer.$('[role="button"][data-e2e="comment-reply-1"]');
            if (ReplyBtn) {
                await ReplyBtn.click();
                await (0, shared_1.sleep)(500);
                const replyBox = await CommentListContainer.$('[class*="DivCommentInputContainer"]');
                if (replyBox) {
                    await replyBox.click();
                    await Page.keyboard.type(replyText, { delay: 80 });
                    await (0, shared_1.sleep)(500);
                    if (!RUN_IN_TESTMODE) {
                        await Page.keyboard.press('Enter');
                        await core_1.HistoryService.updateLastCommentPosition(postId, commentReplied);
                    }
                }
                else {
                    shared_1.logger.info('Reply box not found, retrying...');
                }
            }
        }
        commentReplied++;
        commentContainer = NextComment;
        await (0, shared_1.sleep)(DELAY_BETWEEN_REPLY * 1000);
    }
}
//# sourceMappingURL=replyComment.js.map