<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

onMounted(() => {
  // If already authenticated, redirect
  if (authStore.isAuthenticated) {
    const redirectPath = route.query.redirect as string || '/admin';
    router.push(redirectPath);
  }
});

const login = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = 'Please enter both email and password';
    return;
  }
  
  isLoading.value = true;
  
  try {
    const success = await authStore.login(email.value, password.value);
    
    if (success) {
      // Redirect to the original requested page or admin page
      const redirectPath = route.query.redirect as string || '/admin';
      router.push(redirectPath);
    } else {
      errorMessage.value = 'Invalid email or password';
    }
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'An error occurred during login';
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h2>Admin Login</h2>
      <p class="login-info">Please log in to access the admin area</p>
      
      <form @submit.prevent="login" class="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            id="email" 
            v-model="email" 
            type="email" 
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input 
            id="password" 
            v-model="password" 
            type="password" 
            placeholder="Enter your password"
            required
          />
        </div>
        
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        
        <button 
          type="submit" 
          class="login-button" 
          :disabled="isLoading || authStore.isLoading"
        >
          {{ isLoading || authStore.isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
      
      <div class="login-help">
        <p>Note: You need to set up Supabase authentication.</p>
        <p>Please click "Connect to Supabase" in the top right corner to set up your database and authentication.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  padding: 2rem;
  background-color: #f3f4f6;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

h2 {
  margin-top: 0;
  color: #1f2937;
  font-size: 1.5rem;
  text-align: center;
}

.login-info {
  margin-bottom: 1.5rem;
  color: #6b7280;
  text-align: center;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
}

input {
  padding: 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

input:focus {
  outline: none;
  border-color: #6366F1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.error-message {
  padding: 0.5rem;
  background-color: #fee2e2;
  border-radius: 4px;
  color: #b91c1c;
  font-size: 0.875rem;
}

.login-button {
  margin-top: 0.5rem;
  padding: 0.625rem;
  background-color: #6366F1;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-button:hover:not(:disabled) {
  background-color: #4F46E5;
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-help {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #6b7280;
}

.login-help p {
  margin: 0.25rem 0;
}

code {
  padding: 0.125rem 0.25rem;
  background-color: #f3f4f6;
  border-radius: 2px;
  font-family: monospace;
  color: #6366F1;
}
</style>