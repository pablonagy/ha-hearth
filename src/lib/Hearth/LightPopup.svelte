<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { activateOnKeyboard } from './interaction';
	import { states } from '$lib/core/ha/entities';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from './config';
	import { horizontalDrag } from './drag';
	import { callEntityService, controlOverrides, markPending } from '$lib/core/ha/commands';
	import {
		lightHsFor,
		lightViewFor,
		setLightHs,
		setLightLevel,
		setLightTemp
	} from '$lib/core/domains/light';
	import HueWheel from './HueWheel.svelte';
	import PopupSlider from './PopupSlider.svelte';
	import { pressFeedback } from './pressFeedback';

	let {
		entity,
		sliderUpdates = 'continuous'
	}: { entity: string; sliderUpdates?: SliderUpdateMode } = $props();

	let view = $derived(lightViewFor(entity, $states, $controlOverrides));
	// tab choice is local UI state; the light's actual mode is the default
	let tabChoice = $state<'temp' | 'color' | 'white' | null>(null);
	let mode = $derived(tabChoice ?? view.mode);
	let kelvinLabel = $derived(
		`${view.kelvin}K · ${$lang(view.kelvin < 3300 ? 'hearth_warm_white' : view.kelvin < 5000 ? 'hearth_neutral_white' : 'hearth_cool_white')}`
	);

	let attributes = $derived($states?.[entity]?.attributes ?? {});
	let colorModes: string[] = $derived(
		Array.isArray(attributes.supported_color_modes) ? attributes.supported_color_modes : []
	);
	let supportsWhite = $derived(colorModes.includes('white'));
	let effectList: string[] = $derived(
		Array.isArray(attributes.effect_list) ? attributes.effect_list : []
	);
	let currentEffect = $derived(attributes.effect);

	function callLightService(name: string, data: Record<string, unknown>) {
		callEntityService('light', name, entity, data);
	}

	function selectWhite() {
		tabChoice = 'white';
		callLightService('turn_on', { white: true });
	}

	function selectEffect(effect: string) {
		callLightService('turn_on', { effect });
	}

	// a preset is one discrete command, so it pulses like the other buttons
	function selectPreset(level: number) {
		setLightLevel(entity, level);
		markPending(entity);
	}

	// true, fully saturated colours, sent as hue and saturation and drawn as
	// the light emits them
	const COLOR_PRESETS = [
		{ hue: 0, name: 'hearth_color_red' },
		{ hue: 30, name: 'hearth_color_orange' },
		{ hue: 52, name: 'hearth_color_yellow' },
		{ hue: 120, name: 'hearth_color_green' },
		{ hue: 185, name: 'hearth_color_cyan' },
		{ hue: 230, name: 'hearth_color_blue' },
		{ hue: 275, name: 'hearth_color_purple' },
		{ hue: 320, name: 'hearth_color_pink' }
	];

	let hs = $derived(lightHsFor(entity, $states, $controlOverrides));

	function presetSelected(hue: number) {
		if (!hs || hs[1] < 75) return false;
		const distance = Math.abs(((hs[0] - hue + 540) % 360) - 180);
		return distance <= 10;
	}

	function selectColor(hue: number, saturation: number, commit = true) {
		tabChoice = 'color';
		setLightHs(entity, hue, saturation, commit);
	}
</script>

<PopupSlider
	label={$lang('hearth_brightness')}
	icon="light_mode"
	value={view.on ? view.level : 0}
	variant="amber"
	updateMode={sliderUpdates}
	onchange={(value, commit) => setLightLevel(entity, value, commit)}
/>

