import Foundation
import StackToSixGameplay
import StackToSixNativeState

/// Read-only projection of the real Journey reward pools and durable progression.
struct NativeBackpackCatalog {
    struct Die:Equatable {
        let id:String,title:String,copy:String,board:Int
        var artwork:NativeDiceArtwork {
            if id=="barell" {return NativeDiceArtwork(path:"assets/shop/barell/barell.png")}
            return NativeDiceArtwork.definition(kind:id,variant:NativeSpecialDiceRegistry.variants[id] == nil ? nil:id)
        }
    }
    struct Section {
        let title:String,dice:[Die],unlocked:Set<String>
        var unread:Set<String> = []
        var count:Int {dice.filter{unlocked.contains($0.id)}.count}
    }
    static let arcade:[Die] = [
        Die(id:"cubero",title:"CUBERO",copy:"Merge me to add 1–3 bonus dice, plus the main merge die. Closed dice appear for later moves.",board:0),
        Die(id:"baloon",title:"BALLOON",copy:"Merge me to release a fresh number die. I float away as the new die lands.",board:0),
        Die(id:"tnt",title:"TNT",copy:"Merge me to blast up to 4 ordinary dice. Each hit replaces a die with a different number.",board:0),
        Die(id:"wild-magnet",title:"MAGNET",copy:"Merge me to pull in up to 4 dice, then send the same number of replacements back to the board.",board:0)]
    static let forest:[Die] = [
        Die(id:"bee",title:"Wee Bee",copy:"Merge me to create the main merge die and 1 bonus die. That makes 2 fresh dice!",board:1),
        Die(id:"wild-star",title:"STAR",copy:"Merge me to add 1–3 bonus dice, plus the main merge die. Closed dice appear for later moves.",board:2),
        Die(id:"flower",title:"Flower",copy:"Merge me to scatter petals over up to 4 ordinary dice. Each one gets a different number.",board:3),
        Die(id:"honey",title:"HONEY",copy:"Merge me to scoop up to 4 dice, then return the same number of fresh dice to the board.",board:4),
        Die(id:"mushroom",title:"SHROOMY",copy:"Sprouts 4–6 bonus dice, plus the main die, and adds 7–9 closed dice when space allows. A rare find!",board:6),
        Die(id:"barell",title:"BARREL",copy:"Merge me to explode across the whole board! Every ordinary die is replaced with a different number.",board:7)]
    static let area:[Die] = [
        Die(id:"robo-cube",title:"BIBI RIBI",copy:"Merge me to build a fresh number die. The new die lands where the merge happened.",board:21),
        Die(id:"kanta",title:"BLOB BARREL",copy:"Merge me to release 1–3 bonus dice, plus the main merge die. Closed dice appear for later moves.",board:22),
        Die(id:"spaceship",title:"SPACESHIP",copy:"Merge me to beam up to 4 dice aboard, then beam the same number of replacements back down.",board:23),
        Die(id:"laser-gun",title:"LASER GUN",copy:"Merge me to shoot up to 4 ordinary dice. Each target stays in place and gets a different number.",board:24),
        Die(id:"bloob-ball",title:"BLOB POD",copy:"Gassy fumes sweep the board, changing every ordinary die to a different number!",board:27)]
    static let beach:[Die] = [
        Die(id:"wild-juice",title:"JUICE",copy:"Merge me to pour a fresh number die onto the board. It appears where the merge happened.",board:11),
        Die(id:"fish",title:"FISHY",copy:"Merge me to bring in 1–3 bonus dice, plus the main merge die. Closed dice appear for later moves.",board:12),
        Die(id:"beach-ball",title:"BEACH BALL",copy:"Merge me to bounce into up to 4 ordinary dice. Every hit gives that die a different number.",board:13),
        Die(id:"bottle",title:"BOTTLE",copy:"Merge me to wash away up to 4 dice, then bring back the same number of fresh dice.",board:14)]
    static func sections(_ progression:NativeProgressionState)->[Section] {
        [("Forest",forest),("Area 55",area),("Beach",beach)].map {title,dice in
            // Reward eligibility and card progression do not prove a die landed.
            // Both the gameplay modal and collection screen use this durable receipt.
            let discovered=progression.announcedJourneyDice.intersection(Set(dice.map(\.id)))
            return Section(title:title,dice:dice,unlocked:discovered,unread:progression.unreadJourneyDice.intersection(discovered))
        }
    }
}
