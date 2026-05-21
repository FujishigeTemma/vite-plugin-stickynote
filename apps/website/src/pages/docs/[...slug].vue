<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import HeroCard from "../../components/HeroCard.vue";

const route = useRoute();
const slug = computed(() => {
  const raw = route.params.slug;
  return Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
});
</script>

<template>
  <section class="docs">
    <HeroCard :title="`Docs · ${slug}`" subtitle="catch-all route: /docs/:slug(.*)" />
    <article class="card">
      <p>
        URL: <code>/docs/{{ slug }}</code
        ><br />
        Route pattern: catch-all (varies by router config). Useful to confirm the runtime captures
        the abstracted pattern even for repeatable params.
      </p>
    </article>
  </section>
</template>

<style scoped>
.docs {
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
