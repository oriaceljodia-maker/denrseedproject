import { supabase } from '../config/supabase.js';

const formatAuditEntry = (entry) => ({
  id: `audit-${entry.id}`,
  action: entry.action,
  details: entry.details || '',
  actorName: entry.profiles?.full_name || 'System',
  actorRole: entry.profiles?.role || '',
  createdAt: entry.created_at,
  kind: 'audit'
});

const formatLoginEntry = (entry) => ({
  id: `login-${entry.id}`,
  action: 'Signed In',
  details: entry.email || '',
  actorName: entry.profiles?.full_name || 'Unknown user',
  actorRole: entry.profiles?.role || '',
  createdAt: entry.created_at,
  kind: 'login'
});

export const AuditTrailService = {
  async getActivity(limit = null) {
    const [auditResult, loginResult] = await Promise.all([
      supabase
        .from('audit_trail')
        .select('id, action, details, created_at, profiles!audit_trail_actor_id_fkey(full_name, role)')
        .order('created_at', { ascending: false }),
      supabase
        .from('login_activity')
        .select('id, email, created_at, profiles(full_name, role)')
        .order('created_at', { ascending: false })
    ]);

    if (loginResult.error) throw loginResult.error;

    const activity = [
      ...(auditResult.data || []).map(formatAuditEntry),
      ...(loginResult.data || []).map(formatLoginEntry)
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      activity: limit ? activity.slice(0, limit) : activity,
      auditTrailAvailable: !auditResult.error
    };
  }
};
