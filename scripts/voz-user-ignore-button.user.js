// ==UserScript==
// @name         VOZ: Add Ignore Button in Threads
// @namespace    hong.voz.ignore
// @version      1.0.1
// @description  Thêm nút "Ignore" cạnh mỗi bài viết trên VOZ, dẫn tới /u/<USER>/ignore (XenForo 2)
// @match        https://voz.vn/t/*
// @match        https://voz.vn/*/t/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ADDED_MARK = 'data-voz-ignore-btn-added';
  const ELEMENT_NODE = Node.ELEMENT_NODE;
  const DOCUMENT_FRAGMENT_NODE = Node.DOCUMENT_FRAGMENT_NODE;

  function toAbsoluteUrl(href) {
    try {
      return new URL(href, location.origin).toString();
    } catch {
      return null;
    }
  }

  function buildIgnoreUrlFromProfile(profileHref) {
    if (!profileHref) return null;

    // Chuẩn hóa URL profile (các dạng thường thấy: /u/username.12345/ hoặc /members/username.12345/)
    const abs = toAbsoluteUrl(profileHref);
    if (!abs) return null;

    // Bóc path, giữ mọi thứ trước query/hash
    const url = new URL(abs);
    // Đảm bảo có trailing slash trước khi thêm 'ignore'
    const base = url.origin + url.pathname.replace(/\/?$/, '/');
    return base + 'ignore';
  }

  function createIgnoreLink(ignoreUrl) {
    const a = document.createElement('a');
    a.href = ignoreUrl;
    a.textContent = 'Ignore';
    a.className = 'actionBar-action voz-ignore-btn';
    a.setAttribute('rel', 'nofollow');
    a.setAttribute('title', 'Ignore this user');
    // Mặc định mở trong tab hiện tại để hiển thị trang xác nhận của VOZ
    // Nếu muốn mở tab mới, bật dòng dưới:
    // a.target = '_blank';
    return a;
  }

  function injectForMessage(article) {
    if (!article || article.getAttribute(ADDED_MARK) === '1') return;

    // Tìm link username (XenForo 2 thường có h4.message-name a.username)
    const userLink =
      article.querySelector('h4.message-name a.username') ||
      article.querySelector('.message-user a.username') ||
      article.querySelector('a.username');

    if (!userLink) {
      article.setAttribute(ADDED_MARK, '1');
      return;
    }

    const ignoreUrl = buildIgnoreUrlFromProfile(userLink.getAttribute('href'));
    if (!ignoreUrl) {
      article.setAttribute(ADDED_MARK, '1');
      return;
    }

    // Chèn vào ActionBar nếu có (khu vực chứa Reply/Quote/Report)
    const actionSet =
      article.querySelector('.actionBar .actionBar-set') ||
      article.querySelector('.actionBar');

    if (actionSet && !actionSet.querySelector('.voz-ignore-btn')) {
      const btn = createIgnoreLink(ignoreUrl);

      // Thêm separator giống style XenForo (nếu cần)
      const sep = document.createElement('span');
      sep.className = 'actionBar-separator';
      actionSet.appendChild(sep);

      actionSet.appendChild(btn);
    }

    article.setAttribute(ADDED_MARK, '1');
  }

  function scan(root = document) {
    const messages = root.querySelectorAll('article.message');
    messages.forEach(injectForMessage);
  }

  // Quan sát DOM để xử lý bài mới load bằng infinite scroll
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!node) continue;
        if (node.nodeType === ELEMENT_NODE) {
          const element = node;
          if (element.matches && element.matches('article.message')) {
            injectForMessage(element);
          } else if (element.querySelectorAll) {
            // Nếu thêm cả block lớn, quét sâu bên trong
            element.querySelectorAll('article.message').forEach(injectForMessage);
          }
        } else if (node.nodeType === DOCUMENT_FRAGMENT_NODE && node.querySelectorAll) {
          node.querySelectorAll('article.message').forEach(injectForMessage);
        }
      }
    }
  });

  function start() {
    scan(document);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Đợi trang sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // Một chút CSS gọn gàng (tuỳ chọn)
  const style = document.createElement('style');
  style.textContent = `
    .actionBar .voz-ignore-btn {
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
})();
