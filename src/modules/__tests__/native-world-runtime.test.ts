import { NativeWorldReceiptOwner } from '../native-world-runtime';
const action = (owner: NativeWorldReceiptOwner, id = 1) => ({
  id,
  worldID: 1,
  action: 'play',
  boardID: 1,
  ...owner.identity(),
});
test('native rendering readiness does not admit input before commit', () => {
  const owner = new NativeWorldReceiptOwner();
  owner.prepare();
  owner.reconcile([{ boardID: 1 }]);
  expect(owner.admit(action(owner), true)).toBeNull();
  expect(owner.activate()).toBe(true);
  expect(owner.admit(action(owner, 2), true)).toBeNull();
  expect(
    owner.commit(
      owner.identity().routeGeneration,
      owner.identity().stateRevision,
    ),
  ).toBe(true);
  expect(owner.admit(action(owner, 3), true)).not.toBeNull();
});
test('launch admission is one-use, parks only on actual native completion and retains identity for return', () => {
  const owner = new NativeWorldReceiptOwner();
  owner.prepare();
  owner.reconcile([1]);
  owner.activate();
  owner.commit(
    owner.identity().routeGeneration,
    owner.identity().stateRevision,
  );
  const request = owner.admit(action(owner), true)!;
  const token = owner.prepareLaunch(request);
  expect(owner.current(request.routeGeneration, request.stateRevision)).toBe(
    true,
  );
  expect(owner.consumeLaunch('foreign')).toBeNull();
  expect(owner.consumeLaunch(token)).toEqual({ boardID: 1, action: 'play' });
  expect(owner.consumeLaunch(token)).toBeNull();
  expect(owner.admit(action(owner, 2), true)).toBeNull();
  expect(owner.returnReady()).toBe(true);
  expect(owner.returnReady()).toBe(false);
  owner.commit(
    owner.identity().routeGeneration,
    owner.identity().stateRevision,
  );
  expect(owner.current(request.routeGeneration, request.stateRevision)).toBe(
    true,
  );
});
test('changed canonical state, background, replay and retired generation reject requests', () => {
  const owner = new NativeWorldReceiptOwner();
  owner.prepare();
  owner.reconcile([1]);
  owner.activate();
  owner.commit(
    owner.identity().routeGeneration,
    owner.identity().stateRevision,
  );
  const first = action(owner);
  const request = owner.admit(first, true)!;
  const token = owner.prepareLaunch(request);
  owner.reconcile([2]);
  expect(owner.consumeLaunch(token)).toBeNull();
  expect(owner.admit({ ...first, id: 2 }, true)).toBeNull();
  expect(owner.admit(action(owner, 3), false)).toBeNull();
  expect(owner.admit(action(owner, 3), true)).toBeNull();
  owner.retire();
  owner.retire();
  owner.prepare();
  owner.activate();
  owner.commit(
    owner.identity().routeGeneration,
    owner.identity().stateRevision,
  );
  expect(owner.admit({ ...first, id: 4 }, true)).toBeNull();
});


test.each([2,3] as const)('selected World %i rejects foreign board/world receipts and invalidates replaced generations',worldID=>{
  const owner=new NativeWorldReceiptOwner();owner.prepare(worldID);owner.reconcile([worldID]);owner.activate();
  const old=owner.identity();expect(owner.commit(old.routeGeneration,old.stateRevision)).toBe(true);
  const first=(worldID-1)*10+1;
  const request=(id:number,world=worldID,boardID=first)=>({id,worldID:world,boardID,action:'play',...owner.identity()});
  expect(owner.admit(request(1,worldID,1),true)).toBeNull();
  expect(owner.admit({...request(2),worldID:1},true)).toBeNull();
  expect(owner.admit(request(3),true)?.boardID).toBe(first);
  expect(owner.admit(request(4,worldID,worldID*10),true)?.boardID).toBe(worldID*10);
  expect(owner.admit(request(5,worldID,worldID*10+1),true)).toBeNull();
  const admitted=owner.admit(request(6),true)!;const token=owner.prepareLaunch(admitted);expect(owner.consumeLaunch(token)?.boardID).toBe(first);
  owner.reconcile([worldID,'changed-progress']);expect(owner.returnReady()).toBe(true);const returned=owner.identity();expect(owner.commit(returned.routeGeneration,returned.stateRevision)).toBe(true);
  owner.retire();owner.prepare(1);owner.reconcile([1]);owner.activate();const next=owner.identity();owner.commit(next.routeGeneration,next.stateRevision);
  expect(owner.admit({...request(7),...old},true)).toBeNull();
});
