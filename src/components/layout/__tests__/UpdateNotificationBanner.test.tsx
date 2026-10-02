import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpdateNotificationBanner } from '../UpdateNotificationBanner';
import {
  setUpdateAvailable,
} from '@/services/deployment/deploymentRecoveryService';
import {
  DEPLOYMENT_RECOVERY_CONFIG,
  DeploymentRecoveryConfigError,
  type DeploymentRecoveryConfig,
} from '@/services/deployment/deploymentRecoveryConfig';

describe('UpdateNotificationBanner Component', () => {
  beforeEach(() => {
    setUpdateAvailable(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when no update is available', () => {
    setUpdateAvailable(false);
    const html = renderToStaticMarkup(<UpdateNotificationBanner isMatchActive={true} />);
    expect(html).toBe('');
  });

  it('renders banner with accessibility attributes and button when update is available during active match', () => {
    setUpdateAvailable(true);
    const html = renderToStaticMarkup(<UpdateNotificationBanner isMatchActive={true} />);

    expect(html).toContain('class="update-notification-banner"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="New application version notification"');
    expect(html).toContain('New version available. Will update after match.');
    expect(html).toContain('id="btn-update-now"');
    expect(html).toContain('aria-label="Update to latest version now"');
    expect(html).toContain('Update Now');
  });

  it('renders banner indicating immediate updating when not in an active match', () => {
    setUpdateAvailable(true);
    const html = renderToStaticMarkup(<UpdateNotificationBanner isMatchActive={false} />);

    expect(html).toContain('class="update-notification-banner"');
    expect(html).toContain('Updating...');
  });

  it('accepts and validates custom deployment recovery configuration', () => {
    setUpdateAvailable(true);
    const customConfig: DeploymentRecoveryConfig = {
      ...DEPLOYMENT_RECOVERY_CONFIG,
      nonActiveMatchReloadDelayMs: 250,
    };

    const html = renderToStaticMarkup(
      <UpdateNotificationBanner isMatchActive={true} config={customConfig} />
    );
    expect(html).toContain('class="update-notification-banner"');

    expect(() =>
      renderToStaticMarkup(
        <UpdateNotificationBanner
          isMatchActive={true}
          config={{ ...customConfig, nonActiveMatchReloadDelayMs: -10 }}
        />
      )
    ).toThrow(DeploymentRecoveryConfigError);
  });
});
