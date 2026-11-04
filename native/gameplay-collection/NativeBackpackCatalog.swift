import Foundation
import StackToSixGameplay
import StackToSixNativeState

/// Read-only projection of the real Journey reward pools and durable progression.
struct NativeBackpackCatalog {
    struct Die:Equatable {
        let id:String,title:String,copy:String,board:Int
        var artwork:NativeDiceArtwork {
            if id=="barell" {return NativeDiceArtwork(path:"assets/shop/barell/barell.png")}
            let source=NativeDiceArtwork.definition(kind:id,variant:NativeSpecialDiceRegistry.variants[id] == nil ? nil:id)
            if id=="kanta" {return NativeDiceArtwork(path:"assets/shop/kanta/kanta.png",size:source.size,anchor:source.anchor,idleSheet:source.idleSheet)}
            return source
        }
    }
    struct Section {
        let title:String,dice:[Die],unlocked:Set<String>
        var unread:Set<String> = []
        var count:Int {dice.filter{unlocked.contains($0.id)}.count}
    }
    static let arcade:[Die] = [
        Die(id:"cubero",title:"CUBERO",copy:"Adds 2–4 regular dice and\n4–6 closed dice to the board.",board:0),
        Die(id:"baloon",title:"BALLOON",copy:"Floats away and adds\n1 regular die to the board.",board:0),
        Die(id:"tnt",title:"TNT",copy:"Blasts up to 4 regular dice.\nAdds 1 regular die to the board.",board:0),
        Die(id:"wild-magnet",title:"MAGNET",copy:"Pulls and refills up to 4 dice.\nAdds 1 regular die to the board.",board:0)]
    static let forest:[Die] = [
        Die(id:"bee",title:"Wee Bee",copy:"Adds 2 regular dice and\n4 closed dice to the board.",board:1),
        Die(id:"wild-star",title:"STAR",copy:"Drops 2–4 regular dice and\n4–6 closed dice onto the board.",board:2),
        Die(id:"flower",title:"Flower",copy:"Changes up to 4 dice.\nAdds 1 regular die and\n9 closed dice to the board.",board:3),
        Die(id:"honey",title:"HONEY",copy:"Scoops and refills up to 4 dice.\nAdds 1 regular die and\n9 closed dice to the board.",board:4),
        Die(id:"mushroom",title:"SHROOMY",copy:"Adds 5–7 regular dice and\n7–9 closed dice to the board.",board:6),
        Die(id:"barell",title:"BARREL",copy:"Blasts all regular dice.\nAdds 1 regular die and\n9 closed dice to the board.",board:7)]
    static let area:[Die] = [
        Die(id:"robo-cube",title:"BIBI RIBI",copy:"Adds 1 regular die and\n3 closed dice to the board.",board:21),
        Die(id:"kanta",title:"BLOOB BUCKET",copy:"Adds 2–4 regular dice and\n4–6 closed dice to the board.",board:22),
        Die(id:"spaceship",title:"SPACESHIP",copy:"Beams and refills up to 4 dice.\nAdds 1 regular die and\n9 closed dice to the board.",board:23),
        Die(id:"laser-gun",title:"LASER GUN",copy:"Shoots up to 4 regular dice.\nAdds 1 regular die and\n9 closed dice to the board.",board:24),
        Die(id:"bloob-ball",title:"BLOOB POD",copy:"Changes all regular dice.\nAdds 1 regular die and\n9 closed dice to the board.",board:26),
        Die(id:"bloob",title:"BLOOB",copy:"Adds 5–7 regular dice and\n7–9 closed dice to the board.",board:27)]
    static let beach:[Die] = [
        Die(id:"wild-juice",title:"JUICE",copy:"Adds 1 regular die and\n3 closed dice to the board.",board:11),
        Die(id:"fish",title:"FISHY",copy:"Adds 2–4 regular dice and\n4–6 closed dice to the board.",board:12),
        Die(id:"beach-ball",title:"BEACH BALL",copy:"Bounces into up to 4 dice.\nAdds 1 regular die and\n9 closed dice to the board.",board:13),
        Die(id:"bottle",title:"BOTTLE",copy:"Washes and replaces 1–4 dice.\nAdds 1 regular die and\n9 closed dice to the board.",board:14),
        Die(id:"coconut",title:"COCONUT",copy:"Changes all regular dice values.\nAdds 1 regular die and\n9 closed dice to the board.",board:16),
        Die(id:"kite",title:"KITE",copy:"Adds 2 regular dice and\n4 closed dice to the board.",board:18)]
    static func sections(_ progression:NativeProgressionState,prioritizingWorld:Int?=nil)->[Section] {
        let canonical=[(1,"Forest",forest),(3,"Area 55",area),(2,"Beach",beach)]
        // Move the origin World to the front, keeping every other World in its
        // existing order. A Hub visit has no origin and restores canonical order.
        let ordered=canonical.filter{$0.0==prioritizingWorld}+canonical.filter{$0.0 != prioritizingWorld}
        return ordered.map {_,title,dice in
            // Reward eligibility and card progression do not prove a die landed.
            // Both the gameplay modal and collection screen use this durable receipt.
            let discovered=progression.announcedJourneyDice.intersection(Set(dice.map(\.id)))
            return Section(title:title,dice:dice,unlocked:discovered,unread:progression.unreadJourneyDice.intersection(discovered))
        }
    }
}
