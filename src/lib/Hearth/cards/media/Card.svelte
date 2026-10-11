<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import { timer } from '$lib/core/app/clock';
	import { horizontalDrag } from '../../drag';
	import type { OverviewCard } from '../../config';
	import { popup } from '../../store';
	import {
		controlOverrides,
		controlValueFor,
		pendingEntities,
		setControlOverride
	} from '$lib/core/ha/commands';
	import {
		mediaVolumeFor,
		seekMedia,
		setMediaVolume,
		skipMediaTrack,
		toggleMediaPlayback
	} from '$lib/core/domains/mediaPlayer';
	import Icon from '../../Icon.svelte';
	import Shortcuts from './Shortcuts.svelte';
	import TuneButton from '../../TuneButton.svelte';

	let { card }: { card: Extract<OverviewCard, { type: 'media' }> } = $props();

	let entity = $derived(card.entity ? $states?.[card.entity] : undefined);
	let pending = $derived(card.entity !== undefined && $pendingEntities[card.entity] !== undefined);
	let attributes = $derived(entity?.attributes ?? {});
	let playing = $derived(entity?.state === 'playing');
	let hasTrack = $derived(playing || entity?.state === 'paused');
	let duration = $derived(attributes.media_duration ?? 0);

	// media_player supported_features bits, as in MediaPopup
	const FEATURE = { volumeSet: 4, previousTrack: 16, nextTrack: 32 };
	let features = $derived(Number(attributes.supported_features ?? 0));
	let supports = (feature: number) => (features & feature) !== 0;
	let showPrevious = $derived(!!card.show_track_buttons && supports(FEATURE.previousTrack));
	let showNext = $derived(!!card.show_track_buttons && supports(FEATURE.nextTrack));
	let showVolume = $derived(
		!!card.show_volume && card.entity !== undefined && supports(FEATURE.volumeSet)
	);
	let volume = $derived(card.entity ? mediaVolumeFor(card.entity, $states, $controlOverrides) : 0);
	// the shared second clock drives the position readout while playing
	let now = $derived(playing ? $timer.getTime() : 0);

	// interpolate between websocket updates while playing
	let position = $derived.by(() => {
		const base = attributes.media_position ?? 0;
		if (!playing || !attributes.media_position_updated_at) return base;
		return Math.min(
			duration,
			base + (now - Date.parse(attributes.media_position_updated_at)) / 1000
		);
	});

	let progressFraction = $derived(
		card.entity
			? controlValueFor(
					`seek:${card.entity}`,
					duration ? position / duration : 0,
					$controlOverrides
				)
			: 0
	);
	let progressPercent = $derived(Math.round(progressFraction * 100));

	function formatTime(seconds: number) {
		const whole = Math.max(0, Math.round(seconds));
		const minutes = Math.floor(whole / 60);
		const rest = whole % 60;
		return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
	}

	function endScrub(value: number) {
		if (card.entity) seekMedia(card.entity, value / 100);
	}
</script>

<div
	class="card"
	style:height={card.height ? `${card.height}px` : undefined}
	style:min-height={card.height ? `${card.height}px` : undefined}
