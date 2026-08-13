import { json } from '../_lib/auth.js';
import { requireUser } from '../_lib/user.js';

const FEEDBACK_TO = 'jndysq@qq.com';

function cleanText(value, maxLength) {
  return String(value || '').normalize('NFKC').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function sendFeedbackEmail({ apiKey, from, username, contact, message }) {
  if (!apiKey || !from) throw new Error('email-not-configured');
  const safeUsername = escapeHtml(username);
  const safeContact = escapeHtml(contact || '未填写');
  const safeMessage = escapeHtml(message).replace(/\n/gu, '<br>');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [FEEDBACK_TO],
      subject: `深情俱乐部意见反馈 - ${username}`,
      html: `<div style="font-family:system-ui,sans-serif;color:#2d241d;line-height:1.7"><h1 style="font-size:20px">新的意见反馈</h1><p><strong>账号：</strong>${safeUsername}</p><p><strong>联系方式：</strong>${safeContact}</p><p><strong>内容：</strong></p><p>${safeMessage}</p></div>`,
      text: `账号：${username}\n联系方式：${contact || '未填写'}\n\n${message}`,
    }),
  });
  if (!response.ok) throw new Error(`feedback-send-failed:${response.status}`);
}

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;

  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }

  const message = cleanText(input.message, 1000);
  const contact = cleanText(input.contact, 120);
  if (message.length < 4) return json({ error: '反馈内容至少写 4 个字。' }, 400);

  const id = crypto.randomUUID();
  try {
    await context.env.DB.prepare(
      `INSERT INTO feedback_submissions (id, username, message, contact, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    ).bind(id, user.username, message, contact || null).run();
  } catch {
    return json({ error: '反馈保存失败，请稍后重试。' }, 503);
  }

  try {
    await sendFeedbackEmail({
      apiKey: context.env.RESEND_API_KEY,
      from: context.env.EMAIL_FROM,
      username: user.username,
      contact,
      message,
    });
  } catch {
    return json({ error: '反馈已保存，但邮件发送失败，请稍后再试。' }, 503);
  }

  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
