<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const isMapPage = computed(() => route.path === '/')
</script>

<template>
  <div class="app-container">
    <header>
      <h1>Route Planner</h1>
      <nav v-if="$route.path !== '/login'">
        <router-link to="/">Home</router-link>
        <router-link to="/admin">Admin</router-link>
      </nav>
    </header>
    <main :class="{ 'map-main': isMapPage }">
      <router-view />
    </main>
  </div>
</template>

<style>
/* Global styles */
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: #213547;
  background-color: #ffffff;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  background-color: #6366F1;
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 1.5rem;
  font-weight: 600;
}

nav {
  display: flex;
  gap: 1rem;
}

nav a {
  color: white;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

nav a:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

nav a.router-link-active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: 500;
}

main {
  flex: 1;
  overflow: auto;
}

.map-main {
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: rgba(255, 255, 255, 0.87);
    background-color: #242424;
  }
}
</style>