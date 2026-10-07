<script setup>
import { RouterView, RouterLink } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink to="/" class="brand">
        <span class="brand-mark" aria-hidden="true">ക</span>
        <span class="brand-name">Mal<strong>Cal</strong></span>
      </RouterLink>
    </header>
    <RouterView />
  </div>
</template>

<style lang="scss" scoped>
.app-shell {
  max-width: 1400px;
  margin: 0 auto;
}

.topbar {
  display: flex;
  align-items: center;
  padding: 1.25rem 1rem;

  @include up('lg') {
    padding: 1.5rem 2rem;
  }
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  color: token(text);
  text-decoration: none;
  font-size: 1.25rem;
  letter-spacing: -0.01em;
  @include focus-ring;

  strong {
    color: token(primary);
    font-weight: 700;
  }
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: radius('md');
  color: #fff;
  font-weight: 700;
  background: linear-gradient(135deg, token(hero-start), token(hero-end));
  box-shadow: inset 0 -3px 0 token(accent);
}
</style>
