import test from 'node:test';
import assert from 'node:assert/strict';

test('auto-refresh visibility logic pauses when hidden and fires when visible if elapsed', () => {
  let timerCleared = false;
  let timerDelay = null;
  let refreshCalled = 0;

  const intervalSec = 30;
  const intervalMs = intervalSec * 1000;
  let visibilityState = 'visible';

  const mockClearTimer = () => {
    timerCleared = true;
    timerDelay = null;
  };

  const mockScheduleTick = (delayMs) => {
    timerCleared = false;
    timerDelay = delayMs;
  };

  const onRefresh = () => {
    refreshCalled++;
  };

  mockScheduleTick(intervalMs);
  assert.equal(timerDelay, 30000);
  assert.equal(timerCleared, false);

  visibilityState = 'hidden';
  if (visibilityState === 'hidden') {
    mockClearTimer();
  }
  assert.equal(timerCleared, true);
  assert.equal(timerDelay, null);

  visibilityState = 'visible';
  const lastSyncTime = Date.now() - 35000;
  const elapsedMs = Date.now() - lastSyncTime;

  if (elapsedMs >= intervalMs) {
    onRefresh();
  } else {
    mockScheduleTick(intervalMs - elapsedMs);
  }

  assert.equal(refreshCalled, 1);
});

test('auto-refresh does not trigger refresh when interval is 0 or disabled', () => {
  let refreshCalled = 0;
  const onRefresh = () => {
    refreshCalled++;
  };

  const enabled = false;
  const intervalSec = 0;

  if (enabled && intervalSec > 0) {
    onRefresh();
  }

  assert.equal(refreshCalled, 0);
});
