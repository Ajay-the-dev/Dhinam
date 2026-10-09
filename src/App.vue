<script setup>
import { RouterView, RouterLink } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink to="/" class="brand" aria-label="Dhinam — Malayalam calendar, home">
        <span class="brand-mark" aria-hidden="true">
          <span class="brand-glyph" lang="ml">ദി</span>
        </span>
        <span class="brand-text" aria-hidden="true">
          <span class="brand-name">Dhinam</span>
          <span class="brand-tagline" lang="ml">മലയാളം കലണ്ടർ</span>
        </span>
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
  gap: 0.75rem;
  color: token(text);
  text-decoration: none;
  border-radius: radius('md');
  @include focus-ring;
}

.brand-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: radius('md');
  color: #fff;
  background:
    radial-gradient(120% 90% at 20% 10%, rgba(255, 255, 255, 0.22), transparent 55%),
    linear-gradient(145deg, token(hero-start), token(hero-end));
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.18) inset,
    0 8px 18px -8px token(glow-1),
    0 4px 10px -6px rgba(0, 0, 0, 0.35);
  transition: transform 0.4s $ease-out, box-shadow 0.4s $ease-out;

  // Kasavu border: a gold band with a thin echo line above it
  &::after {
    content: '';
    position: absolute;
    inset: auto 0 0;
    height: 7px;
    background:
      linear-gradient(token(accent), token(accent)) bottom / 100% 3px no-repeat,
      linear-gradient(token(accent), token(accent)) top / 100% 1px no-repeat;
    opacity: 0.95;
  }

  // Rising sun — a nod to "dhinam" (day)
  &::before {
    content: '';
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: token(accent);
    box-shadow: 0 0 8px 1px token(accent-glow);
  }
}

.brand-glyph {
  font-family: 'Noto Sans Malayalam', sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1;
  transform: translateY(-1px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.brand-name {
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  background: linear-gradient(100deg, token(text) 40%, token(primary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-tagline {
  margin-top: 0.3rem;
  font-family: 'Noto Sans Malayalam', sans-serif;
  font-size: 0.68rem;
  font-weight: 500;
  color: token(muted);
  letter-spacing: 0.02em;
}

.brand:hover .brand-mark {
  transform: translateY(-1px) rotate(-4deg);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.18) inset,
    0 12px 22px -8px token(glow-1),
    0 6px 14px -6px rgba(0, 0, 0, 0.35);
}

@include reduced-motion {
  .brand-mark {
    transition: none;
  }

  .brand:hover .brand-mark {
    transform: none;
  }
}
</style>
