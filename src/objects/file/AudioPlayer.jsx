import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconDisc,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconRepeat,
  IconVolume,
  IconVolume2,
  IconVolume3,
} from "@tabler/icons-react";
import "./AudioPlayer.css";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function AudioPlayer({ src, title }) {
  const audioRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused || audio.ended) audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const seekTo = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const limit = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = Math.min(limit || seconds, Math.max(0, seconds));
    setCurrentTime(audio.currentTime);
  }, []);

  const nudge = useCallback((delta) => {
    const audio = audioRef.current;
    if (audio) seekTo(audio.currentTime + delta);
  }, [seekTo]);

  const applyVolume = useCallback((next) => {
    const audio = audioRef.current;
    const clamped = Math.min(1, Math.max(0, next));
    if (audio) {
      audio.volume = clamped;
      audio.muted = clamped === 0;
    }
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
    if (!audio.muted && audio.volume === 0) {
      audio.volume = 0.5;
      setVolume(0.5);
    }
  }, []);

  const toggleLoop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = !audio.loop;
    setLoop(Boolean(audio?.loop));
  }, []);

  const cycleRate = useCallback(() => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    if (audioRef.current) audioRef.current.playbackRate = next;
    setRate(next);
  }, [rate]);

  const onKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const handlers = {
      " ": togglePlay,
      k: togglePlay,
      ArrowLeft: () => nudge(-5),
      ArrowRight: () => nudge(5),
      j: () => nudge(-10),
      l: () => nudge(10),
      ArrowUp: () => applyVolume(volume + 0.05),
      ArrowDown: () => applyVolume(volume - 0.05),
      m: toggleMute,
      r: toggleLoop,
      Home: () => seekTo(0),
      End: () => seekTo(duration),
    };
    const handler = handlers[event.key];
    if (!handler) return;
    event.preventDefault();
    event.stopPropagation();
    handler();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const VolumeIcon = muted || volume === 0 ? IconVolume3 : volume < 0.5 ? IconVolume2 : IconVolume;

  return (
    <div
      className="audio-player"
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-label={title ? `${title} audio player` : "Audio player"}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        aria-label={title}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          setReady(true);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onPlay={() => { setPlaying(true); setEnded(false); }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setEnded(true); }}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
        }}
        onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
      />

      <div className="audio-art" aria-hidden="true">
        <div className="audio-art-disc" data-playing={playing ? "true" : undefined}>
          <IconDisc size={34} stroke={1.3} />
          <span className="audio-art-center" />
        </div>
        <span className="audio-art-ring" data-playing={playing ? "true" : undefined} />
      </div>

      <div className="audio-meta">
        <span className="audio-title">{title || "Audio"}</span>
        <span className="audio-status">
          {ended ? "Ended" : playing ? "Playing" : ready ? "Paused" : "Loading…"}
        </span>
      </div>

      <div className="audio-scrub">
        <span className="audio-time-current">{formatTime(currentTime)}</span>
        <div className="audio-scrub-track">
          <span className="audio-scrub-played" style={{ width: `${progress}%` }} aria-hidden="true" />
          <input
            className="audio-scrub-input"
            type="range"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 0}
            step={0.01}
            value={Math.min(currentTime, duration || 0)}
            disabled={!ready || !duration}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label="Seek"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
        </div>
        <span className="audio-time-total">{formatTime(duration)}</span>
      </div>

      <div className="audio-buttons">
        <button type="button" onClick={() => nudge(-10)} aria-label="Back 10 seconds" data-tooltip="Back 10s">
          <IconPlayerTrackPrev size={14} stroke={1.7} />
        </button>
        <button type="button" className="audio-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} data-tooltip={playing ? "Pause" : "Play"}>
          {playing ? <IconPlayerPause size={15} stroke={1.7} /> : <IconPlayerPlay size={15} stroke={1.7} />}
        </button>
        <button type="button" onClick={() => nudge(10)} aria-label="Forward 10 seconds" data-tooltip="Forward 10s">
          <IconPlayerTrackNext size={14} stroke={1.7} />
        </button>

        <span className="audio-spacer" />

        <button type="button" onClick={toggleLoop} aria-label={loop ? "Turn repeat off" : "Repeat"} data-tooltip={loop ? "Repeat on" : "Repeat"} aria-pressed={loop}>
          <IconRepeat size={14} stroke={1.7} />
        </button>

        <span className="audio-volume">
          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} data-tooltip={muted ? "Unmute" : "Mute"}>
            <VolumeIcon size={14} stroke={1.7} />
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

        <button
          type="button"
          className="audio-rate-button"
          onClick={cycleRate}
          aria-label={`Playback speed ${rate}×`}
          data-tooltip={`Speed ${rate}×`}
        >
          <span className="audio-rate-caption">Speed</span>
          <span className="audio-rate-value">{rate}×</span>
        </button>
      </div>
    </div>
  );
}

export default AudioPlayer;