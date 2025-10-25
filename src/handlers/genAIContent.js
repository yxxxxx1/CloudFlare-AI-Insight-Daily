// src/handlers/genAIContent.js
import { getISODate, escapeHtml, formatDateToChinese, convertEnglishQuotesToChinese } from '../helpers.js';
import { generateGenAiPageHtml } from '../htmlGenerators.js';
import { insertFoot } from '../foot.js';
import { insertAd } from '../ad.js';
import { callChatAPI } from '../chatapi.js';
import { getGenAIPrompt } from '../prompt/genAIPrompt.js';
import { removeMarkdownCodeBlock } from '../helpers.js';

/**
 * 主入口：生成 AI 日报页面或 JSON 输出
 */
export async function handleGenAIContent(request, env) {
    let dateStr;
    try {
        const url = new URL(request.url);
        const dateParam = url.searchParams.get('date');
        const mode = url.searchParams.get('mode'); // <-- 新增：检测 mode=json
        dateStr = dateParam ? dateParam : getISODate();

        // 获取选中的条目
        const formData = await request.formData();
        const selectedItems = formData.getAll('selectedItems');
        console.log(`[genAIContent] Received ${selectedItems.length} selected items for ${dateStr}`);

        // 如果没有选中任何内容
        if (selectedItems.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'No selected items.' }), { status: 400 });
        }

        // 准备 AI Prompt
        const promptText = getGenAIPrompt(selectedItems, env);
        console.log(`[genAIContent] Generated AI prompt (first 100 chars): ${promptText.substring(0, 100)}...`);

        // 调用 AI 模型
        const aiOutput = await callChatAPI(env, promptText);
        const cleanMarkdown = removeMarkdownCodeBlock(aiOutput);
        const dailySummaryMarkdownContent = convertEnglishQuotesToChinese(cleanMarkdown);

        // ✅ 新增：如果 mode=json，则返回 JSON（用于自动化）
        if (mode === 'json') {
            console.log('[genAIContent] Returning JSON mode output.');
            return new Response(JSON.stringify({
                date: dateStr,
                markdown: dailySummaryMarkdownContent,
                success: true
            }), {
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        // 生成 HTML 页面（原逻辑不变）
        let markdownBody = `## ${env.DAILY_TITLE} ${formatDateToChinese(dateStr)}\n\n`;
        markdownBody += `> ${env.DAILY_TITLE_MIN}\n\n`;
        markdownBody += `\n\n### **AI日报内容**\n\n${dailySummaryMarkdownContent}\n\n`;
        if (env.INSERT_AD === 'true') markdownBody += insertAd() + '\n';
        if (env.INSERT_FOOT === 'true') markdownBody += insertFoot() + '\n\n';

        const successHtml = generateGenAiPageHtml(
            env,
            'AI日报',
            escapeHtml(markdownBody),
            dateStr,
            false,
            selectedItems,
            null, null,
            null, null,
            convertEnglishQuotesToChinese(markdownBody),
            null,
            null,
        );

        return new Response(successHtml, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error) {
        console.error('[genAIContent] Error:', error);
        const errorMsg = escapeHtml(error.message || 'Unknown error');
        return new Response(
            JSON.stringify({ success: false, message: errorMsg }),
            { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
    }
}
