import Foundation
@MainActor extension NativeSourceMagnetPullOwner {
 convenience init(service:NativeSourceAnimationClockService,hooks:Hooks){
  self.init(register:{participant,duration,delay,cleanup in
   guard let lease=service.register(participant:participant,duration:duration,domain:.sourceGSAP(.timeline),delay:delay,cleanup:cleanup) else{return nil}
   return Root{success in lease.cancel(success:success)}
  },hooks:hooks)
 }
}
