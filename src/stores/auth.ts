import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '../lib/supabase';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => {
    return user.value?.user_metadata?.role === 'admin';
  });
  
  // Initialize auth state
  const initialize = async () => {
    isLoading.value = true;
    
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        user.value = session.user;
        
        // Get user profile to check role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          // Store role in user metadata
          user.value.user_metadata = {
            ...user.value.user_metadata,
            role: profile.role
          };
        }
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
    } finally {
      isLoading.value = false;
    }
    
    // Set up auth state change listener
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        user.value = session.user;
        
        // Get user profile to check role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          // Store role in user metadata
          user.value.user_metadata = {
            ...user.value.user_metadata,
            role: profile.role
          };
        }
      } else if (event === 'SIGNED_OUT') {
        user.value = null;
      }
    });
  };
  
  // Login with email and password
  const login = async (email: string, password: string): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        throw authError;
      }
      
      if (data.user) {
        user.value = data.user;
        
        // Get user profile to check role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        
        if (profile) {
          // Store role in user metadata
          user.value.user_metadata = {
            ...user.value.user_metadata,
            role: profile.role
          };
        }
        
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Login error:', err);
      error.value = err instanceof Error ? err.message : 'Login failed';
      return false;
    } finally {
      isLoading.value = false;
    }
  };
  
  // Logout
  const logout = async () => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const { error: authError } = await supabase.auth.signOut();
      
      if (authError) {
        throw authError;
      }
      
      user.value = null;
    } catch (err) {
      console.error('Logout error:', err);
      error.value = err instanceof Error ? err.message : 'Logout failed';
    } finally {
      isLoading.value = false;
    }
  };
  
  return {
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    error,
    initialize,
    login,
    logout
  };
});