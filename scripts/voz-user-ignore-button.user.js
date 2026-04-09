// ==UserScript==
// @name         VOZ: Add Ignore Button in Threads
// @namespace    hong.voz.ignore
// @version      1.0.1
// @description  Add an "Ignore" button next to each VOZ post, linking to /u/<USER>/ignore (XenForo 2)
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

    // Normalize profile URLs such as /u/username.12345/ or /members/username.12345/
    const abs = toAbsoluteUrl(profileHref);
    if (!abs) return null;

    // Extract the path and keep everything before query/hash
    const url = new URL(abs);
    // Ensure a trailing slash before appending 'ignore'
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
    // Open in the current tab by default so VOZ can show the confirmation page
    // Uncomment the line below to open it in a new tab instead:
    // a.target = '_blank';
    return a;
  }

  function injectForMessage(article) {
    if (!article || article.getAttribute(ADDED_MARK) === '1') return;

    // Find the username link (XenForo 2 usually uses h4.message-name a.username)
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

    // Inject into the ActionBar when available (Reply/Quote/Report area)
    const actionSet =
      article.querySelector('.actionBar .actionBar-set') ||
      article.querySelector('.actionBar');

    if (actionSet && !actionSet.querySelector('.voz-ignore-btn')) {
      const btn = createIgnoreLink(ignoreUrl);

      // Add a separator matching XenForo styling
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

  // Watch the DOM so newly loaded posts from infinite scroll also get processed
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!node) continue;
        if (node.nodeType === ELEMENT_NODE) {
          const element = node;
          if (element.matches && element.matches('article.message')) {
            injectForMessage(element);
          } else if (element.querySelectorAll) {
            // If a larger block was added, scan nested posts as well
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

  // Wait until the page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // Small optional CSS cleanup
  const style = document.createElement('style');
  style.textContent = `
    .actionBar .voz-ignore-btn {
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
})();
