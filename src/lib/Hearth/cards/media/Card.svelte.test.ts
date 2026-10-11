import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { MediaCard } from './descriptor';
import Card from './Card.svelte';

vi.mock('$lib/core/domains/mediaPlayer', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/mediaPlayer')>()),
	skipMediaTrack: vi.fn(),
	setMediaVolume: vi.fn()
}));
import { setMediaVolume, skipMediaTrack } from '$lib/core/domains/mediaPlayer';

// volume_set (4), previous_track (16) and next_track (32), as a Sonos reports
const ALL = 4 | 16 | 32;

function player(features: number, state = 'playing') {
	states.set({
		'media_player.living': hassEntity('media_player.living', state, {
			friendly_name: 'Living',
			media_title: 'Song',
			supported_features: features,
			volume_level: 0.3
		})
	});
}

function renderCard(options: Partial<MediaCard> = {}) {
	return render(Card, {
		card: { id: 'm', type: 'media', entity: 'media_player.living', ...options }
	});
}

const button = (name: string) => screen.queryByRole('button', { name });
const slider = () => screen.queryByRole('slider', { name: en.hearth_volume });

describe('media card extra controls', () => {
	beforeEach(() => {
		vi.mocked(skipMediaTrack).mockClear();
		vi.mocked(setMediaVolume).mockClear();
	});

	it('shows only play unless the options are turned on', () => {
		player(ALL);
		renderCard();
		expect(button('Pause')).not.toBeNull();
		expect(button(en.hearth_previous_track)).toBeNull();
		expect(button(en.hearth_next_track)).toBeNull();
		expect(slider()).toBeNull();
	});

	it('skips tracks from the card when turned on', async () => {
		player(ALL);
		renderCard({ show_track_buttons: true });
		await fireEvent.click(button(en.hearth_next_track)!);
		expect(skipMediaTrack).toHaveBeenCalledWith('media_player.living', 'next');
		await fireEvent.click(button(en.hearth_previous_track)!);
		expect(skipMediaTrack).toHaveBeenCalledWith('media_player.living', 'previous');
	});

	it('leaves out what the player does not support', () => {
		player(32);
		renderCard({ show_track_buttons: true, show_volume: true });
		expect(button(en.hearth_next_track)).not.toBeNull();
		expect(button(en.hearth_previous_track)).toBeNull();
		expect(slider()).toBeNull();
	});

	it('shows the volume and changes it from the keyboard', async () => {
		player(ALL, 'paused');
		renderCard({ show_volume: true });
		expect(slider()?.getAttribute('aria-valuenow')).toBe('30');
		await fireEvent.keyDown(slider()!, { key: 'ArrowRight' });
		expect(setMediaVolume).toHaveBeenCalledWith('media_player.living', 35);
	});
});
