import Foundation

/// Journey presentation depends on the accepted action's source owner. A saved
/// run or an already-earned card still enters through the World's authored
/// Board Transition; retry/replay inside gameplay starts directly after exit.
enum NativeJourneyTransitionAdmission {
    enum Entry:String,CaseIterable {
        case worldCard,continueNextBoard,failureRetry,endRunRestart,cleanBoardPlayAgain
    }
    static func requiresTransition(entry:Entry,tutorial:Bool)->Bool {
        guard !tutorial else{return false}
        switch entry {
        case .worldCard,.continueNextBoard:return true
        case .failureRetry,.endRunRestart,.cleanBoardPlayAgain:return false
        }
    }
}
