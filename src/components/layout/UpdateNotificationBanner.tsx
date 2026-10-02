/**
 * Update Notification Banner Component.
 *
 * Displays a non-intrusive status notification when a newly deployed version
 * of Schada is available during active gameplay. Allows immediate manual refresh
 * or automatically defers reload until after the match concludes to preserve
 * player move integrity and clock synchronization.
 *
 * Features:
 * - Responsive layout supporting both desktop and mobile form factors.
 * - Symmetrical dark and light mode formatting adhering to design system tokens.
 * - Configuration-driven reload delays without hard-coded fallbacks.
 */

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  isUpdateAvailable,
  onUpdateAvailable,
  executeDebouncedReload,
} from '@/services/deployment/deploymentRecoveryService';
import {
  DEPLOYMENT_RECOVERY_CONFIG,
  validateDeploymentRecoveryConfig,
  type DeploymentRecoveryConfig,
} from '@/services/deployment/deploymentRecoveryConfig';

export interface UpdateNotificationBannerProps {
  readonly isMatchActive: boolean;
  readonly config?: DeploymentRecoveryConfig;
}

/**
 * UpdateNotificationBanner functional component.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time React render cycle.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant.
 */
export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  isMatchActive,
  config = DEPLOYMENT_RECOVERY_CONFIG,
}) => {
  validateDeploymentRecoveryConfig(config);

  const [hasUpdate, setHasUpdate] = useState<boolean>(() => isUpdateAvailable());

  useEffect(() => {
    const unsubscribe = onUpdateAvailable(() => {
      setHasUpdate(true);
    });
    return unsubscribe;
  }, []);

  // When an update is detected, if the user is not in an active match, reload after a brief delay.
  // If the user transitions out of an active match while an update is pending, trigger reload cleanly.
  useEffect(() => {
    if (hasUpdate && !isMatchActive) {
      const timer = setTimeout(() => {
        executeDebouncedReload(config);
      }, config.nonActiveMatchReloadDelayMs);
      return () => clearTimeout(timer);
    }
  }, [hasUpdate, isMatchActive, config]);

  if (!hasUpdate) return null;

  const handleUpdateNow = () => {
    executeDebouncedReload(config);
  };

  return (
    <div
      className="update-notification-banner"
      role="status"
      aria-live="polite"
      aria-label="New application version notification"
      id="update-notification-banner"
    >
      <div className="update-notification-content">
        <RefreshCw size={16} className="update-notification-icon spin" aria-hidden="true" />
        <span className="update-notification-text">
          New version available. {isMatchActive ? 'Will update after match.' : 'Updating...'}
        </span>
      </div>
      <button
        id="btn-update-now"
        type="button"
        className="update-notification-action"
        onClick={handleUpdateNow}
        aria-label="Update to latest version now"
      >
        Update Now
      </button>
    </div>
  );
};
