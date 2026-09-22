import { WatchBridgeService } from './watch-bridge.service';
import { WatchProtocolService } from './watch-protocol.service';

describe('WatchBridgeService', () => {
  it('keeps the web fallback disconnected without initializing a native transport', () => {
    const protocol = { state$: { subscribe: () => undefined } } as unknown as WatchProtocolService;
    const bridge = new WatchBridgeService(protocol);

    bridge.initialize();

    let connection: unknown;
    bridge.connection$.subscribe((state) => connection = state).unsubscribe();
    expect(connection).toEqual({ available: false, paired: false, reachable: false });
  });
});
