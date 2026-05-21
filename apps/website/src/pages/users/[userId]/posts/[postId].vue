<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import HeroCard from "../../../../components/HeroCard.vue";

const route = useRoute();
const userId = computed(() => String(route.params.userId ?? ""));
const postId = computed(() => String(route.params.postId ?? ""));
</script>

<template>
  <section class="post">
    <HeroCard :title="`Post ${postId}`" subtitle="route: /users/:userId/posts/:postId" />
    <article class="card">
      <p>
        URL: <code>/users/{{ userId }}/posts/{{ postId }}</code
        ><br />
        Route pattern: <code>/users/:userId/posts/:postId</code>.
      </p>
      <p>
        Two path params nested. Pins here should share across all userId/postId combinations because
        the runtime stores the route pattern.
      </p>
    </article>
  </section>
</template>

<style scoped>
.post {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.card {
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--code-bg);
}
</style>
