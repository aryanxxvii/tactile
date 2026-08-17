import { React, useCallback, useEffect, useMemo, useRef, useState } from "tactile:host";
import {
  IconMaximize,
  IconMinimize,
  IconPictureInPicture,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconVolume,
  IconVolume2,
  IconVolume3,
} from "@tabler/icons-react";
import "./VideoPlayer.css";

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP_SECONDS = 5;
const FRAME_SECONDS = 1 / 30;
const IDLE_MS = 2200;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function VideoPlayer({ src, title }) {
  const shellRef = useRef(null);
  const videoRef = useRef(null);
  const idleTimerRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [idle, setIdle] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [aspect, setAspect] = useState(0);

  const pipSupported = useMemo(
    () => typeof document !== "undefined" && Boolean(document.pictureInPictureEnabled),
    [],
  );

  const wake = useCallback(() => {
    setIdle(false);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  useEffect(() => () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
  }, []);

  // Controls only auto-hide during playback; a paused player keeps them up.
  useEffect(() => {
    if (playing) wake();
    else {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      setIdle(false);
    }
  }, [playing, wake]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) video.play().catch(() => {});
    else video.pause();
  }, []);

  const seekTo = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(seconds)) return;
    const limit = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = Math.min(limit || seconds, Math.max(0, seconds));
    setCurrentTime(video.currentTime);
  }, []);

  const nudge = useCallback((delta) => {
    const video = videoRef.current;
    if (video) seekTo(video.currentTime + delta);
  }, [seekTo]);

  const stepFrame = useCallback((direction) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    seekTo(video.currentTime + direction * FRAME_SECONDS);
  }, [seekTo]);

  const applyVolume = useCallback((next) => {
    const video = videoRef.current;
    const clamped = Math.min(1, Math.max(0, next));
    if (video) {
      video.volume = clamped;
      video.muted = clamped === 0;
    }
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted && video.volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch {
      /* Fullscreen can be refused by the host; keep the inline player usable. */
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* Ignore: some codecs and hosts refuse PiP. */
    }
  }, [pipSupported]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Scope shortcuts to the player so the workspace keeps its own bindings.
  const onKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const handlers = {
      " ": togglePlay,
      k: togglePlay,
      ArrowLeft: () => nudge(-SKIP_SECONDS),
      ArrowRight: () => nudge(SKIP_SECONDS),
      j: () => nudge(-10),
      l: () => nudge(10),
      ArrowUp: () => applyVolume(volume + 0.05),
      ArrowDown: () => applyVolume(volume - 0.05),
      m: toggleMute,
      f: toggleFullscreen,
      Home: () => seekTo(0),
      End: () => seekTo(duration),
      ",": () => stepFrame(-1),
      ".": () => stepFrame(1),
    };
    const handler = handlers[event.key];
    if (!handler) return;
    event.preventDefault();
    event.stopPropagation();
    wake();
    handler();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;
  const VolumeIcon = muted || volume === 0 ? IconVolume3 : volume < 0.5 ? IconVolume2 : IconVolume;

  return (
    <div
      ref={shellRef}
      className="video-player"
      data-playing={playing ? "true" : undefined}
      data-idle={idle && !scrubbing ? "true" : undefined}
      data-fullscreen={fullscreen ? "true" : undefined}
      style={aspect ? { "--video-aspect": aspect } : undefined}
      onMouseMove={wake}
      onMouseLeave={() => playing && setIdle(true)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-label={title ? `${title} video player` : "Video player"}
    >
      <div className="video-stage" onClick={togglePlay} onDoubleClick={toggleFullscreen}>
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          playsInline
          aria-label={title}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(Number.isFinite(video.duration) ? video.duration : 0);
            if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
            setReady(true);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => {
            const value = event.currentTarget.duration;
            setDuration(Number.isFinite(value) ? value : 0);
          }}
          onProgress={(event) => {
            const ranges = event.currentTarget.buffered;
            setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
          }}
          onPlay={() => { setPlaying(true); setEnded(false); }}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setEnded(true); }}
          onVolumeChange={(event) => {
            setVolume(event.currentTarget.volume);
            setMuted(event.currentTarget.muted);
          }}
          onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
          onEnterPictureInPicture={() => setPipActive(true)}
          onLeavePictureInPicture={() => setPipActive(false)}
        />
        {!playing ? (
          <span className="video-center-badge" aria-hidden="true">
            {ended ? <IconPlayerSkipBack size={22} stroke={1.7} /> : <IconPlayerPlay size={22} stroke={1.7} />}
          </span>
        ) : null}
      </div>

      <div className="video-controls" aria-label="Playback controls">
        <div className="video-scrub">
          <div className="video-scrub-track" aria-hidden="true">
            <span className="video-scrub-buffered" style={{ width: `${bufferedPercent}%` }} />
            <span className="video-scrub-played" style={{ width: `${progress}%` }} />
          </div>
          <input
            className="video-scrub-input"
            type="range"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 0}
            step={0.01}
            value={Math.min(currentTime, duration || 0)}
            disabled={!ready || !duration}
            onChange={(event) => seekTo(Number(event.target.value))}
            onPointerDown={() => setScrubbing(true)}
            onPointerUp={() => setScrubbing(false)}
            aria-label="Seek"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
        </div>

        <div className="video-buttons">
          <button type="button" onClick={() => nudge(-SKIP_SECONDS)} aria-label={`Back ${SKIP_SECONDS} seconds`} data-tooltip={`Back ${SKIP_SECONDS}s`}>
            <IconPlayerTrackPrev size={13} stroke={1.7} />
          </button>
          <button type="button" className="video-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} data-tooltip={playing ? "Pause" : "Play"}>
            {playing ? <IconPlayerPause size={14} stroke={1.7} /> : <IconPlayerPlay size={14} stroke={1.7} />}
          </button>
          <button type="button" onClick={() => nudge(SKIP_SECONDS)} aria-label={`Forward ${SKIP_SECONDS} seconds`} data-tooltip={`Forward ${SKIP_SECONDS}s`}>
            <IconPlayerTrackNext size={13} stroke={1.7} />
          </button>

          <span className="video-time">
            <span className="video-time-current">{formatTime(currentTime)}</span>
            <span className="video-time-sep">/</span>
            <span className="video-time-total">{formatTime(duration)}</span>
          </span>

          <span className="file-toolbar-spacer" />

          <span className="video-volume">
            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} data-tooltip={muted ? "Unmute" : "Mute"}>
              <VolumeIcon size={13} stroke={1.7} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(event) => applyVolume(Number(event.target.value))}
              aria-label="Volume"
            />
          </span>

          <label className="video-rate">
            <span className="video-rate-caption">Speed</span>
            <select
              value={rate}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (videoRef.current) videoRef.current.playbackRate = next;
                setRate(next);
              }}
              aria-label="Playback speed"
            >
              {RATES.map((value) => (
                <option key={value} value={value}>{value}×</option>
              ))}
            </select>
          </label>

          {pipSupported ? (
            <button type="button" onClick={togglePip} aria-label="Picture in picture" data-tooltip="Picture in picture" aria-pressed={pipActive}>
              <IconPictureInPicture size={13} stroke={1.7} />
            </button>
          ) : null}

          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} data-tooltip={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? <IconMinimize size={13} stroke={1.7} /> : <IconMaximize size={13} stroke={1.7} />}
          </button>
        </div>
      </div>
    </div>
  );
}
