export const CHAT_FILE_LIMITS = Object.freeze({
  maxBytes: 1_500_000,
  maxPendingPerSender: 10,
  retentionDays: 7,
  maxNameLength: 180,
  maxMimeLength: 120,
});

export function sanitizeFileName(value) {
  const cleanName = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .replace(/[\\/]/gu, '_')
    .trim();
  const name = [...cleanName].slice(0, CHAT_FILE_LIMITS.maxNameLength).join('');
  return name || '未命名文件';
}

export function sanitizeMimeType(value) {
  const mime = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(mime)) {
    return 'application/octet-stream';
  }
  return mime.slice(0, CHAT_FILE_LIMITS.maxMimeLength);
}

export function attachmentDisposition(fileName) {
  const safeName = sanitizeFileName(fileName);
  const fallback = safeName
    .replace(/[^A-Za-z0-9._ -]/gu, '_')
    .replace(/[";]/gu, '_')
    .slice(0, 120) || 'download';
  const encoded = encodeURIComponent(safeName).replace(/[!'()*]/gu, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function serializeChatMessage(message) {
  const type = message.message_type === 'file' ? 'file' : 'text';
  const receivedAt = message.attachment_received_at || '';
  const available = type === 'file' && Boolean(message.attachment_available) && !receivedAt;
  return {
    id: Number(message.id),
    senderId: Number(message.sender_id),
    recipientId: Number(message.recipient_id),
    type,
    body: message.body || '',
    createdAt: message.created_at,
    readAt: message.read_at || '',
    ...(type === 'file' ? {
      attachment: {
        id: message.attachment_id || '',
        name: message.attachment_name || '未命名文件',
        size: Math.max(0, Number(message.attachment_size) || 0),
        mime: message.attachment_mime || 'application/octet-stream',
        available,
        receivedAt,
        status: receivedAt ? 'received' : available ? 'pending' : 'expired',
      },
    } : {}),
  };
}
