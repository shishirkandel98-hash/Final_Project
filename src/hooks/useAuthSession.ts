import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AuthSessionState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

// Global cache for auth state to prevent duplicate checks
let cachedSession: Session | null = null;
let sessionChecked = false;

export function useAuthSession(redirectToAuth = false) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthSessionState>({
    user: cachedSession?.user || null,
    session: cachedSession,
    loading: !sessionChecked,
    isAuthenticated: !!cachedSession,
  });

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // If we already checked, use cached value
      if (sessionChecked && cachedSession) {
        if (mounted) {
          setState({
            user: cachedSession.user,
            session: cachedSession,
            loading: false,
            isAuthenticated: true,
          });
        }
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        cachedSession = session;
        sessionChecked = true;

        if (mounted) {
          if (!session && redirectToAuth) {
            navigate("/auth", { replace: true });
            return;
          }

          setState({
            user: session?.user || null,
            session,
            loading: false,
            isAuthenticated: !!session,
          });
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (mounted) {
          setState(prev => ({ ...prev, loading: false }));
          if (redirectToAuth) {
            navigate("/auth", { replace: true });
          }
        }
      }
    };

    initAuth();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        cachedSession = session;
        sessionChecked = true;

        // Auto-assign admin role for specific email
        if (session?.user?.email === 'shishirxkandel@gmail.com') {
          try {
            const { error } = await supabase
              .from('user_roles')
              .upsert(
                { user_id: session.user.id, role: 'admin' },
                { onConflict: 'user_id,role' }
              );
            if (error) {
              console.error('Failed to assign admin role:', error);
            }
          } catch (err) {
            console.error('Error assigning admin role:', err);
          }
        }

        if (mounted) {
          if (!session && redirectToAuth) {
            navigate("/auth", { replace: true });
            return;
          }

          setState({
            user: session?.user || null,
            session,
            loading: false,
            isAuthenticated: !!session,
          });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, redirectToAuth]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      cachedSession = null;
      sessionChecked = false;
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, [navigate]);

  return { ...state, signOut };
}

// Clear cache on demand (useful for testing)
export function clearAuthCache() {
  cachedSession = null;
  sessionChecked = false;
}
