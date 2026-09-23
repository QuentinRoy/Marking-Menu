import { createMarkingMenu } from './create-marking-menu.js';
import { createController } from './engine/controller.js';

vi.mock('./engine/controller.js');

describe('createMarkingMenu', () => {
  it('forwards the config unchanged to the engine controller', () => {
    const controller = { dispose: vi.fn(), off: vi.fn(), on: vi.fn() };
    vi.mocked(createController).mockReturnValue(controller);
    const parent = document.createElement('div');
    const items = [{ id: 'right', label: 'Right' }] as const;
    const config = { items, parent };

    const result = createMarkingMenu(config);

    expect(vi.mocked(createController)).toHaveBeenCalledExactlyOnceWith(config);
    expect(result).toBe(controller);
  });
});
