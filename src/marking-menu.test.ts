import { createController } from './engine/controller.js';
import { createMarkingMenu } from './marking-menu.js';

vi.mock('./engine/controller.js');

describe('createMarkingMenu', () => {
  it('forwards the config unchanged to the engine controller', () => {
    const controller = { dispose: vi.fn(), off: vi.fn(), on: vi.fn() };
    vi.mocked(createController).mockReturnValue(
      controller as unknown as ReturnType<typeof createController>,
    );
    const parent = document.createElement('div');
    const items = [{ id: 'right', label: 'Right' }] as const;
    const config = { items, parent, strokeColor: '#123456' };

    const result = createMarkingMenu(config);

    expect(vi.mocked(createController)).toHaveBeenCalledExactlyOnceWith(config);
    expect(result).toBe(controller);
  });
});
