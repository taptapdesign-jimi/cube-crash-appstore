import { markUserMoveAfterLoad } from '../modules/app-core-load-finalize.ts';

describe('markUserMoveAfterLoad', () => {
  it('sets _userMadeMove on window', () => {
    (global as any)._userMadeMove = false;
    markUserMoveAfterLoad({ devLog: () => {} });
    expect((global as any)._userMadeMove).toBe(true);
  });
});
