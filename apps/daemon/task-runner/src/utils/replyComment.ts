import { ElementHandle, logger, Page, randomSleep, sleep } from "../../../../../packages/shared";
import { CommentService, HistoryService, Setting } from "../../../../../packages/core";
import { extractTikTokVideoId } from "./extractTiktokVideoId";
import { shuffle } from "./shuffle";

export async function replyComment(Page: Page, Setting: Setting, video_url: string): Promise<void> {
    const MAX_COMMENTS = Setting?.maximum_comments ?? 50;
    const DELAY_BETWEEN_REPLY = Setting?.delay_between_reply ?? 5;
    const RUN_IN_TESTMODE = Setting?.test_mode ?? true;
    const postId = extractTikTokVideoId(video_url);
    const lastCommentPosition = (await HistoryService.getLastCommentPosition(postId ?? '')) ?? 0;
    const Comments = await CommentService.listComment();
    let lastUsedTextIndex = 0;
    const getReplyText = (): string => { 
        const comment = Comments[lastUsedTextIndex];
        let text = comment?.text ?? '';
        //shuffle the emojis and append them to the text
        if (comment?.emojis) {
            const emoji = comment.emojis;
            const emojis = emoji.split(/[\s,]+/).map(e => e.trim());
            console.log(emojis);
            text += ' ' + shuffle(emojis).join('');
        }
        if (lastUsedTextIndex < Comments.length - 1) {
            lastUsedTextIndex++;
        } else {
            lastUsedTextIndex = 0;
        }
        return text;
    };
    await Page.goto(video_url, { waitUntil: 'networkidle2', timeout: 0 });
    await Page.waitForSelector('#main-content-video_detail');
    await Page.keyboard.press('PageDown');
    await sleep(2000);
    const commentIcon = await Page.$('[data-e2e="comment-icon"]');
    if (!commentIcon) {
        throw new Error('Comment icon not found.');
    }
    commentIcon.click();
    await sleep(3000);
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
    const findNextCommentcontainer = async (current: ElementHandle<HTMLElement>): Promise<ElementHandle<HTMLDivElement> | null> => {
        if (!current) return null;
        let next = await current.evaluateHandle(el => (el as Element).nextElementSibling);
        let nextEl = next.asElement();
        let attempts = 0;
        const MAX_ATTEMPTS = 100;
        while (nextEl && attempts++ < MAX_ATTEMPTS) {
            const hasCommentElement = await nextEl.$('[data-e2e="comment-level-1"]');
            if (hasCommentElement) {
                return nextEl as ElementHandle<HTMLDivElement>;
            }

            next = await nextEl.evaluateHandle(el => (el as Element).nextElementSibling);
            nextEl = next.asElement();
        }
        return null;
    };
    const CommentListContainer = await Page.$('[class*="CommentListContainer"]');
    let commentContainer = await CommentListContainer.$(
      '[class*="CommentObjectWrapper"], [class*="CommentItemContainer"]'
    );
    let commentReplied = 0;
    while (commentReplied < replyCount && commentContainer) {
        await commentContainer.scrollIntoView();
        const NextComment = await findNextCommentcontainer(commentContainer as ElementHandle<HTMLElement>);
        if (!(commentReplied < lastCommentPosition)) {
            const replyText = getReplyText();
            const ReplyBtn = await commentContainer.$('[role="button"][data-e2e="comment-reply-1"]');
            if (ReplyBtn) {
                await ReplyBtn.click();
                await sleep(500);
                const replyBox = await CommentListContainer.$('[class*="DivCommentInputContainer"]');
                if (replyBox) {
                    await replyBox.click();
                    await Page.keyboard.type(replyText, { delay: 80 });
                    await sleep(500);
                    if (!RUN_IN_TESTMODE) {
                        await Page.keyboard.press('Enter');
                        await HistoryService.updateLastCommentPosition(postId, commentReplied);
                    }
                } else {
                    logger.info('Reply box not found, retrying...');
                }
            }
        }
        commentReplied++;
        commentContainer = NextComment;
        await sleep(DELAY_BETWEEN_REPLY * 1000);
    }
}