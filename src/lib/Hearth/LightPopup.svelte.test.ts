import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { controlOverrides } from '$lib/core/ha/commands';
import { lightHsFor } from '$lib/core/domains/light';
import LightPopup from './LightPopup.svelte';

vi.mock('$lib/core/domains/light', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/light')>()),
	setLightHs: vi.fn()
}));
import { setLightHs } from '$lib/core/domains/light';

function light(attributes: Record<string, unknown>) {
	states.set({
		'light.desk': hassEntity('light.desk', 'on', {
			friendly_name: 'Desk',
			brightness: 128,
			supported_color_modes: ['color_temp', 'hs'],
			...attributes
		})
	});
}

describe('light popup colours', () => {
	beforeEach(() => {
		vi.mocked(setLightHs).mockClear();
		controlOverrides.set({});
	});

	it('offers a colour wheel and true colours that send hue and saturation', async () => {
		light({ color_mode: 'hs', hs_color: [0, 100], rgb_color: [255, 0, 0] });
		render(LightPopup, { entity: 'light.desk' });
		expect(screen.getByRole('slider', { name: en.hearth_color_wheel })).not.toBeNull();
		const red = screen.getByRole('button', { name: en.hearth_color_red });
		expect(red.getAttribute('aria-pressed')).toBe('true');
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_color_blue }));
		expect(setLightHs).toHaveBeenCalledWith('light.desk', 230, 100, true);
	});

	it('steps the hue from the keyboard', async () => {
		light({ color_mode: 'hs', hs_color: [355, 80], rgb_color: [255, 60, 70] });
		render(LightPopup, { entity: 'light.desk' });
		const wheel = screen.getByRole('slider', { name: en.hearth_color_wheel });
		await fireEvent.keyDown(wheel, { key: 'ArrowRight' });
		expect(setLightHs).toHaveBeenCalledWith('light.desk', 5, 80, true);
	});
});

describe('lightHsFor', () => {
	it('reads the colour of a light in a colour mode, nothing in white or temperature', () => {
		const entity = (attributes: Record<string, unknown>) => ({
			'light.desk': hassEntity('light.desk', 'on', attributes)
		});
		expect(lightHsFor('light.desk', entity({ color_mode: 'hs', hs_color: [39, 50] }), {})).toEqual([
			39, 50
		]);
		expect(
			lightHsFor('light.desk', entity({ color_mode: 'color_temp', hs_color: [27, 16] }), {})
		).toBeUndefined();
		// a drag in flight wins over the reported colour
		expect(
			lightHsFor('light.desk', entity({ color_mode: 'hs', hs_color: [39, 50] }), {
				'hue:light.desk': 200,
				'sat:light.desk': 90
			})
		).toEqual([200, 90]);
	});
});
