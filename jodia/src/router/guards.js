import { ROLES, ROUTES } from '../config/constants.js';

export const Guards = {
  // Enforces authorization and password change requirements
  determineTargetRoute(user, currentPath) {
    if (!user) {
      return ROUTES.LOGIN;
    }

    if (user.requiresPasswordChange) {
      return ROUTES.FORCE_PASSWORD;
    }

    // Redirect to default route if user is at login or password page
    if (currentPath === ROUTES.LOGIN || currentPath === ROUTES.FORCE_PASSWORD || currentPath === '/') {
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
