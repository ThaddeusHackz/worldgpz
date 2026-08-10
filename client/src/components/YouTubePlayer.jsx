import { useEffect, useRef } from "react";

let iframeApiPromise;

function loadIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;
  iframeApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () =>
        reject(new Error("YouTube player API could not be loaded"));
      document.head.appendChild(script);
    }
  });
  return iframeApiPromise;
}

export default function YouTubePlayer({
  videoId,
  playing,
  muted,
  onReady,
  onError,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const latestVideoId = useRef(videoId);
  const latestState = useRef({ playing, muted });
  latestVideoId.current = videoId;
  latestState.current = { playing, muted };

  useEffect(() => {
    let disposed = false;
    loadIframeApi()
      .then((YT) => {
        if (disposed || !containerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          host: "https://www.youtube-nocookie.com",
          videoId: latestVideoId.current,
          playerVars: {
            autoplay: latestState.current.playing ? 1 : 0,
            mute: latestState.current.muted ? 1 : 0,
            playsinline: 1,
            rel: 0,
            controls: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (latestState.current.muted) event.target.mute();
              if (latestState.current.playing) event.target.playVideo();
              onReady?.();
            },
            onError: () =>
              onError?.("This channel is not currently embeddable."),
          },
        });
      })
      .catch((error) => onError?.(error.message));
    return () => {
      disposed = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // The external player may already have removed its iframe.
      }
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player?.loadVideoById) return;
    player.loadVideoById(videoId);
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (muted) player.mute?.();
    else player.unMute?.();
  }, [muted]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.playVideo?.();
    else player.pauseVideo?.();
  }, [playing]);

  return <div className="youtube-player" ref={containerRef} />;
}
