import UIKit

/// Reusable cells load only when they intersect the scroll viewport.
/// The existing visible presentation lease also owns unlocked artwork idle.
@MainActor
final class NativeBackpackView:UIView,UICollectionViewDataSource,UICollectionViewDelegateFlowLayout {
    private let assets:JimiV9Artwork
    let header=JimiV9NavigationHeader(frame:.zero),close=JimiV9PlainButton(type:.custom)
    let grid:UICollectionView
    private let title=UILabel()
    private(set) var includesArcade=false
    let arcadeCrate:Bool
    private var alertsActive=false
    private(set) var seenUnreadDice=Set<String>()
    func setAlertsActive(_ active:Bool){alertsActive=active;refreshVisibleAlerts()}
    func markRead(_ id:String){for i in sections.indices {sections[i].unread.remove(id)};refreshVisibleAlerts()}
    private func refreshVisibleAlerts(){
        for path in grid.indexPathsForVisibleItems {
            guard let cell=grid.cellForItem(at:path) as? NativeBackpackCell else{continue}
            let section=path.section-(includesArcade ? 1:0)
            let unread=section>=0 && sections.indices.contains(section) && sections[section].unread.contains(sections[section].dice[path.item].id)
            cell.setAlert(unread:unread,active:alertsActive && !isHidden)
        }
        recordSeenUnread()
    }
    /// Admit actual visible cards only, excluding the pinned header and mere edge slivers.
    private func recordSeenUnread(){
        for path in grid.indexPathsForVisibleItems {
            if let cell=grid.cellForItem(at:path){recordSeenUnread(at:path,cell:cell)}
        }
    }
    private func recordSeenUnread(at path:IndexPath,cell:UICollectionViewCell){
        guard alertsActive,!isHidden,window != nil,alpha>0.01 else{return}
        let section=path.section-(includesArcade ? 1:0)
        guard sections.indices.contains(section),sections[section].dice.indices.contains(path.item) else{return}
        let die=sections[section].dice[path.item]
        guard sections[section].unlocked.contains(die.id),sections[section].unread.contains(die.id) else{return}
        var viewport=convert(grid.bounds,from:grid).intersection(bounds)
        if !header.isHidden {viewport=viewport.intersection(CGRect(x:0,y:header.frame.maxY,width:bounds.width,height:max(0,bounds.height-header.frame.maxY)))}
        let card=convert(cell.frame,from:grid),intersection=card.intersection(viewport)
        if !intersection.isNull,card.width>0,card.height>0,
           intersection.width*intersection.height >= card.width*card.height*0.5 {seenUnreadDice.insert(die.id)}
    }
    func scrollViewDidScroll(_ scrollView:UIScrollView){recordSeenUnread()}
    override var isHidden:Bool {didSet{refreshVisibleAlerts()}}
    func collectionView(_ collectionView:UICollectionView,willDisplay cell:UICollectionViewCell,forItemAt indexPath:IndexPath){
        let section=indexPath.section-(includesArcade ? 1:0)
        let unread=section>=0 && sections.indices.contains(section) && sections[section].unread.contains(sections[section].dice[indexPath.item].id)
        (cell as? NativeBackpackCell)?.setAlert(unread:unread,active:alertsActive && !isHidden)
        recordSeenUnread(at:indexPath,cell:cell)
    }
    func collectionView(_ collectionView:UICollectionView,didEndDisplaying cell:UICollectionViewCell,forItemAt indexPath:IndexPath){(cell as? NativeBackpackCell)?.setAlert(unread:false,active:false)}
    private var embedded=false
    // Corner alerts extend beyond the first row during their authored bounce.
    func useModalLayout(){embedded=true;header.isHidden=true;grid.isScrollEnabled=false;grid.bounces=false;grid.clipsToBounds=false;setNeedsLayout()}
    private(set) var sections:[NativeBackpackCatalog.Section]=[]
    var onClose:(()->Void)?,onDie:((NativeBackpackCatalog.Die)->Void)?
    init(frame:CGRect,assets:JimiV9Artwork,title:String="Backpack",arcadeCrate:Bool=false) {
        self.assets=assets;self.arcadeCrate=arcadeCrate
        let layout=UICollectionViewFlowLayout();layout.minimumInteritemSpacing=16;layout.minimumLineSpacing=20
        layout.sectionInset=UIEdgeInsets(top:0,left:32,bottom:0,right:32)
        grid=UICollectionView(frame:.zero,collectionViewLayout:layout)
        super.init(frame:frame)
        accessibilityIdentifier=arcadeCrate ? "native.arcade.crate":"native.backpack"
        grid.backgroundColor = .clear;grid.showsVerticalScrollIndicator=false;grid.contentInsetAdjustmentBehavior = .never
        grid.register(NativeBackpackCell.self,forCellWithReuseIdentifier:"die")
        grid.register(NativeBackpackSectionHeader.self,forSupplementaryViewOfKind:UICollectionView.elementKindSectionHeader,withReuseIdentifier:"section")
        grid.dataSource=self;grid.delegate=self;grid.isPrefetchingEnabled=false
        addSubview(grid);addSubview(header)
        header.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:0.8);header.isOpaque=false
        self.title.text=title;self.title.font=assets.font(size:28);self.title.textColor=NativeBackpackCell.ink;self.title.textAlignment = .center
        header.addSubview(self.title);header.addSubview(close)
        close.setImage(assets.image("assets/close-icon.png",densityAware:true),for:.normal)
        close.imageView?.contentMode = .scaleAspectFit;close.imageEdgeInsets=UIEdgeInsets(top:10,left:10,bottom:10,right:10)
        close.enableArtworkTapFeedback();close.accessibilityLabel="Close \(title)";close.accessibilityIdentifier=arcadeCrate ? "native.arcade.crate.close":"native.backpack.close"
        close.addTarget(self,action:#selector(closeTapped),for:.touchUpInside)
    }
    required init?(coder:NSCoder){fatalError("Use assets initializer")}
    func apply(_ sections:[NativeBackpackCatalog.Section],includesArcade:Bool=false) {self.includesArcade=arcadeCrate || includesArcade;self.sections=arcadeCrate ? []:sections;seenUnreadDice.removeAll();grid.setContentOffset(CGPoint(x:0,y:-grid.contentInset.top),animated:false);grid.reloadData();setNeedsLayout();layoutIfNeeded()}
    override func layoutSubviews() {
        super.layoutSubviews()
        let row=JimiV9NavigationHeader.RowLayout(bounds:bounds,safeAreaTop:safeAreaInsets.top),height=embedded ? 16:row.top+66
        header.bounds=CGRect(x:0,y:0,width:bounds.width,height:height);header.center=CGPoint(x:bounds.midX,y:height/2)
        title.frame=row.titleFrame
        close.frame=row.buttonFrame(x:22)
        let previousTop=grid.contentInset.top,previousOffset=grid.contentOffset
        grid.frame=bounds
        if previousTop != height {
            grid.contentInset.top=height
            grid.setContentOffset(CGPoint(x:previousOffset.x,y:previousOffset.y+previousTop-height),animated:false)
        }
        grid.contentInset.bottom=embedded ? 16:safeAreaInsets.bottom+16
        if embedded,let layout=grid.collectionViewLayout as? UICollectionViewFlowLayout {
            let inset=max(24,(bounds.width-2*modalItemSide-16)/2)
            layout.sectionInset=UIEdgeInsets(top:0,left:inset,bottom:0,right:inset);layout.minimumLineSpacing=16
            layout.invalidateLayout()
        }
        if let layout=grid.collectionViewLayout as? UICollectionViewFlowLayout {
            let side=floor((bounds.width-84)/2)
            if layout.itemSize.width != side {layout.itemSize=CGSize(width:side,height:side);layout.headerReferenceSize=CGSize(width:bounds.width,height:100);layout.invalidateLayout()}
        }
    }
    // The board modal shows one World: keep every row inside its available height.
    private var modalItemSide:CGFloat {
        let rows=max(1,sections.reduce(0){$0+($1.dice.count+1)/2}+(includesArcade ? (NativeBackpackCatalog.arcade.count+1)/2:0))
        let available=max(0,bounds.height-32-CGFloat(rows-1)*16)
        return max(0,min(floor((bounds.width-64)/2),floor(available/CGFloat(rows))))
    }
    func numberOfSections(in collectionView:UICollectionView)->Int {sections.count+(includesArcade ? 1:0)}
    func collectionView(_ collectionView:UICollectionView,numberOfItemsInSection section:Int)->Int {includesArcade && section==0 ? NativeBackpackCatalog.arcade.count:sections[section-(includesArcade ? 1:0)].dice.count}
    func collectionView(_ collectionView:UICollectionView,cellForItemAt indexPath:IndexPath)->UICollectionViewCell {
        let cell=collectionView.dequeueReusableCell(withReuseIdentifier:"die",for:indexPath) as! NativeBackpackCell
        let die=includesArcade && indexPath.section==0 ? NativeBackpackCatalog.arcade[indexPath.item]:sections[indexPath.section-(includesArcade ? 1:0)].dice[indexPath.item]
        let unlocked=includesArcade && indexPath.section==0 || sections[indexPath.section-(includesArcade ? 1:0)].unlocked.contains(die.id)
        cell.apply(die,unlocked:unlocked,right:indexPath.item%2==1,arcade:includesArcade && indexPath.section==0 && !arcadeCrate,assets:assets,illustrationScale:arcadeCrate ? (die.id=="wild-magnet" ? 0.8:die.id=="tnt" ? 0.95:1):1)
        let section=indexPath.section-(includesArcade ? 1:0)
        cell.setAlert(unread:unlocked && section>=0 && sections[section].unread.contains(die.id),active:alertsActive && !isHidden);return cell
    }
    func collectionView(_ collectionView:UICollectionView,viewForSupplementaryElementOfKind kind:String,at indexPath:IndexPath)->UICollectionReusableView {
        let header=collectionView.dequeueReusableSupplementaryView(ofKind:kind,withReuseIdentifier:"section",for:indexPath) as! NativeBackpackSectionHeader
        if arcadeCrate {header.apply(title:"Arcade",detail:nil,count:"\(NativeBackpackCatalog.arcade.count) / \(NativeBackpackCatalog.arcade.count)",assets:assets)}
        else if includesArcade && indexPath.section==0 {header.apply(title:"Arcade",detail:"Always ready to play! Unlock more dice in Journey for even more fun.",count:nil,assets:assets)}
        else {let section=sections[indexPath.section-(includesArcade ? 1:0)];header.apply(title:section.title,detail:nil,count:"\(section.count) / \(section.dice.count)",assets:assets)}
        return header
    }
    func collectionView(_ collectionView:UICollectionView,layout collectionViewLayout:UICollectionViewLayout,sizeForItemAt indexPath:IndexPath)->CGSize {
        if embedded {return CGSize(width:modalItemSide,height:modalItemSide)}
        let columns:CGFloat=includesArcade && indexPath.section==0 && !arcadeCrate ? 3:2
        let side=floor((bounds.width-(embedded ? 48:64)-(columns-1)*(embedded ? 16:columns==3 ? 16:20))/columns)
        return CGSize(width:side,height:side)
    }
    func collectionView(_ collectionView:UICollectionView,layout collectionViewLayout:UICollectionViewLayout,referenceSizeForHeaderInSection section:Int)->CGSize {CGSize(width:bounds.width,height:embedded ? 0:includesArcade && section==0 && !arcadeCrate ? 156:100)}
    func collectionView(_ collectionView:UICollectionView,didSelectItemAt indexPath:IndexPath) {
        guard isUserInteractionEnabled else{return}
        let die=includesArcade && indexPath.section==0 ? NativeBackpackCatalog.arcade[indexPath.item]:sections[indexPath.section-(includesArcade ? 1:0)].dice[indexPath.item]
        guard (includesArcade && indexPath.section==0) || sections[indexPath.section-(includesArcade ? 1:0)].unlocked.contains(die.id) else{return}
        (collectionView.cellForItem(at:indexPath) as? NativeBackpackCell)?.playSelectionFeedback()
        onDie?(die)
    }
    /// The closing overlay may collect one tap on a revealed, unlocked cell.
    /// Presentation coordinates preserve the incoming collection's animated pose.
    func revealedDie(atWindowPoint point:CGPoint)->NativeBackpackCatalog.Die? {
        guard let window,!isHidden,window.bounds.contains(point) else{return nil}
        if !header.isHidden,header.frame.contains(convert(point,from:window)){return nil}
        let windowLayer=window.layer.presentation() ?? window.layer
        let paintedGrid=grid.layer.presentation() ?? grid.layer
        guard paintedGrid.bounds.contains(paintedGrid.convert(point,from:windowLayer)) else{return nil}
        for cell in grid.visibleCells {
            let painted=cell.layer.presentation() ?? cell.layer
            guard painted.bounds.contains(painted.convert(point,from:windowLayer)),let index=grid.indexPath(for:cell) else{continue}
            if includesArcade,index.section==0 {return NativeBackpackCatalog.arcade[index.item]}
            let section=sections[index.section-(includesArcade ? 1:0)],die=section.dice[index.item]
            return section.unlocked.contains(die.id) ? die:nil
        }
        return nil
    }
    func tracks(enter:Bool)->[(UIView,JimiV9Motion.Track)] {
        layoutIfNeeded();grid.layoutIfNeeded()
        let visible=grid.visibleCells.sorted{$0.frame.minY == $1.frame.minY ? $0.frame.minX<$1.frame.minX:$0.frame.minY<$1.frame.minY}
        let labels=grid.visibleSupplementaryViews(ofKind:UICollectionView.elementKindSectionHeader)
        let targets=[header as UIView]+labels+visible
        return (enter ? targets:Array(targets.reversed())).enumerated().map {i,target in
            let reduced=UIAccessibility.isReduceMotionEnabled,delay=reduced || !enter ? 0:Double(i)*0.035
            return (target,.init(tweens:[.init(begin:delay,duration:reduced ? 0.16:enter ? 0.56:0.40,from:.scale(enter ? 0:1),to:.scale(enter ? 1:0),ease:enter ? .backOut(1.8):.backIn(1.7))]))
        }
    }
    @objc private func closeTapped(){close.playArtworkTapFeedback();onClose?()}
}

