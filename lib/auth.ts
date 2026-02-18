export type AppRole = 'student' | 'teacher' | 'admin';

export const getDashboardRoute = (role?: string | null) =>
  role === 'teacher' || role === 'admin' ? '/admin/dashboard' : '/dashboard';
