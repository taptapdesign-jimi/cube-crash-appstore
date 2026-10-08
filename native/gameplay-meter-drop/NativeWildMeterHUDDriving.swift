import Foundation
@MainActor protocol NativeWildMeterHUDDriving:NativeWildMeterConsumptionDriver {
    func start(duration:Double,family:NativeSourceAnimationRuntime.RootFamily,paint:@escaping(Double)->Void,completed:@escaping()->Void,interrupted:@escaping()->Void)->(()->Void)?
}
