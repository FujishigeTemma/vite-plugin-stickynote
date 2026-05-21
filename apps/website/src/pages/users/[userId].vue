<script setup lang="ts">
import { RouterView, useRoute } from "vue-router";
import { computed } from "vue";
import HeroCard from "../../components/HeroCard.vue";

const route = useRoute();
const userId = computed(() => String(route.params.userId ?? ""));
const isLeaf = computed(() => route.matched[route.matched.length - 1]?.name === "/users/[userId]");
</script>

<template>
  <section class="user">
    <HeroCard :title="`User ${userId}`" subtitle="route: /users/:userId" />
    <article v-if="isLeaf" class="card">
      <p>
        URL: <code>/users/{{ userId }}</code
        >, route pattern: <code>/users/:userId</code>.
      </p>
      <p>
        <RouterLink :to="`/users/${userId}/posts/p-001`" class="link">
          Open Post p-001 →
        </RouterLink>
      </p>
      <p>
        <RouterLink :to="`/users/${userId}/posts/p-002`" class="link">
          Open Post p-002 →
        </RouterLink>
      </p>
    </article>
    <RouterView v-else />
  </section>
</template>

<style scoped>
.user {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.card {
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--code-bg);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.link {
  color: var(--accent);
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}
</style>
