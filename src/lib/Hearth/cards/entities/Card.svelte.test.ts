import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import Card from './Card.svelte';

vi.mock('$lib/core/domains/cover', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/cover')>()),
	setAllCovers: vi.fn()
}));
import { setAllCovers } from '$lib/core/domains/cover';
import { confirmRequestedAction, dismissConfirmation, requestedConfirmation } from '../../store';

describe('entities card group actions', () => {
	beforeEach(() => {
		vi.mocked(setAllCovers).mockClear();
		dismissConfirmation();
	});

	it('asks before Open all moves a garage door along with the blinds', async () => {
		states.set({
			'cover.blind': hassEntity('cover.blind', 'closed', { friendly_name: 'Blind' }),
			'cover.garage': hassEntity('cover.garage', 'closed', {
				device_class: 'garage',
				friendly_name: 'Garage'
			})
		});
		render(Card, {
			card: {
				id: 'e',
				type: 'entities',
				title: 'Outside',
				entities: [{ entity: 'cover.blind' }, { entity: 'cover.garage' }]
			}
		});
		await fireEvent.click(screen.getByText('Open all'));
		expect(setAllCovers).not.toHaveBeenCalled();
		expect(get(requestedConfirmation)?.title).toBe('Open Garage?');
		confirmRequestedAction();
		expect(setAllCovers).toHaveBeenCalledWith(['cover.blind', 'cover.garage'], true);
	});
});

describe('entities card All on', () => {
	it('offers All on beside All off only when turned on, and switches everything on', async () => {
		const spy = vi.spyOn(await import('$lib/core/ha/commands'), 'service');
		states.set({
			'light.desk': hassEntity('light.desk', 'off', { friendly_name: 'Desk' }),
			'light.lamp': hassEntity('light.lamp', 'off', { friendly_name: 'Lamp' })
		});
		const card = {
			id: 'l',
			type: 'entities' as const,
			title: 'Lights',
			entities: [{ entity: 'light.desk' }, { entity: 'light.lamp' }]
		};
		const { unmount } = render(Card, { card });
		expect(screen.queryByText('All on')).toBeNull();
		expect(screen.queryByText('All off')).not.toBeNull();
		unmount();

		render(Card, { card: { ...card, group_on: true } });
		await fireEvent.click(screen.getByText('All on'));
		expect(spy).toHaveBeenCalledWith('homeassistant', 'turn_on', {
			entity_id: ['light.desk', 'light.lamp']
		});
		spy.mockRestore();
	});
});
