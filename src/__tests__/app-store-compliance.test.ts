import { AppStoreCompliance } from '../utils/app-store-compliance.ts';

describe('AppStoreCompliance', () => {
  it('returns a compliance report with expected keys', () => {
    const report = AppStoreCompliance.getInstance().getComplianceReport();
    expect(report).toHaveProperty('serviceWorker');
    expect(report).toHaveProperty('localStorage');
    expect(report).toHaveProperty('performanceObserver');
    expect(report).toHaveProperty('webGL');
    expect(report).toHaveProperty('canvas');
    expect(report).toHaveProperty('audio');
  });
});