/// Per-character Worlds-Hub-style pose recipes; one existing layer loop per visible card.
struct NativeBackpackArtworkIdleMotion {
    static let playbackRate=1.4
    let baseDuration:Double
    let drift:CGPoint,tilt:CGPoint
    let roll:CGFloat,depth:CGFloat
    private let pathStyle:Int
    init(id:String) {
        let recipe:(Double,CGFloat,CGFloat,CGFloat,CGFloat,CGFloat,CGFloat)
        switch id {
        case "tnt":recipe=(4.40,-2.8,-7.2,-1.7,6.2,1.1,8)
        case "wild-magnet":recipe=(4.64,3.4,-5.8,1.8,-7.2,-1.3,7)
        case "cubero":recipe=(4.83,-1.8,-8.4,-2.1,-5.8,1.5,10)
        case "baloon":recipe=(5.06,2.6,-9.0,1.5,5.4,-0.9,9)
        case "bee":recipe=(4.42,3.2,-7.8,-1.6,6.8,1.2,8)
        case "wild-star":recipe=(4.91,-3.1,-6.2,2.0,-6.4,-1.4,10)
        case "flower":recipe=(5.18,2.1,-5.8,-1.8,5.9,1.3,7)
        case "honey":recipe=(4.73,-2.5,-6.8,1.4,-5.6,-1.0,8)
        case "mushroom":recipe=(4.58,1.8,-8.1,-2.2,6.1,1.1,9)
        case "barell":recipe=(5.11,-3.4,-5.4,1.7,-7.0,-1.5,7)
        case "robo-cube":recipe=(4.69,2.7,-6.4,-1.5,-6.2,1.4,9)
        case "kanta":recipe=(4.98,-2.3,-7.4,2.1,5.8,-1.2,8)
        case "spaceship":recipe=(5.23,3.6,-8.6,-1.3,7.1,0.9,11)
        case "laser-gun":recipe=(4.53,-3.0,-5.9,1.9,-6.7,-1.1,7)
        case "wild-juice":recipe=(4.77,2.4,-7.1,-2.0,5.7,1.0,8)
        case "fish":recipe=(5.02,-3.7,-6.6,1.6,-7.3,-1.3,10)
        case "beach-ball":recipe=(4.87,3.0,-8.3,-1.9,6.5,1.6,9)
        case "bottle":recipe=(5.16,-2.0,-6.0,1.8,-5.9,-1.0,8)
        default:recipe=(4.85,2,-7,-1.7,6,1.1,8)
        }
        let styles=[["tnt","bee","honey","laser-gun"],["wild-magnet","flower","barell","fish"],["cubero","mushroom","robo-cube","beach-ball"],["baloon","wild-star","kanta","spaceship","wild-juice","bottle"]]
        pathStyle=styles.firstIndex{$0.contains(id)} ?? 0
        baseDuration=recipe.0;drift=CGPoint(x:recipe.1,y:recipe.2)
        tilt=CGPoint(x:recipe.3,y:recipe.4);roll=recipe.5;depth=recipe.6
    }
    var duration:Double {baseDuration/Self.playbackRate}
    func poses(scale:CGFloat)->[CATransform3D] {
        // Neutral → forward lean → opposite lean → soft return, like Worlds Hub.
        let weights:[(CGFloat,CGFloat,CGFloat,CGFloat)]
        switch pathStyle {
        case 1:weights=[(0,0,0,0),(1,0.55,1,0.6),(-1,0.25,-1,1),(-0.25,-0.1,-0.2,0.3),(0,0,0,0)]
        case 2:weights=[(0,0,0,0),(0.4,1,0.6,1),(1,-0.22,-1,0.35),(-0.6,0.45,0.35,0.65),(0,0,0,0)]
        case 3:weights=[(0,0,0,0),(1,0.65,1,0.7),(-0.2,1,-0.75,1),(-0.85,0.12,0.3,0.4),(0,0,0,0)]
        default:weights=[(0,0,0,0),(1,1,1,1),(-0.65,0.35,-0.8,0.7),(0.25,-0.15,0.25,0.3),(0,0,0,0)]
        }
        return weights.map {side,lift,turn,forward in
            var t=CATransform3DIdentity;t.m34 = -1/(720*max(0.01,scale))
            t=CATransform3DTranslate(t,drift.x*side*scale,drift.y*lift*scale,depth*forward*scale)
            t=CATransform3DRotate(t,tilt.x*turn * .pi/180,1,0,0)
            t=CATransform3DRotate(t,tilt.y*turn * .pi/180,0,1,0)
            t=CATransform3DRotate(t,roll*turn * .pi/180,0,0,1)
            return CATransform3DScale(t,1+0.012*forward,1+0.012*forward,1)
        }
    }
}

