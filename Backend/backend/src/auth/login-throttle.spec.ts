import { LoginThrottle } from './login-throttle.js';

describe('LoginThrottle', () => {
  let now: number;
  let throttle: LoginThrottle;

  beforeEach(() => {
    now = 0;
    throttle = new LoginThrottle(() => now);
  });

  const fail = (times: number) => {
    for (let i = 0; i < times; i += 1) throttle.recordFailure('key');
  };

  it('blocks after ten failures', () => {
    fail(9);
    expect(throttle.isBlocked('key')).toBe(false);
    fail(1);
    expect(throttle.isBlocked('key')).toBe(true);
    expect(throttle.isBlocked('other')).toBe(false);
  });

  it('unblocks when the window ends', () => {
    fail(10);
    now = 15 * 60 * 1000;
    expect(throttle.isBlocked('key')).toBe(false);
  });

  it('clears failures after a successful login', () => {
    fail(9);
    throttle.recordSuccess('key');
    fail(9);
    expect(throttle.isBlocked('key')).toBe(false);
  });
});
