<script lang="ts">
	import { lang } from '$lib/core/i18n';

	/**
	 * A hue and saturation disc, as Home Assistant's own light dialog offers:
	 * the angle is the hue (red at the top, clockwise), the distance from the
	 * centre the saturation. Drag or tap to pick; arrow keys step the hue
	 * (left/right) and the saturation (up/down).
	 */
	let {
		hue,
		saturation,
		onchange
	}: {
		hue: number | undefined;
		saturation: number | undefined;
		onchange: (hue: number, saturation: number, commit: boolean) => void;
	} = $props();

	let wheel = $state<HTMLElement | undefined>();
	let dragging = $state(false);

	let thumb = $derived.by(() => {
		if (hue === undefined || saturation === undefined) return undefined;
		const radians = (hue * Math.PI) / 180;
		const radius = Math.min(1, Math.max(0, saturation / 100)) * 50;
		return { x: 50 + Math.sin(radians) * radius, y: 50 - Math.cos(radians) * radius };
	});

	function pick(event: PointerEvent, commit: boolean) {
		if (!wheel) return;
		const box = wheel.getBoundingClientRect();
		const dx = event.clientX - (box.left + box.width / 2);
		const dy = event.clientY - (box.top + box.height / 2);
		const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
		const distance = Math.hypot(dx, dy) / (box.width / 2);
		onchange((angle + 360) % 360, Math.min(1, distance) * 100, commit);
	}

	function down(event: PointerEvent) {
		if (event.button !== 0) return;
		dragging = true;
		wheel?.setPointerCapture?.(event.pointerId);
		pick(event, true);
	}

	function move(event: PointerEvent) {
		if (dragging) pick(event, true);
	}

	function up(event: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		pick(event, true);
	}

	function key(event: KeyboardEvent) {
		const h = hue ?? 0;
		const s = saturation ?? 100;
		const steps: Record<string, [number, number]> = {
			ArrowRight: [h + 10, s],
			ArrowLeft: [h - 10, s],
			ArrowUp: [h, Math.min(100, s + 10)],
			ArrowDown: [h, Math.max(0, s - 10)]
		};
		const next = steps[event.key];
		if (!next) return;
		event.preventDefault();
		onchange((next[0] + 360) % 360, next[1], true);
	}
</script>

<div
	class="wheel"
	class:dragging
	bind:this={wheel}
	role="slider"
	tabindex="0"
	aria-label={$lang('hearth_color_wheel')}
	aria-valuemin={0}
	aria-valuemax={360}
	aria-valuenow={Math.round(hue ?? 0)}
	aria-valuetext={hue === undefined
		? undefined
		: `${Math.round(hue)}°, ${Math.round(saturation ?? 0)}%`}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={() => (dragging = false)}
	onkeydown={key}
>
	{#if thumb && hue !== undefined && saturation !== undefined}
		<div
			class="thumb"
			style:left="{thumb.x}%"
			style:top="{thumb.y}%"
			style:background="hsl({hue} 100% {100 - saturation / 2}%)"
		></div>
	{/if}
</div>

<style>
	.wheel {
		position: relative;
		width: min(100%, 220px);
		aspect-ratio: 1;
		margin: 4px auto 0;
		border-radius: 50%;
		/* hue around the rim, fading to white at the centre: the same disc as
		   Home Assistant's colour picker */
		background:
			radial-gradient(circle closest-side, rgb(255 255 255) 0%, rgb(255 255 255 / 0) 100%),
			/* literal ok: the colour wheel is made of colours */
			conic-gradient(
					from 0deg,
					hsl(0 100% 50%),
					hsl(60 100% 50%),
					hsl(120 100% 50%),
					hsl(180 100% 50%),
					hsl(240 100% 50%),
					hsl(300 100% 50%),
					hsl(360 100% 50%)
				); /* literal ok: the colour wheel is made of colours */
		cursor: crosshair;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		box-shadow: var(--h-card-shadow);
	}

	.wheel:focus-visible {
		outline: 2px solid var(--h-accent-text);
		outline-offset: 4px;
	}

	.thumb {
		position: absolute;
		width: 24px;
		height: 24px;
		margin: -12px 0 0 -12px;
		border-radius: 50%;
		border: 3px solid var(--h-on-art-1);
		box-shadow: var(--h-card-shadow);
		pointer-events: none;
	}

	.wheel.dragging .thumb {
		width: 32px;
		height: 32px;
		margin: -16px 0 0 -16px;
	}
</style>