/// Paint the original frame once at the actual display density. UIKit's
/// high-quality resampling preserves the thin painted alpha edge before the
/// card's Core Animation perspective is applied; idle never redraws this view.
@MainActor
private final class NativeBackpackFrameView:UIView {
    var image:UIImage? {didSet{if oldValue !== image {setNeedsDisplay()}}}
    override init(frame:CGRect){
        super.init(frame:frame);isOpaque=false;isUserInteractionEnabled=false
        contentMode = .redraw;accessibilityIdentifier="native.backpack.frame"
    }
    required init?(coder:NSCoder){fatalError("Use frame")}
    override func draw(_ rect:CGRect){
        guard let image,let context=UIGraphicsGetCurrentContext(),image.size.width>0,image.size.height>0 else{return}
        context.interpolationQuality = .high
        context.setAllowsAntialiasing(true);context.setShouldAntialias(true)
        let factor=min(bounds.width/image.size.width,bounds.height/image.size.height)
        let size=CGSize(width:image.size.width*factor,height:image.size.height*factor)
        image.draw(in:CGRect(x:bounds.midX-size.width/2,y:bounds.midY-size.height/2,width:size.width,height:size.height))
    }
}
@MainActor
private final class NativeBackpackCell:UICollectionViewCell {
    static let ink=UIColor(red:0.68,green:0.53,blue:0.46,alpha:1)
    private let artworkGroup=UIView()
    private let holder=NativeBackpackFrameView(frame:.zero),die=UIImageView()
    let alert=NativeBackpackAlertView()
    private var alertRight=false
    private var arcade=false
    private var artworkSize=CGSize(width:80,height:80)
    private var artworkOffset=CGPoint.zero
    private var artworkActive=false
    private var artworkIdentity:String?
    private var artworkIdleOffset:CFTimeInterval=0
    private var artworkIdleMotion=NativeBackpackArtworkIdleMotion(id:"")
    private static let artworkIdleKey="backpack.artwork.idle"
    override func didMoveToWindow(){super.didMoveToWindow();configureArtworkSampling();reconcileArtworkIdle()}
    private func configureArtworkSampling(){
        let scale=window?.screen.scale ?? traitCollection.displayScale
        artworkGroup.layer.contentsScale=max(1,scale)
        if holder.contentScaleFactor != max(1,scale) {holder.contentScaleFactor=max(1,scale)}
        artworkGroup.layer.allowsEdgeAntialiasing=true
        for image in [holder as UIView,die] {
            image.layer.allowsEdgeAntialiasing=true
            image.layer.edgeAntialiasingMask=[.layerLeftEdge,.layerRightEdge,.layerTopEdge,.layerBottomEdge]
            image.layer.minificationFilter = .trilinear
            image.layer.magnificationFilter = .linear
        }
    }
    private func stopArtworkIdle(reset:Bool=false){
        if let motion=artworkGroup.layer.animation(forKey:Self.artworkIdleKey) {
            artworkIdleOffset=(artworkGroup.layer.convertTime(CACurrentMediaTime(),from:nil)-motion.beginTime+motion.timeOffset).truncatingRemainder(dividingBy:motion.duration)
            CATransaction.begin();CATransaction.setDisableActions(true)
            artworkGroup.layer.transform=artworkGroup.layer.presentation()?.transform ?? artworkGroup.layer.transform
            artworkGroup.layer.removeAnimation(forKey:Self.artworkIdleKey)
            CATransaction.commit()
        }
        if reset {artworkIdleOffset=0;artworkGroup.layer.transform=CATransform3DIdentity}
    }
    private func reconcileArtworkIdle(){
        guard artworkActive,die.tag==1,window != nil,contentView.bounds.width>0,!UIAccessibility.isReduceMotionEnabled else{stopArtworkIdle();return}
        guard artworkGroup.layer.animation(forKey:Self.artworkIdleKey)==nil else{return}
        // One selected recipe owns perspective, float and local tilt together.
        // Holder, die and corner alert remain one card; parent owns tap/route motion.
        let scale=contentView.bounds.width/(arcade ? 98:153)
        let motion=CAKeyframeAnimation(keyPath:"transform")
        motion.values=artworkIdleMotion.poses(scale:scale).map{NSValue(caTransform3D:$0)}
        motion.keyTimes=[0,0.28,0.58,0.78,1];motion.duration=artworkIdleMotion.duration
        motion.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:4)
        motion.repeatCount = .infinity
        motion.beginTime=artworkGroup.layer.convertTime(CACurrentMediaTime(),from:nil);motion.timeOffset=artworkIdleOffset
        artworkGroup.layer.add(motion,forKey:Self.artworkIdleKey)
    }
    override init(frame:CGRect){super.init(frame:frame);for image in [holder as UIView,die]{artworkGroup.addSubview(image)};die.contentMode = .scaleAspectFit;artworkGroup.addSubview(alert);contentView.addSubview(artworkGroup);artworkGroup.accessibilityIdentifier="native.backpack.idle-group";isAccessibilityElement=true}
    required init?(coder:NSCoder){fatalError("Use frame")}
    func apply(_ item:NativeBackpackCatalog.Die,unlocked:Bool,right:Bool,arcade:Bool,assets:JimiV9Artwork,illustrationScale:CGFloat=1) {
        if artworkIdentity != item.id {stopArtworkIdle(reset:true);artworkIdentity=item.id}
        artworkIdleMotion=NativeBackpackArtworkIdleMotion(id:item.id)
        self.arcade=arcade;alertRight=right;alert.clockwise=right
        alert.image=assets.image("assets/nav/new.png",densityAware:true)
        let holderSuffix = !unlocked ? " locked" : arcade ? (item.id=="baloon" ? " middle" : item.id=="tnt" ? " desno" : "") : (right ? " desno" : "")
        holder.image=assets.image("assets/backpack/dice holder\(holderSuffix).png",densityAware:true)
        die.image=assets.image(unlocked ? item.artwork.path:"assets/backpack/lokot.png",densityAware:true)
        artworkSize=arcade ? CGSize(width:80,height:80):CGSize(width:120,height:120);artworkOffset = arcade ? .zero:CGPoint(x:-0.5,y:-0.5)
        if arcade,unlocked,let image=die.image,let tntDie=NativeBackpackCatalog.arcade.first(where:{$0.id=="tnt"}),let tnt=assets.image(tntDie.artwork.path,densityAware:true) {
            let originalTntHeight=min(60/tnt.size.width,80/tnt.size.height)*tnt.size.height
            let targetHeight=originalTntHeight*NativeBackpackDetail.visibleHeightRatio(tnt)*1.10
            let visible=NativeBackpackDetail.visibleArtworkBounds(image)
            let artworkScale:CGFloat=["cubero","wild-magnet"].contains(item.id) ? 0.9:1
            let height=targetHeight*artworkScale/visible.height
            artworkSize=CGSize(width:height*image.size.width/image.size.height,height:height)
            artworkOffset=CGPoint(x:(visible.midX-0.5)*artworkSize.width,y:(visible.midY-0.5)*height)
        }else if unlocked,item.id=="laser-gun" {
            artworkSize=CGSize(width:144,height:144)
        }else if unlocked,item.id=="barell",let image=die.image {
            let visible=NativeBackpackDetail.visibleArtworkBounds(image)
            let height=120/visible.height
            artworkSize=CGSize(width:height*image.size.width/image.size.height,height:height)
            artworkOffset=CGPoint(x:(visible.midX-0.5)*artworkSize.width,y:(visible.midY-0.5)*height)
        }
        if unlocked {
            let iconScale:CGFloat=item.id=="barell" ? 0.855:item.id=="mushroom" ? 0.95:["honey","bloob-ball"].contains(item.id) ? 0.85:["wild-star","wild-juice","beach-ball"].contains(item.id) ? 0.9:1
            artworkSize=CGSize(width:artworkSize.width*iconScale,height:artworkSize.height*iconScale)
            artworkOffset=CGPoint(x:artworkOffset.x*iconScale,y:artworkOffset.y*iconScale)
        }
        if unlocked {artworkSize=CGSize(width:artworkSize.width*illustrationScale,height:artworkSize.height*illustrationScale)}
        if !unlocked {stopArtworkIdle(reset:true)}
        die.tag=unlocked ? 1:0;accessibilityLabel=item.title+(unlocked ? "":" Locked");accessibilityTraits=unlocked ? .button:.image
        accessibilityIdentifier="native.backpack.die.\(item.id)";die.accessibilityIdentifier="native.backpack.idle-artwork";reconcileArtworkIdle();setNeedsLayout()
    }
    func setAlert(unread:Bool,active:Bool){alert.isHidden = !unread;alert.setActive(unread && active);artworkActive=active;layoutIfNeeded();reconcileArtworkIdle()}
    override func layoutSubviews(){super.layoutSubviews();configureArtworkSampling();artworkGroup.bounds=contentView.bounds;artworkGroup.center=CGPoint(x:contentView.bounds.midX,y:contentView.bounds.midY);let scale=contentView.bounds.width/(arcade ? 98:153);holder.bounds=CGRect(x:0,y:0,width:contentView.bounds.width+(die.tag==0 ? 2*scale:0),height:contentView.bounds.height);holder.center=CGPoint(x:contentView.bounds.midX,y:contentView.bounds.midY);let size=die.tag==0 ? CGSize(width:70*scale,height:80*scale):CGSize(width:artworkSize.width*scale,height:artworkSize.height*scale);die.bounds=CGRect(origin:.zero,size:size);die.center=CGPoint(x:contentView.bounds.midX-artworkOffset.x*scale,y:contentView.bounds.midY-artworkOffset.y*scale)
        alert.bounds=CGRect(x:0,y:0,width:58*1.1*scale,height:58*1.1*scale);alert.center=CGPoint(x:alertRight ? contentView.bounds.width-14*scale:14*scale,y:14*scale)
        reconcileArtworkIdle()
    }
    func playSelectionFeedback(){NativeHubBackpackFeedback.play(on:contentView)}
    override func prepareForReuse(){super.prepareForReuse();artworkActive=false;stopArtworkIdle(reset:true);artworkIdentity=nil;alert.setActive(false);alert.isHidden=true;holder.image=nil;die.image=nil;contentView.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey);layer.removeAllAnimations();layer.transform=CATransform3DIdentity;layer.opacity=1}
}
@MainActor
private final class NativeBackpackSectionHeader:UICollectionReusableView {
    private let heading=UILabel(),detail=UILabel(),count=UILabel()
    override init(frame:CGRect){super.init(frame:frame);[heading,detail,count].forEach{addSubview($0)};detail.numberOfLines=2}
    required init?(coder:NSCoder){fatalError("Use frame")}
    func apply(title:String,detail:String?,count:String?,assets:JimiV9Artwork){heading.text=title;heading.font=assets.font(size:28,weight:"ExtraBold");heading.textColor=NativeBackpackCell.ink;self.detail.text=detail;self.detail.font=assets.font(size:18,weight:"Medium");if let detail {self.detail.attributedText=NativeModalTypography.attributedSubtitle(detail,font:assets.font(size:18,weight:"Medium"),alignment:.left)};self.detail.textColor=NativeTextPalette.subtitle;self.count.text=count;self.count.font=assets.font(size:24,weight:"ExtraBold");self.count.textColor=UIColor(red:232/255,green:116/255,blue:74/255,alpha:1);self.count.textAlignment = .right}
    override func layoutSubviews(){super.layoutSubviews();let top:CGFloat=detail.text == nil ? 40:32;heading.frame=CGRect(x:32,y:top,width:bounds.width-140,height:40);count.frame=CGRect(x:bounds.width-112,y:top,width:80,height:40);detail.frame=CGRect(x:32,y:top+48,width:bounds.width-64,height:56)}
}

