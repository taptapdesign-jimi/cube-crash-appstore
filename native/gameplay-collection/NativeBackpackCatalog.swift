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
        Die(id:"tnt",title:"TNT",copy:"Boom-boom, merge me! I blast max 4 dice and rebuild each with a new number!",board:0),
        Die(id:"wild-magnet",title:"MAGNET",copy:"Swoop-swoop! Merge me to pull in max 4 dice and swap each for another!",board:0),
        Die(id:"cubero",title:"CUBERO",copy:"Hop-hop, merge me! I’ll bounce 1–3 bonus dice into play!",board:0)]
    static let forest:[Die] = [
        Die(id:"bee",title:"Wee Bee",copy:"Bzz-bzz, merge me and I’ll drop 2 new dice onto your board!",board:1),
        Die(id:"wild-star",title:"STAR",copy:"Twinkle-twinkle! Merge me to sprinkle 1–3 bonus dice onto your board!",board:2),
        Die(id:"flower",title:"Flower",copy:"Bloom-boom! Merge me and my petals give max 4 dice a different number!",board:3),
        Die(id:"honey",title:"HONEY",copy:"Sticky-sticky, merge me! I scoop up max 4 dice and trade each for a fresh one!",board:4),
        Die(id:"mushroom",title:"SHROOMY",copy:"Pop-pop! Merge me and watch a fresh number die sprout onto your board!",board:6),
        Die(id:"barell",title:"BARREL",copy:"Kaboom! Merge me to smash max 4 dice and replace the whole batch!",board:7)]
    static let area:[Die] = [
        Die(id:"robo-cube",title:"BIBI RIBI",copy:"Beep-boop! Merge me and I’ll build a fresh number die for your board!",board:21),
        Die(id:"kanta",title:"BLOOB",copy:"Clank-clank, merge me! There are 1–3 bonus dice ready to tumble out!",board:22),
        Die(id:"spaceship",title:"SPACESHIP",copy:"Beam me up! Merge me to abduct max 4 dice and beam replacements down!",board:23),
        Die(id:"laser-gun",title:"LASER GUN",copy:"Zap-zap! Merge me to shoot max 4 dice and change every number I hit!",board:24)]
    static let beach:[Die] = [
        Die(id:"wild-juice",title:"JUICE",copy:"Slurp-slurp, merge me! I’ll pour a fresh number die into play!",board:11),
        Die(id:"fish",title:"FISHY",copy:"Splash-splash! Merge me and I’ll reel in 1–3 bonus dice for your board!",board:12),
        Die(id:"beach-ball",title:"BEACH BALL",copy:"Boing-boing! Merge me to bounce through max 4 dice and reroll each one!",board:13),
        Die(id:"bottle",title:"BOTTLE",copy:"Glug-glug, merge me! I wash away max 4 dice, then send back just as many!",board:14)]
    static func sections(_ progression:NativeProgressionState)->[Section] {
        [("Forest",forest),("Area 55",area),("Beach",beach)].map {title,dice in
            // Reward eligibility and card progression do not prove a die landed.
            // Both the gameplay modal and collection screen use this durable receipt.
            let discovered=progression.announcedJourneyDice.intersection(Set(dice.map(\.id)))
            return Section(title:title,dice:dice,unlocked:discovered,unread:progression.unreadJourneyDice.intersection(discovered))
        }
    }
}
