<template>
  <span class="brand"
    ><span class="brand-icon" aria-hidden="true"><i /><i /><i /></span>livekeys<span class="brand-period">.</span></span
  >
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  font-size: 25px;
  font-weight: 800;
  letter-spacing: -1.5px;
}
.brand-icon {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  margin-right: 9px;
  height: 22px;
}
.brand-icon i {
  background: currentColor;
  width: 5px;
  height: 16px;
  border-radius: 2px;
}
.brand-icon i:nth-child(2) {
  height: 23px;
}
.brand-icon i:nth-child(3) {
  height: 19px;
}
.brand-period {
  color: var(--accent);
}
</style>
