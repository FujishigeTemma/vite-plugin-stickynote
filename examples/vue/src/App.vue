<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="app">
    <nav class="nav">
      <RouterLink to="/" class="nav-link">Home</RouterLink>
      <RouterLink to="/about" class="nav-link">About</RouterLink>
      <RouterLink to="/services/001" class="nav-link">Service 001</RouterLink>
      <RouterLink to="/services/002" class="nav-link">Service 002</RouterLink>
    </nav>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px;
}
.nav {
  display: flex;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}
.nav-link {
  color: var(--text);
  text-decoration: none;
}
.nav-link:hover,
.nav-link.router-link-active {
  color: var(--accent);
}
</style>