<div class="presets">
	{#each [25, 50, 100] as preset (preset)}
		<div
			class="preset pressable"
			use:Ripple={PRESS_RIPPLE}
			use:pressFeedback={entity}
			onclick={() => selectPreset(preset)}
			role="button"
			tabindex="0"
			onkeydown={(event) => activateOnKeyboard(event, () => selectPreset(preset))}
		>
			{preset}%
		</div>
	{/each}
</div>

<div class="color-header">
	<div class="color-label">{$lang('hearth_color')}</div>
	<div class="tabs">
		<div
			class="tab pressable"
			class:active={mode === 'temp'}
			onclick={() => (tabChoice = 'temp')}
			role="button"
			tabindex="0"
			onkeydown={(event) => activateOnKeyboard(event, () => (tabChoice = 'temp'))}
		>
			{$lang('color_temp')}
		</div>
		<div
			class="tab pressable"
			class:active={mode === 'color'}
			onclick={() => (tabChoice = 'color')}
			role="button"
			tabindex="0"
			onkeydown={(event) => activateOnKeyboard(event, () => (tabChoice = 'color'))}
		>
			{$lang('color')}
		</div>
		{#if supportsWhite}
			<div
				class="tab pressable"
				class:active={mode === 'white'}
				use:pressFeedback={entity}
				onclick={selectWhite}
				role="button"
				tabindex="0"
				onkeydown={(event) => activateOnKeyboard(event, selectWhite)}
			>
				{$lang('hearth_white')}
			</div>
		{/if}
	</div>
</div>

{#if mode === 'temp'}
	<div
		class="temp-bar"
		use:horizontalDrag={{
			set: (value, commit) => setLightTemp(entity, value, commit),
			updateMode: sliderUpdates
		}}
	>
		<div class="temp-thumb" style:left="calc({view.tempPct}% - 9px)"></div>
	</div>
	<div class="temp-labels">
		<span>{$lang('hearth_candle')}</span>
		<span class="kelvin">{kelvinLabel}</span>
		<span>{$lang('hearth_daylight')}</span>
	</div>
{:else if mode === 'color'}
	<HueWheel hue={hs?.[0]} saturation={hs?.[1]} onchange={selectColor} />
	<div class="swatches">
		{#each COLOR_PRESETS as preset (preset.hue)}
			<div
				class="swatch pressable"
				class:selected={presetSelected(preset.hue)}
				style:background="hsl({preset.hue} 100% 50%)"
				use:pressFeedback={entity}
				onclick={() => selectColor(preset.hue, 100)}
				role="button"
				tabindex="0"
				aria-label={$lang(preset.name)}
				aria-pressed={presetSelected(preset.hue)}
				onkeydown={(event) => activateOnKeyboard(event, () => selectColor(preset.hue, 100))}
			></div>
		{/each}
	</div>
{/if}

{#if effectList.length}
	<div class="color-header">
		<div class="color-label">{$lang('hearth_effect')}</div>
	</div>
	<div class="effects">
		{#each effectList as effect (effect)}
			<div
				class="effect-chip pressable"
				class:active={currentEffect === effect}
				use:Ripple={PRESS_RIPPLE}
				use:pressFeedback={entity}
				onclick={() => selectEffect(effect)}
				role="button"
				tabindex="0"
				onkeydown={(event) => activateOnKeyboard(event, () => selectEffect(effect))}
			>
				{effect}
			</div>
		{/each}
	</div>
{/if}

<style>
	.presets {
		display: flex;
		gap: 10px;
		margin-top: 12px;
	}

	.preset {
		flex: 1;
		text-align: center;
		padding: 12px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		font-size: var(--h-type-body);
		color: var(--h-text-3);
		cursor: pointer;
	}

	.color-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 24px 0 10px;
	}

	.color-label {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
	}

	.tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: var(--h-radius-xs);
		background: var(--h-track);
	}

	.tab {
		padding: 8px 14px;
		border-radius: var(--h-radius-tight);
		font-size: var(--h-type-secondary);
		cursor: pointer;
		color: var(--h-icon);
	}

	.tab.active {
		background: rgb(var(--h-accent-rgb) / calc(0.2 * var(--h-accent-scale)));
		color: var(--h-accent-text);
		font-weight: 600;
	}

	.temp-bar {
		position: relative;
		height: 44px;
		border-radius: var(--h-radius-sm);
		overflow: hidden;
		background: linear-gradient(90deg, #ff9d4d, #ffc98a, #fff0dc, #eef4ff, #c9ddff)
			/* literal ok: colour temperature gradient is a physical scale */;
		cursor: pointer;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.temp-thumb {
		position: absolute;
		top: 4px;
		bottom: 4px;
		width: 18px;
		border-radius: var(--h-radius-tight);
		background: rgba(255, 255, 255, 0.95)
			/* literal ok: colour temperature gradient is a physical scale */;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4)
			/* literal ok: colour temperature gradient is a physical scale */;
		border: 2px solid var(--h-sheet-0);
	}

	.temp-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 8px;
		font-size: var(--h-type-small);
		color: var(--h-icon);
	}

	.kelvin {
		color: var(--h-text-2);
		font-weight: 600;
	}

	.swatches {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}

	/* full strength: a swatch shows the colour the light will give off */
	.swatch {
		flex: 1;
		height: 36px;
		border-radius: var(--h-radius-sm);
		cursor: pointer;
	}

	.swatch.selected {
		outline: 2px solid var(--h-text-1);
		outline-offset: 3px;
		opacity: 1;
	}

	.effects {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.effect-chip {
		padding: 8px 14px;
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		font-size: var(--h-type-secondary);
		color: var(--h-text-3);
		cursor: pointer;
	}

	.effect-chip.active {
		background: rgb(var(--h-accent-rgb) / calc(0.2 * var(--h-accent-scale)));
		color: var(--h-accent-text);
		font-weight: 600;
		border-color: transparent;
	}
</style>
