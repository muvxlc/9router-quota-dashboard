'use client';

import { useState, useEffect } from 'react';

let sharedNowMs = typeof Date !== 'undefined' ? Date.now() : 0;
const subscribers = new Set();
let timerId = null;

function ensureTimer() {
  if (timerId === null && typeof setInterval !== 'undefined') {
    timerId = setInterval(() => {
      sharedNowMs = Date.now();
      for (const sub of subscribers) {
        sub(sharedNowMs);
      }
    }, 1000);
    if (typeof timerId?.unref === 'function') {
      timerId.unref();
    }
  }
}

function stopTimerIfNoSubscribers() {
  if (subscribers.size === 0 && timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

export function useCentralClock(intervalMs = 1000) {
  const [nowMs, setNowMs] = useState(() => (typeof Date !== 'undefined' ? Date.now() : 0));

  useEffect(() => {
    const handleTick = (now) => setNowMs(now);
    subscribers.add(handleTick);
    ensureTimer();

    return () => {
      subscribers.delete(handleTick);
      stopTimerIfNoSubscribers();
    };
  }, [intervalMs]);

  return nowMs;
}
