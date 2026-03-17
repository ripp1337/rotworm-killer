// ── Chat — SSE connection, send, append ───────────────────────────

import * as S from '../systems/state.js';

const MAX_MESSAGES = 100;
let   _sse        = null;
let   _lastSentMs = 0;
const RATE_LIMIT_MS = 2000;

// ── SSE connection ─────────────────────────────────────────────────

export function initChat() {
    if (_sse) return;

    _sse = new EventSource('/api/chat/stream');

    _sse.onmessage = e => {
        try {
            const msg = JSON.parse(e.data);
            appendMessage(msg);
        } catch {/* ignore malformed */ }
    };

    _sse.onerror = () => {
        _sse?.close();
        _sse = null;
        // Reconnect after 5 seconds
        setTimeout(initChat, 5000);
    };
}

// ── Send a message ─────────────────────────────────────────────────

export async function sendChat(text) {
    text = text.trim();
    if (!text) return;
    if (!S.authToken) return;

    const now = Date.now();
    if (now - _lastSentMs < RATE_LIMIT_MS) return;
    _lastSentMs = now;

    if (text.length > 200) text = text.slice(0, 200);

    try {
        await fetch('/api/chat/send', {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${S.authToken}`,
            },
            body: JSON.stringify({ message: text }),
        });
    } catch {/* network error — silently ignore */ }
}

// ── Append a message to the chat box ─────────────────────────────

export function appendMessage({ username, message, timestamp }) {
    const box = document.getElementById('chatBox');
    if (!box) return;

    const line = document.createElement('div');
    line.className = 'chat-line';

    const time = new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Sanitize before inserting as text nodes
    const timeSpan = document.createElement('span');
    timeSpan.className   = 'chat-time';
    timeSpan.textContent = `[${time}] `;

    const userSpan = document.createElement('span');
    userSpan.className   = 'chat-user';
    userSpan.textContent = `${username}: `;

    const msgSpan = document.createElement('span');
    msgSpan.className   = 'chat-msg';
    msgSpan.textContent = message;

    line.appendChild(timeSpan);
    line.appendChild(userSpan);
    line.appendChild(msgSpan);

    box.appendChild(line);

    // Trim old messages
    while (box.children.length > MAX_MESSAGES) {
        box.removeChild(box.firstChild);
    }

    // Scroll to bottom
    box.scrollTop = box.scrollHeight;
}