/// One visible-cell decoration, independent of the card selection/route transform.
@MainActor
final class NativeBackpackAlertView:UIImageView,CAAnimationDelegate {
    static let motionKey="backpack.alert.idle"
    static let exitKey="backpack.alert.exit"
    private var exiting=false
    static func randomRotation(clockwise:Bool=true)->CGFloat {CGFloat.random(in:5...10) * (clockwise ? 1:-1) * .pi/180}
    var clockwise=true {
        didSet {
            guard clockwise != oldValue else{return}
            epoch += 1;layer.removeAnimation(forKey:Self.motionKey)
            layer.transform=restingTransform;reconcile()
        }
    }
    private var restingRotation:CGFloat {(clockwise ? 1:-1) * .pi/18}
    private var restingTransform:CATransform3D {CATransform3DMakeRotation(restingRotation,0,0,1)}
    private var active=false
    private var epoch=0
    private(set) var cycleRotation:CGFloat=0
    init(){super.init(frame:.zero);contentMode = .scaleAspectFit;isUserInteractionEnabled=false;isHidden=true;accessibilityIdentifier="native.backpack.alert";layer.transform=restingTransform}
    required init?(coder:NSCoder){fatalError("Use init")}
    override func didMoveToWindow(){super.didMoveToWindow();reconcile()}
    func setActive(_ value:Bool){active=value;reconcile()}
    /// Finite badge exit starts in the same transaction as the backpack switch.
    func setUnreadVisible(_ visible:Bool,delay:TimeInterval=0){
        if visible {
            exiting=false;layer.removeAnimation(forKey:Self.exitKey);layer.opacity=1;isHidden=false;reconcile();return
        }
        guard !isHidden,!exiting else{return}
        active=false;epoch += 1;exiting=true
        let painted=layer.presentation()?.transform ?? layer.transform
        layer.removeAnimation(forKey:Self.motionKey)
        guard !UIAccessibility.isReduceMotionEnabled else{exiting=false;isHidden=true;return}
        let scale=CAKeyframeAnimation(keyPath:"transform")
        scale.values=(0...32).map { step in
            let t=Double(step)/32,s=CGFloat(1-JimiV9Motion.Ease.backIn(1.7).value(t))
            return NSValue(caTransform3D:CATransform3DScale(painted,s,s,1))
        }
        let fade=CABasicAnimation(keyPath:"opacity");fade.fromValue=layer.presentation()?.opacity ?? 1;fade.toValue=0
        let group=CAAnimationGroup();group.animations=[scale,fade];group.duration=0.16
        group.delegate=self;group.setValue(true,forKey:"alertExit");group.setValue(epoch,forKey:"alertEpoch")
        group.fillMode = .backwards;group.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)+max(0,delay)
        layer.opacity=0;layer.add(group,forKey:Self.exitKey)
    }
    func animationDidStop(_ animation:CAAnimation,finished flag:Bool){
        guard flag,(animation.value(forKey:"alertEpoch") as? Int)==epoch else{return}
        if animation.value(forKey:"alertExit") as? Bool == true {exiting=false;isHidden=true;return}
        guard active,window != nil,!isHidden else{return}
        layer.removeAnimation(forKey:Self.motionKey);reconcile()
    }
    private func reconcile(){
        guard !exiting else{return}
        guard active,window != nil,!isHidden,!UIAccessibility.isReduceMotionEnabled else {epoch += 1;layer.removeAnimation(forKey:Self.motionKey);return}
        guard layer.animation(forKey:Self.motionKey)==nil else{return}
        epoch += 1;cycleRotation=Self.randomRotation(clockwise:clockwise)
        let poses:[(CGFloat,CGFloat,CGFloat)]=[(1,1,0),(1.16,0.82,3),(0.88,1.14,-7),(1.08,0.92,1),(0.97,1.03,-2),(1,1,0),(1,1,0)]
        let motion=CAKeyframeAnimation(keyPath:"transform")
        motion.values=poses.enumerated().map{index,pose in
            let (x,y,offset)=pose,weights:[CGFloat]=[0,0.35,1,0.55,0.2,0,0]
            // Keep the badge tilted at rest as well as during its bounce.
            // Interpolation between the 10° rest and 5–10° peak stays bounded.
            let angle=restingRotation+(cycleRotation-restingRotation)*weights[index]
            let transform=CATransform3DRotate(CATransform3DMakeTranslation(0,offset,0),angle,0,0,1)
            return NSValue(caTransform3D:CATransform3DScale(transform,x,y,1))
        }
        motion.keyTimes=[0,0.10,0.22,0.34,0.46,0.58,1];motion.duration=2.4
        motion.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:6)
        motion.delegate=self;motion.setValue(epoch,forKey:"alertEpoch");layer.add(motion,forKey:Self.motionKey)
    }
}
