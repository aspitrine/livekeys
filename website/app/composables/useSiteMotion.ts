import type { Ref } from 'vue';

/** Animation is a progressive enhancement: all content remains visible without JS. */
export function useSiteMotion(root: Readonly<Ref<HTMLElement | null>>) {
  let dispose: (() => void) | undefined;
  let unmounted = false;
  onMounted(async () => {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    if (unmounted || !root.value) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add(
      { motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 800px) and (pointer: fine)' },
      (context) => {
        const { motion, desktop } = context.conditions!;
        if (!motion) return;
        const scope = root.value!;
        gsap.from(scope.querySelectorAll('.hero-copy > *'), {
          y: 22,
          opacity: 0,
          duration: 0.8,
          stagger: 0.09,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        });
        scope.querySelectorAll<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.from(element, {
            y: 28,
            opacity: 0,
            duration: 0.75,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            scrollTrigger: { trigger: element, start: 'top 94%', once: true },
          });
        });
        if (!desktop) return;
        scope.querySelectorAll<HTMLElement>('[data-parallax]').forEach((element) => {
          const distance = Number(element.dataset.parallax);
          gsap.fromTo(
            element,
            { y: -distance / 2 },
            {
              y: distance / 2,
              ease: 'none',
              scrollTrigger: { trigger: element.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
            },
          );
        });
        const device = scope.querySelector<HTMLElement>('[data-tilt]');
        const scene = scope.querySelector<HTMLElement>('.hero-scene');
        if (!device || !scene) return;
        gsap.set(device, { rotateX: 10, rotateY: -15, rotateZ: -8, transformPerspective: 1400 });
        const rotateX = gsap.quickTo(device, 'rotateX', { duration: 0.6, ease: 'power2.out' });
        const rotateY = gsap.quickTo(device, 'rotateY', { duration: 0.6, ease: 'power2.out' });
        function move(event: PointerEvent) {
          const rect = scene!.getBoundingClientRect();
          rotateX(10 - ((event.clientY - rect.top) / rect.height - 0.5) * 9);
          rotateY(-15 + ((event.clientX - rect.left) / rect.width - 0.5) * 12);
        }
        function reset() {
          rotateX(10);
          rotateY(-15);
        }
        scene.addEventListener('pointermove', move);
        scene.addEventListener('pointerleave', reset);
        return () => {
          scene.removeEventListener('pointermove', move);
          scene.removeEventListener('pointerleave', reset);
        };
      },
      root.value,
    );
    dispose = () => media.revert();
  });
  onUnmounted(() => {
    unmounted = true;
    dispose?.();
  });
}
