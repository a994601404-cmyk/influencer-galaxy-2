// Global test mode — when enabled, all data is tagged as test and hidden from normal users
const TEST_MODE_KEY = "pulseboost_test_mode";

export function isTestMode(): boolean {
  return localStorage.getItem(TEST_MODE_KEY) === "1";
}

export function setTestMode(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(TEST_MODE_KEY, "1");
  } else {
    localStorage.removeItem(TEST_MODE_KEY);
  }
}

export function getTestModeHeaders(): Record<string, string> {
  if (isTestMode()) {
    return { "x-test-mode": "1" };
  }
  return {};
}
