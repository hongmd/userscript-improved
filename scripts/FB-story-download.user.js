// ==UserScript==
// @name         Facebook Story Downloader
// @version      1.0
// @description  Download stories (videos and images) from Facebook
// @match        https://*.facebook.com/*
// ==/UserScript==

(function () {
  class StorySaver {
    constructor() {
      this.mediaUrl = null;
      this.detectedVideo = null;
      this.init();
    }

    init() {
      this.setupMutationObserver();
    }

    setupMutationObserver() {
      const observer = new MutationObserver(() => this.checkPageStructure());
      observer.observe(document.body, { childList: true, subtree: true });
    }

    get isFacebookPage() {
      return /(facebook)/.test(window.location.href);
    }

    checkPageStructure() {
      const btn = document.getElementById("downloadBtn");
      if (/(\/stories\/)/.test(window.location.href)) {
        this.createButtonWithPolling();
      } else if (btn) {
        btn.remove();
      }
    }

    createButtonWithPolling() {
      let attempts = 0;
      const interval = setInterval(() => {
        if (document.getElementById("downloadBtn")) {
          clearInterval(interval);
          return;
        }
        const createdBtn = this.createButton();
        if (createdBtn || attempts >= 5) clearInterval(interval);
        attempts++;
      }, 500);
    }

    createButton() {
      if (document.getElementById("downloadBtn")) return null;
      const topBars = this.isFacebookPage
        ? Array.from(document.querySelectorAll("div.xtotuo0"))
        : Array.from(document.querySelectorAll("div.x1xmf6yo"));
      const topBar = topBars.find(
        (bar) => bar instanceof HTMLElement && bar.offsetHeight > 0
      );
      if (!topBar) return null;

      const btn = document.createElement("button");
      btn.id = "downloadBtn";
      btn.textContent = "⬇";
      btn.style.fontSize = "20px";
      btn.style.background = "transparent";
      btn.style.border = "none";
      btn.style.color = "white";
      btn.style.cursor = "pointer";
      btn.style.zIndex = "9999";

      btn.addEventListener("click", () => this.handleDownload());
      topBar.appendChild(btn);
      return btn;
    }

    async handleDownload() {
      try {
        await this.detectMedia();
        if (!this.mediaUrl) return;
        const filename = this.generateFileName();
        await this.downloadMedia(this.mediaUrl, filename);
      } catch { }
    }

    async detectMedia() {
      const video = this.findVideo();
      const image = this.findImage();
      if (video) {
        this.mediaUrl = video;
        this.detectedVideo = true;
      } else if (image) {
        this.mediaUrl = image.src;
        this.detectedVideo = false;
      }
    }

    findVideo() {
      const videos = Array.from(document.querySelectorAll("video")).filter(
        (v) => v.offsetHeight > 0
      );
      for (const video of videos) {
        const url = this.searchVideoSource(video);
        if (url) return url;
      }
      return null;
    }

    searchVideoSource(video) {
      const reactFiberKey = Object.keys(video).find(
        (key) => key.startsWith("__reactFiber")
      );
      if (!reactFiberKey) return null;
      const reactKey = reactFiberKey.replace("__reactFiber", "");
      const parent =
        video.parentElement?.parentElement?.parentElement?.parentElement;
      const reactProps = parent?.[`__reactProps${reactKey}`];
      const implementations =
        reactProps?.children?.[0]?.props?.children?.props?.implementations ??
        reactProps?.children?.props?.children?.props?.implementations;
      if (implementations) {
        for (const index of [1, 0, 2]) {
          const source = implementations[index]?.data;
          const url =
            source?.hdSrc || source?.sdSrc || source?.hd_src || source?.sd_src;
          if (url) return url;
        }
      }
      const videoData =
        video[reactFiberKey]?.return?.stateNode?.props?.videoData?.$1;
      return videoData?.hd_src || videoData?.sd_src || null;
    }

    findImage() {
      const images = Array.from(document.querySelectorAll("img")).filter(
        (img) => img.offsetHeight > 0 && img.src.includes("cdn")
      );
      return images.find((img) => img.height > 400) || null;
    }

    generateFileName() {
      const now = new Date();
      const timestamp =
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");
      let userName = "unknown";
      let sanitizedLink = "unknown";
      if (this.isFacebookPage) {
        const user = Array.from(
          document.querySelectorAll("span.xuxw1ft.xlyipyv")
        ).find((e) => e instanceof HTMLElement && e.offsetWidth > 0);
        userName = user?.innerText || userName;
        // For Facebook page, try to find the link near the user element
        const linkElement = user?.closest('a') || document.querySelector('a[href*="/stories/"]');
        if (linkElement?.href) {
          sanitizedLink = linkElement.href
            .replace(/^https?:\/\/(www\.)?facebook\.com\//, '')
            .replace(/\//g, '-')
            .replace(/[^a-zA-Z0-9\-_.]/g, '');
        }
      } else {
        const user = Array.from(document.querySelectorAll(".x1i10hfl")).find(
          (u) =>
            u instanceof HTMLAnchorElement &&
            u.offsetHeight > 0 &&
            u.offsetHeight < 35
        );
        userName = user?.pathname.replace(/\//g, "") || userName;
        if (user?.href) {
          sanitizedLink = user.href
            .replace(/^https?:\/\/(www\.)?facebook\.com\//, '')
            .replace(/\//g, '-')
            .replace(/[^a-zA-Z0-9\-_.]/g, '');
        }
      }
      const extension = this.detectedVideo ? "mp4" : "jpg";
      return `${userName}-${sanitizedLink}-${timestamp}.${extension}`;
    }

    async downloadMedia(url, filename) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch { }
    }
  }

  new StorySaver();
})();