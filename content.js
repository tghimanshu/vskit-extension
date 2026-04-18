(() => {
  if (!location.hostname.endsWith("vskit.tv")) {
    return;
  }

  const boundVideos = new WeakSet();
  let isAdvancing = false;
  let routeHandlersInstalled = false;

  const isWatchPage = () => location.pathname.startsWith("/watch/");

  const forceUnmute = (video) => {
    if (!(video instanceof HTMLVideoElement)) {
      return;
    }

    if (video.defaultMuted) {
      video.defaultMuted = false;
    }

    if (video.muted) {
      video.muted = false;
    }

    if (video.volume === 0) {
      video.volume = 1;
    }
  };

  const getCurrentEpisode = () => {
    const raw = new URL(location.href).searchParams.get("ep");
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
      return null;
    }
    return value;
  };

  const isVisible = (element) => {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const isDisabled = (element) => {
    if (!(element instanceof Element)) {
      return true;
    }

    if (element.hasAttribute("disabled")) {
      return true;
    }

    return element.getAttribute("aria-disabled") === "true";
  };

  const parseEpisodeFromText = (text) => {
    const source = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
    if (!source) {
      return null;
    }

    const episodeMatch = source.match(/\b(?:ep(?:isode)?\.?\s*#?\s*)(\d{1,4})\b/i);
    if (episodeMatch) {
      const value = Number(episodeMatch[1]);
      return Number.isInteger(value) && value > 0 ? value : null;
    }

    const plainNumberMatch = source.match(/^\s*(\d{1,4})\s*$/);
    if (!plainNumberMatch) {
      return null;
    }

    const value = Number(plainNumberMatch[1]);
    return Number.isInteger(value) && value > 0 ? value : null;
  };

  const getEpisodeFromHref = (href) => {
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith("/watch/")) {
        return null;
      }

      const ep = Number(url.searchParams.get("ep"));
      return Number.isInteger(ep) && ep > 0 ? ep : null;
    } catch {
      return null;
    }
  };

  const getEpisodeControls = () => {
    const controls = [];
    const seen = new Set();
    const candidates = document.querySelectorAll("button, [role='button'], a[href*='/watch/']");

    for (const element of candidates) {
      if (!(element instanceof Element) || seen.has(element)) {
        continue;
      }

      if (!isVisible(element) || isDisabled(element)) {
        continue;
      }

      let episode = null;
      let href = null;

      if (element instanceof HTMLAnchorElement) {
        href = element.getAttribute("href");
        if (href) {
          episode = getEpisodeFromHref(href);
        }
      }

      if (episode === null) {
        episode = parseEpisodeFromText(element.textContent || "");
      }

      if (episode === null) {
        continue;
      }

      controls.push({ element, episode });
      seen.add(element);
    }

    return controls;
  };

  const hasActiveMarker = (element) => {
    if (!(element instanceof Element)) {
      return false;
    }

    const ariaCurrent = element.getAttribute("aria-current");
    if (ariaCurrent && ariaCurrent !== "false") {
      return true;
    }

    if (element.getAttribute("aria-selected") === "true") {
      return true;
    }

    if (
      element.getAttribute("data-active") === "true" ||
      element.getAttribute("data-current") === "true" ||
      element.getAttribute("data-selected") === "true"
    ) {
      return true;
    }

    const elementClass =
      typeof element.className === "string"
        ? element.className
        : element.className?.baseVal || "";
    const parentClass = element.parentElement
      ? typeof element.parentElement.className === "string"
        ? element.parentElement.className
        : element.parentElement.className?.baseVal || ""
      : "";

    return /\b(active|current|selected|playing)\b/i.test(`${elementClass} ${parentClass}`);
  };

  const clickElement = (element) => {
    if (!(element instanceof Element)) {
      return;
    }

    element.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      })
    );
  };

  const tryClickNextFromEpisodeList = () => {
    const controls = getEpisodeControls();
    if (controls.length < 2) {
      return false;
    }

    const currentUrl = new URL(location.href);
    const currentMiniId = currentUrl.searchParams.get("miniId");
    const currentEpisode = getCurrentEpisode();

    let activeIndex = controls.findIndex((control) => hasActiveMarker(control.element));

    if (activeIndex < 0) {
      activeIndex = controls.findIndex((control) => {
        if (!(control.element instanceof HTMLAnchorElement)) {
          return false;
        }

        const href = control.element.getAttribute("href");
        if (!href) {
          return false;
        }

        try {
          const url = new URL(href, location.origin);
          if (url.pathname !== currentUrl.pathname) {
            return false;
          }

          const miniId = url.searchParams.get("miniId");
          if (currentMiniId && miniId) {
            return miniId === currentMiniId;
          }

          const ep = Number(url.searchParams.get("ep"));
          return currentEpisode !== null && ep === currentEpisode;
        } catch {
          return false;
        }
      });
    }

    if (activeIndex < 0 && currentEpisode !== null) {
      activeIndex = controls.findIndex((control) => control.episode === currentEpisode);
    }

    if (activeIndex < 0 && currentEpisode !== null) {
      activeIndex = controls.findIndex((control) => control.episode === currentEpisode - 1);
    }

    if (activeIndex >= 0 && activeIndex + 1 < controls.length) {
      clickElement(controls[activeIndex + 1].element);
      return true;
    }

    if (currentEpisode !== null) {
      const nextByNumber =
        controls.find((control) => control.episode > currentEpisode) ||
        controls.find((control) => control.episode > currentEpisode - 1);

      if (nextByNumber) {
        clickElement(nextByNumber.element);
        return true;
      }
    }

    return false;
  };

  const getNextEpisodeHref = () => {
    const currentEpisode = getCurrentEpisode();
    if (currentEpisode === null) {
      return null;
    }

    const byHref = new Map();

    const links = document.querySelectorAll("a[href*='/watch/'][href*='ep=']");
    for (const link of links) {
      try {
        const href = link.getAttribute("href");
        if (!href) {
          continue;
        }

        const url = new URL(href, location.origin);
        if (url.origin !== location.origin || !url.pathname.startsWith("/watch/")) {
          continue;
        }

        const ep = Number(url.searchParams.get("ep"));
        if (!Number.isInteger(ep) || ep < 1) {
          continue;
        }

        byHref.set(url.toString(), { href: url.toString(), ep });
      } catch {
        continue;
      }
    }

    const candidates = Array.from(byHref.values()).sort((a, b) => a.ep - b.ep);

    const exactNext = candidates.find((entry) => entry.ep === currentEpisode + 1);
    if (exactNext) {
      return exactNext.href;
    }

    const higherEpisode = candidates.find((entry) => entry.ep > currentEpisode);
    return higherEpisode ? higherEpisode.href : null;
  };

  const navigateToNextByUrl = () => {
    const url = new URL(location.href);
    const raw = url.searchParams.get("ep");
    const episode = Number(raw);

    if (!Number.isInteger(episode) || episode < 1) {
      return false;
    }

    url.searchParams.set("ep", String(episode + 1));
    url.searchParams.delete("miniId");

    const nextUrl = url.toString();
    if (nextUrl === location.href) {
      return false;
    }

    location.assign(nextUrl);
    return true;
  };

  const navigateToResolvedNextEpisode = () => {
    const nextHref = getNextEpisodeHref();
    if (!nextHref || nextHref === location.href) {
      return false;
    }

    location.assign(nextHref);
    return true;
  };

  const handleVideoEnded = () => {
    if (!isWatchPage() || isAdvancing) {
      return;
    }

    isAdvancing = true;
    const initialUrl = location.href;

    const clickedFromEpisodeList = tryClickNextFromEpisodeList();
    if (clickedFromEpisodeList) {
      window.setTimeout(() => {
        if (location.href !== initialUrl) {
          isAdvancing = false;
          return;
        }

        const navigatedByEpisodeLink = navigateToResolvedNextEpisode();
        if (navigatedByEpisodeLink) {
          return;
        }

        const navigatedByUrl = navigateToNextByUrl();
        if (!navigatedByUrl) {
          isAdvancing = false;
        }
      }, 1800);
      return;
    }

    const navigatedByEpisodeLink = navigateToResolvedNextEpisode();
    if (navigatedByEpisodeLink) {
      return;
    }

    const navigatedByUrl = navigateToNextByUrl();
    if (!navigatedByUrl) {
      isAdvancing = false;
    }
  };

  const bindVideo = (video) => {
    if (!(video instanceof HTMLVideoElement) || boundVideos.has(video)) {
      return;
    }

    boundVideos.add(video);

    const unmuteEvents = [
      "play",
      "playing",
      "loadedmetadata",
      "canplay",
      "volumechange"
    ];

    for (const eventName of unmuteEvents) {
      video.addEventListener(eventName, () => {
        forceUnmute(video);
      });
    }

    video.addEventListener("ended", handleVideoEnded);

    forceUnmute(video);
    window.setTimeout(() => forceUnmute(video), 400);
  };

  const bindVideosInNode = (node) => {
    if (!(node instanceof Element)) {
      return;
    }

    if (node.matches("video")) {
      bindVideo(node);
    }

    const videos = node.querySelectorAll("video");
    for (const video of videos) {
      bindVideo(video);
    }
  };

  const bindAllVideos = () => {
    if (!isWatchPage()) {
      return;
    }

    const videos = document.querySelectorAll("video");
    for (const video of videos) {
      bindVideo(video);
    }
  };

  const installRouteHandlers = () => {
    if (routeHandlersInstalled) {
      return;
    }

    routeHandlersInstalled = true;

    const notifyRouteChange = () => {
      window.dispatchEvent(new Event("vskit:route-change"));
    };

    const originalPushState = history.pushState;
    history.pushState = function patchedPushState(...args) {
      const result = originalPushState.apply(this, args);
      notifyRouteChange();
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyRouteChange();
      return result;
    };

    window.addEventListener("popstate", notifyRouteChange);
    window.addEventListener("hashchange", notifyRouteChange);

    window.addEventListener("vskit:route-change", () => {
      isAdvancing = false;
      bindAllVideos();
    });
  };

  const observer = new MutationObserver((mutations) => {
    if (!isWatchPage()) {
      return;
    }

    for (const mutation of mutations) {
      for (const addedNode of mutation.addedNodes) {
        bindVideosInNode(addedNode);
      }
    }
  });

  const init = () => {
    installRouteHandlers();
    bindAllVideos();

    const root = document.documentElement || document.body;
    if (root) {
      observer.observe(root, { childList: true, subtree: true });
    }
  };

  init();
})();