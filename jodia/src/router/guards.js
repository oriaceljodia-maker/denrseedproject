import { ROLES, ROUTES } from '../config/constants.js';

export const Guards = {
  // Enforces authorization and password change requirements
  determineTargetRoute(user, currentPath) {
    if (!user) {
      return ROUTES.LOGIN;
    }

    // Collect a required new password first. It is saved only after MFA,
    // so neither the dashboard nor database protections are bypassed.
    const needsPassword = user.requiresPasswordChange || sessionStorage.getItem('denr-password-recovery') === 'true';
    if (needsPassword && !user.passwordSetupReady) {
      return ROUTES.FORCE_PASSWORD;
    }

    // A pending password must be finalized even if this session is already AAL2.
    if (user.mfaVerified !== true || user.passwordSetupReady) return ROUTES.MFA;

    // Redirect to default route if user is at login or password page
    if ([ROUTES.LOGIN, ROUTES.MFA, ROUTES.FORCE_PASSWORD, '/'].includes(currentPath)) {
      return user.role === ROLES.ADMIN ? ROUTES.ADMIN_DASHBOARD : ROUTES.PERSONNEL_DASHBOARD;
    }

    // Role-based route protection
    if (currentPath.startsWith('/admin') && user.role !== ROLES.ADMIN) {
      return ROUTES.PERSONNEL_DASHBOARD;
    }

    if (currentPath.startsWith('/personnel') && user.role !== ROLES.PERSONNEL) {
      return ROUTES.ADMIN_DASHBOARD;
    }

    return currentPath;
  }
};
