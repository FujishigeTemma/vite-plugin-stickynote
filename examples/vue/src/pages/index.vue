<script setup lang="ts">
import { ref } from "vue";
import HeroCard from "../components/HeroCard.vue";
import Counter from "../components/Counter.vue";

const items = ref(["First note", "Second note", "Third note"]);
</script>

<template>
  <section class="home">
    <HeroCard title="stickynote demo" subtitle="Press ⌘/Ctrl + . to toggle the overlay." />
    <Counter />
    <ul class="notes">
      <li v-for="item in items" :key="item" class="note">{{ item }}</li>
    </ul>
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.notes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.note {
  padding: 12px 16px;
  background: var(--code-bg);
  border-radius: 8px;
}
</style>
