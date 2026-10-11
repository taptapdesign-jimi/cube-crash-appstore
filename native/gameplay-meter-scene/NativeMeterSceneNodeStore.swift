import Foundation

/// Actual Scene cell/object registry. It never admits arbitrary alpha-zero
/// nodes or chooses a Core tile. Epoch is acquired BEFORE hidden setValue.
@MainActor final class NativeMeterSceneNodeStore<Node:AnyObject> {
    typealias Hidden=NativeMeterHiddenOpenOwner<Node>
    struct Cell:Hashable {let column:Int,row:Int}
    private struct Record {let node:Node,id:String,generation:UInt64,epoch:UInt64}
    private var records:[Cell:Record]=[:],sequence:UInt64=0,closed=false
    private let current:()->Bool,actualContains:(String,Node)->Bool,holder:(Node)->NativeMeterHiddenHolder,retireNode:(String,Node)->Void
    init(current:@escaping()->Bool,actualContains:@escaping(String,Node)->Bool,
         holder:@escaping(Node)->NativeMeterHiddenHolder,retireNode:@escaping(String,Node)->Void){
        self.current=current;self.actualContains=actualContains;self.holder=holder;self.retireNode=retireNode
    }
    func bind(node:Node,id:String,cell:Cell,generation:UInt64){
        guard valid() else{return}
        if let old=records[cell],old.node === node,old.id==id,old.generation==generation{return}
        sequence &+= 1;records[cell]=Record(node:node,id:id,generation:generation,epoch:sequence)
    }
    func remove(node:Node){
        for cell in Array(records.keys) where records[cell]?.node === node{records.removeValue(forKey:cell)}
    }
    func containsBoundNode(_ node:Node,id:String,cell:Cell,generation:UInt64)->Bool {
        guard valid(),let record=records[cell],record.node === node,
              record.id==id,record.generation==generation else{return false}
        let accepted=actualContains(id,node)
        return accepted && valid() && records[cell]?.epoch==record.epoch && records[cell]?.node === node
    }
    func read(_ capture:Hidden.Capture)->Hidden.Lease? {
        guard valid() else{return nil}
        let cell=Cell(column:capture.column,row:capture.row)
        guard let record=records[cell],record.generation==capture.generation,actualContains(record.id,record.node),valid() else{return nil}
        let epoch=record.epoch
        return Hidden.Lease(node:record.node,id:record.id,isOwned:{[weak self,weak node=record.node] in
            guard let self,let node,self.valid(),let current=self.records[cell],current.epoch==epoch,current.node === node else{return false}
            let result=self.actualContains(current.id,node)
            return result && self.valid() && self.records[cell]?.epoch==epoch
        },holder:{[holder,node=record.node] in holder(node)},retire:{[weak self,weak node=record.node] in
            guard let self,let node,let current=self.records[cell],current.epoch==epoch,current.node === node else{return}
            self.records.removeValue(forKey:cell)
            self.retireNode(current.id,node)
        })
    }
    private func valid()->Bool{guard !closed else{return false};let value=current();return value && !closed}
    func clearGeneration(_ generation:UInt64){for cell in Array(records.keys) where records[cell]?.generation==generation {records.removeValue(forKey:cell)}}
    func dispose(){guard !closed else{return};closed=true;records.removeAll()}
 // Swift6.3.3 EarlyPerfInliner generic ARC destroyer defect. Only this
 // implicit lifetime cleanup is unoptimized; all gameplay/motion stays -O.
 @_optimize(none) deinit {}

}
