<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import HeroCard from "../../components/HeroCard.vue";

const route = useRoute();
const serviceId = computed(() => String(route.params.serviceId ?? ""));
</script>

<template>
  <section class="service">
    <HeroCard
      :title="`Service ${serviceId}`"
      subtitle="Pins dropped here are shared across every service id (route: /services/:serviceId)."
    />
    <article class="card">
      <h2 class="card-title">Overview</h2>
      <p>
        This page demonstrates dynamic-route comment sharing. The URL is
        <code>/services/{{ serviceId }}</code
        >, but the underlying route pattern is <code>/services/:serviceId</code>. Threads created on
        any service id show up on every other service id because the runtime stores the route
        pattern, not the literal URL.
      </p>
    </article>
    <ul class="features">
      <li class="feature">Provisioning</li>
      <li class="feature">Billing</li>
      <li class="feature">Audit log</li>
    </ul>
  </section>
</template>

<style scoped>
.service {
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
.card-title {
  margin: 0 0 8px;
  color: var(--text-h);
}
.features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.feature {
  padding: 12px 16px;
  background: var(--code-bg);
  border-radius: 8px;
}
</style>
