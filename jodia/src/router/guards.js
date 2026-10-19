import { ROLES, ROUTES } from '../config/constants.js';

export const Guards = {
  // Enforces authorization and password change requirements
  determineTargetRoute(user, currentPath) {
    if (!user) {
      return ROUTES.LOGIN;
    }

    // Mandatory for both roles and for existing password/recovery sessions.
    // Missing or failed status must never grant access to a protected page.
    if (user.mfaVerified !== true) {
      return ROUTES.MFA;
    }

    if (sessionStorage.getItem('denr-password-recovery') === 'true') {
      return ROUTES.FORCE_PASSWORD;
    }

    if (user.requiresPasswordChange) {
      return ROUTES.FORCE_PASSWORD;
    }

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