>
	{#if attributes.entity_picture}
		<img class="art" src={attributes.entity_picture} alt="" />
	{:else}
		<div class="art placeholder"></div>
	{/if}
	<div class="scrim"></div>
	{#if card.entity}
		{@const entity = card.entity}
		<div class="tune-wrap">
			<TuneButton
				onopen={() =>
					popup.set({
						kind: 'media',
						entity,
						name: attributes.friendly_name ?? 'Media'
					})}
			/>
		</div>
	{/if}
	<div class="controls">
		{#if card.entity && card.shortcuts?.length}
			<div class="shortcut-row">
				<Shortcuts
					entity={card.entity}
					shortcuts={card.shortcuts}
					defaultDevice={card.default_device}
				/>
			</div>
		{/if}
		<div class="track-row">
			<div class="track">
				{#if hasTrack}
					<div class="kicker">
						{$lang('hearth_now_playing')}{attributes.friendly_name
							? ` · ${attributes.friendly_name}`
							: ''}
					</div>
				{/if}
				<div class="title">{attributes.media_title ?? $lang('hearth_nothing_playing')}</div>
				<div class="artist">{attributes.media_artist ?? ''}</div>
			</div>
			{#if hasTrack}
				{#if showPrevious}
					<button
						type="button"
						class="skip pressable"
						aria-label={$lang('hearth_previous_track')}
						onclick={() => card.entity && skipMediaTrack(card.entity, 'previous')}
					>
						<Icon name="skip_previous" size={ICON.control} fill />
					</button>
				{/if}
				<button
					type="button"
					class="play pressable"
					class:pending
					aria-label={playing ? 'Pause' : 'Play'}
					onclick={() => card.entity && toggleMediaPlayback(card.entity)}
				>
					<Icon name={playing ? 'pause' : 'play_arrow'} size={ICON.tile} fill />
				</button>
				{#if showNext}
					<button
						type="button"
						class="skip pressable"
						aria-label={$lang('hearth_next_track')}
						onclick={() => card.entity && skipMediaTrack(card.entity, 'next')}
					>
						<Icon name="skip_next" size={ICON.control} fill />
					</button>
				{/if}
			{/if}
		</div>
		<div
			class="progress"
			use:horizontalDrag={{
				set: (value) => card.entity && setControlOverride(`seek:${card.entity}`, value / 100, 1500),
				end: endScrub
			}}
		>
			<div class="progress-track"></div>
			<div class="progress-fill" style:width="{progressPercent}%"></div>
			<div class="progress-thumb" style:left="calc({progressPercent}% - 6px)"></div>
		</div>
		<div class="times">
			<span>{formatTime(progressFraction * duration)}</span>
			<span>{formatTime(duration)}</span>
		</div>
		{#if showVolume && card.entity}
			{@const entity = card.entity}
			<div class="volume">
				<Icon name="volume_up" size={ICON.inline} />
				<div
					class="volume-bar"
					role="slider"
					tabindex="0"
					aria-label={$lang('hearth_volume')}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={volume}
					onkeydown={(event) => {
						if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
							setMediaVolume(entity, volume + 5);
						else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
							setMediaVolume(entity, volume - 5);
					}}
					use:horizontalDrag={{
						set: (value, commit) => setMediaVolume(entity, value, commit)
					}}
				>
					<div class="volume-track"></div>
					<div class="volume-fill" style:width="{volume}%"></div>
					<div class="volume-thumb" style:left="calc({volume}% - 5px)"></div>
				</div>
				<span class="volume-value">{volume}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.card {
		height: 100%;
		min-height: 240px;
		border-radius: var(--h-radius-card);
		overflow: hidden;
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.07 * var(--h-line-scale)));
		position: relative;
		flex: 1;
	}

	.art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.art.placeholder {
		background: repeating-linear-gradient(
			135deg,
			var(--h-media-art-1),
			var(--h-media-art-1) 10px,
			var(--h-media-art-2) 10px,
			var(--h-media-art-2) 20px
		);
		opacity: 0.9;
	}

	.scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 35%, var(--h-art-scrim-3));
	}

	.tune-wrap {
		position: absolute;
		top: 14px;
		right: 16px;
		color: var(--h-on-art-1);
	}

	.controls {
		position: absolute;
		left: 20px;
		right: 20px;
		bottom: 18px;
	}

	.shortcut-row {
		margin-bottom: 12px;
	}

	.track-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.track {
		flex: 1;
		min-width: 0;
	}

	.kicker {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-caption);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-accent-dim-text);
		margin-bottom: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-on-art-1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.artist {
		font-size: var(--h-type-secondary);
		color: var(--h-on-art-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* transport is the card's one guaranteed control: a real 52px target */
	.play {
		width: 52px;
		height: 52px;
		flex: none;
		border: 0;
		padding: 0;
		font: inherit;
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb));
		color: var(--h-bg-1);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	/* secondary transport: smaller and quieter than play, still a 40px target */
	.skip {
		width: 40px;
		height: 40px;
		flex: none;
		border: 0;
		padding: 0;
		font: inherit;
		border-radius: var(--h-radius-pill);
		background: transparent;
		color: var(--h-on-art-1);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.volume {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 10px;
		color: var(--h-on-art-2);
	}

	.volume-bar {
		position: relative;
		flex: 1;
		height: 18px;
		display: flex;
		align-items: center;
		cursor: pointer;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.volume-track {
		position: absolute;
		left: 0;
		right: 0;
		height: 4px;
		border-radius: var(--h-radius-hair);
		background: var(--h-on-art-line);
	}

	.volume-fill {
		position: absolute;
		left: 0;
		height: 4px;
		border-radius: var(--h-radius-hair);
		background: rgb(var(--h-accent-rgb) / calc(0.75 * var(--h-accent-scale)));
	}

	.volume-thumb {
		position: absolute;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--h-on-art-1);
	}

	.volume-value {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-caption);
		color: var(--h-on-art-1);
		width: 22px;
		text-align: right;
	}

	.progress {
		position: relative;
		height: 18px;
		display: flex;
		align-items: center;
		margin-top: 12px;
		cursor: pointer;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.progress-track {
		position: absolute;
		left: 0;
		right: 0;
		height: 4px;
		border-radius: var(--h-radius-hair);
		background: var(--h-on-art-line);
	}

	.progress-fill {
		position: absolute;
		left: 0;
		height: 4px;
		border-radius: var(--h-radius-hair);
		background: var(--h-accent-deep);
	}

	.progress-thumb {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: rgb(var(--h-surface-rgb));
	}

	.times {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: var(--h-type-label);
		color: var(--h-on-art-1);
		font-family: var(--h-font-mono);
	}

	/* an 18px bar is a hard target for a finger; the hit area grows, the bar does not */
	@media (pointer: coarse) {
		.volume-bar::before,
		.progress::before {
			content: '';
			position: absolute;
			inset: -13px 0; /* literal ok: 18px bar plus 13px each side is a 44px target */
		}
	}
</style>
