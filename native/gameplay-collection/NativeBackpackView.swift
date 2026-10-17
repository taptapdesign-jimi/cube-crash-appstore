import UIKit

/// Static, reusable cells load only when they intersect the scroll viewport.
@MainActor
final class NativeBackpackView:UIView,UICollectionViewDataSource,UICollectionViewDelegateFlowLayout {
    private let assets:JimiV9Artwork
    let header=JimiV9NavigationHeader(frame:.zero),close=JimiV9PlainButton(type:.custom)
    let grid:UICollectionView
    private let title=UILabel()
    private(set) var includesArcade=true
    private var embedded=false
    func useModalLayout(){embedded=true;header.isHidden=true;setNeedsLayout()}
    private(set) var sections:[NativeBackpackCatalog.Section]=[]
    var onClose:(()->Void)?,onDie:((NativeBackpackCatalog.Die)->Void)?
    init(frame:CGRect,assets:JimiV9Artwork) {
        self.assets=assets
        let layout=UICollectionViewFlowLayout();layout.minimumInteritemSpacing=16;layout.minimumLineSpacing=20
        layout.sectionInset=UIEdgeInsets(top:0,left:32,bottom:0,right:32)
        grid=UICollectionView(frame:.zero,collectionViewLayout:layout)
        super.init(frame:frame)
        accessibilityIdentifier="native.backpack"
        grid.backgroundColor = .clear;grid.showsVerticalScrollIndicator=false;grid.contentInsetAdjustmentBehavior = .never
        grid.register(NativeBackpackCell.self,forCellWithReuseIdentifier:"die")
        grid.register(NativeBackpackSectionHeader.self,forSupplementaryViewOfKind:UICollectionView.elementKindSectionHeader,withReuseIdentifier:"section")
        grid.dataSource=self;grid.delegate=self;grid.isPrefetchingEnabled=false
        addSubview(grid);addSubview(header)
        header.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:0.8);header.isOpaque=false
        title.text="Backpack";title.font=assets.font(size:28);title.textColor=NativeBackpackCell.ink;title.textAlignment = .center
        header.addSubview(title);header.addSubview(close)
        close.setImage(assets.image("assets/close-icon.png",densityAware:true),for:.normal)
        close.imageView?.contentMode = .scaleAspectFit;close.imageEdgeInsets=UIEdgeInsets(top:10,left:10,bottom:10,right:10)
        close.accessibilityLabel="Close Backpack";close.accessibilityIdentifier="native.backpack.close"
        close.addTarget(self,action:#selector(closeTapped),for:.touchUpInside)
    }
    required init?(coder:NSCoder){fatalError("Use assets initializer")}
    func apply(_ sections:[NativeBackpackCatalog.Section],includesArcade:Bool=true) {self.includesArcade=includesArcade;self.sections=sections;grid.setContentOffset(CGPoint(x:0,y:-grid.contentInset.top),animated:false);grid.reloadData();setNeedsLayout();layoutIfNeeded()}
    override func layoutSubviews() {
        super.layoutSubviews()
        let row=JimiV9NavigationHeader.RowLayout(bounds:bounds,safeAreaTop:safeAreaInsets.top),height=embedded ? 0:row.top+66
        header.bounds=CGRect(x:0,y:0,width:bounds.width,height:height);header.center=CGPoint(x:bounds.midX,y:height/2)
        title.frame=row.titleFrame
        close.frame=row.buttonFrame(x:22)
        let previousTop=grid.contentInset.top,previousOffset=grid.contentOffset
        grid.frame=bounds
        if previousTop != height {
            grid.contentInset.top=height
            grid.setContentOffset(CGPoint(x:previousOffset.x,y:previousOffset.y+previousTop-height),animated:false)
        }
        grid.contentInset.bottom=embedded ? 0:safeAreaInsets.bottom+16
        if embedded,let layout=grid.collectionViewLayout as? UICollectionViewFlowLayout {layout.sectionInset=UIEdgeInsets(top:0,left:24,bottom:0,right:24);layout.minimumLineSpacing=16}
        if let layout=grid.collectionViewLayout as? UICollectionViewFlowLayout {
            let side=floor((bounds.width-84)/2)
            if layout.itemSize.width != side {layout.itemSize=CGSize(width:side,height:side);layout.headerReferenceSize=CGSize(width:bounds.width,height:100);layout.invalidateLayout()}
        }
    }
    func numberOfSections(in collectionView:UICollectionView)->Int {sections.count+(includesArcade ? 1:0)}
    func collectionView(_ collectionView:UICollectionView,numberOfItemsInSection section:Int)->Int {includesArcade && section==0 ? NativeBackpackCatalog.arcade.count:sections[section-(includesArcade ? 1:0)].dice.count}
    func collectionView(_ collectionView:UICollectionView,cellForItemAt indexPath:IndexPath)->UICollectionViewCell {
        let cell=collectionView.dequeueReusableCell(withReuseIdentifier:"die",for:indexPath) as! NativeBackpackCell
        let die=includesArcade && indexPath.section==0 ? NativeBackpackCatalog.arcade[indexPath.item]:sections[indexPath.section-(includesArcade ? 1:0)].dice[indexPath.item]
        let unlocked=includesArcade && indexPath.section==0 || sections[indexPath.section-(includesArcade ? 1:0)].unlocked.contains(die.id)
        cell.apply(die,unlocked:unlocked,right:indexPath.item%2==1,arcade:includesArcade && indexPath.section==0,assets:assets);return cell
    }
    func collectionView(_ collectionView:UICollectionView,viewForSupplementaryElementOfKind kind:String,at indexPath:IndexPath)->UICollectionReusableView {
        let header=collectionView.dequeueReusableSupplementaryView(ofKind:kind,withReuseIdentifier:"section",for:indexPath) as! NativeBackpackSectionHeader
        if includesArcade && indexPath.section==0 {header.apply(title:"Arcade",detail:"Always ready to play! Unlock more dice in Journey for even more fun.",count:nil,assets:assets)}
        else {let section=sections[indexPath.section-(includesArcade ? 1:0)];header.apply(title:section.title,detail:nil,count:"\(section.count) / \(section.dice.count)",assets:assets)}
        return header
    }
    func collectionView(_ collectionView:UICollectionView,layout collectionViewLayout:UICollectionViewLayout,sizeForItemAt indexPath:IndexPath)->CGSize {
        let columns:CGFloat=includesArcade && indexPath.section==0 ? 3:2
        let side=floor((bounds.width-(embedded ? 48:64)-(columns-1)*(embedded ? 16:columns==3 ? 16:20))/columns)
        return CGSize(width:side,height:side)
    }
    func collectionView(_ collectionView:UICollectionView,layout collectionViewLayout:UICollectionViewLayout,referenceSizeForHeaderInSection section:Int)->CGSize {CGSize(width:bounds.width,height:embedded ? 0:includesArcade && section==0 ? 156:100)}
    func collectionView(_ collectionView:UICollectionView,didSelectItemAt indexPath:IndexPath) {
        guard isUserInteractionEnabled else{return}
        let die=includesArcade && indexPath.section==0 ? NativeBackpackCatalog.arcade[indexPath.item]:sections[indexPath.section-(includesArcade ? 1:0)].dice[indexPath.item]
        guard (includesArcade && indexPath.section==0) || sections[indexPath.section-(includesArcade ? 1:0)].unlocked.contains(die.id) else{return}
        (collectionView.cellForItem(at:indexPath) as? NativeBackpackCell)?.playSelectionFeedback()
        onDie?(die)
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
    @objc private func closeTapped(){NativeHubBackpackFeedback.play(on:close.imageView ?? close);onClose?()}
}

@MainActor
private final class NativeBackpackCell:UICollectionViewCell {
    static let ink=UIColor(red:0.68,green:0.53,blue:0.46,alpha:1)
    private let holder=UIImageView(),die=UIImageView()
    private var arcade=false
    private var artworkSize=CGSize(width:80,height:80)
    private var artworkOffset=CGPoint.zero
    override init(frame:CGRect){super.init(frame:frame);for image in [holder,die]{image.contentMode = .scaleAspectFit;contentView.addSubview(image)};isAccessibilityElement=true}
    required init?(coder:NSCoder){fatalError("Use frame")}
    func apply(_ item:NativeBackpackCatalog.Die,unlocked:Bool,right:Bool,arcade:Bool,assets:JimiV9Artwork) {
        self.arcade=arcade
        let holderSuffix = !unlocked ? " locked" : arcade ? (item.id=="wild-magnet" ? " middle" : item.id=="cubero" ? " desno" : "") : (right ? " desno" : "")
        holder.image=assets.image("assets/backpack/dice holder\(holderSuffix).png",densityAware:true)
        die.image=assets.image(unlocked ? item.artwork.path:"assets/backpack/lokot.png",densityAware:true)
        artworkSize=arcade ? CGSize(width:80,height:80):CGSize(width:120,height:120);artworkOffset = arcade ? .zero:CGPoint(x:-0.5,y:-0.5)
        if arcade,unlocked,let image=die.image,let tnt=assets.image(NativeBackpackCatalog.arcade[0].artwork.path,densityAware:true) {
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
            let iconScale:CGFloat=item.id=="barell" ? 0.855:item.id=="mushroom" ? 0.95:item.id=="honey" ? 0.85:["wild-star","wild-juice","beach-ball"].contains(item.id) ? 0.9:1
            artworkSize=CGSize(width:artworkSize.width*iconScale,height:artworkSize.height*iconScale)
            artworkOffset=CGPoint(x:artworkOffset.x*iconScale,y:artworkOffset.y*iconScale)
        }
        die.tag=unlocked ? 1:0;accessibilityLabel=item.title+(unlocked ? "":" Locked");accessibilityTraits=unlocked ? .button:.image
        accessibilityIdentifier="native.backpack.die.\(item.id)";setNeedsLayout()
    }
    override func layoutSubviews(){super.layoutSubviews();let scale=contentView.bounds.width/(arcade ? 98:153);holder.bounds=CGRect(x:0,y:0,width:contentView.bounds.width+(die.tag==0 ? 2*scale:0),height:contentView.bounds.height);holder.center=CGPoint(x:contentView.bounds.midX,y:contentView.bounds.midY);let size=die.tag==0 ? CGSize(width:70*scale,height:80*scale):CGSize(width:artworkSize.width*scale,height:artworkSize.height*scale);die.bounds=CGRect(origin:.zero,size:size);die.center=CGPoint(x:contentView.bounds.midX-artworkOffset.x*scale,y:contentView.bounds.midY-artworkOffset.y*scale)}
    func playSelectionFeedback(){NativeHubBackpackFeedback.play(on:contentView)}
    override func prepareForReuse(){super.prepareForReuse();holder.image=nil;die.image=nil;contentView.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey);layer.removeAllAnimations();layer.transform=CATransform3DIdentity;layer.opacity=1}
}
@MainActor
private final class NativeBackpackSectionHeader:UICollectionReusableView {
    private let heading=UILabel(),detail=UILabel(),count=UILabel()
    override init(frame:CGRect){super.init(frame:frame);[heading,detail,count].forEach{addSubview($0)};detail.numberOfLines=2}
    required init?(coder:NSCoder){fatalError("Use frame")}
    func apply(title:String,detail:String?,count:String?,assets:JimiV9Artwork){heading.text=title;heading.font=assets.font(size:28,weight:"ExtraBold");heading.textColor=NativeBackpackCell.ink;self.detail.text=detail;self.detail.font=assets.font(size:20,weight:"Medium");if let detail {self.detail.attributedText=NativeModalTypography.attributedSubtitle(detail,font:assets.font(size:20,weight:"Medium"),alignment:.left)};self.detail.textColor=NativeTextPalette.subtitle;self.count.text=count;self.count.font=assets.font(size:24,weight:"ExtraBold");self.count.textColor=UIColor(red:232/255,green:116/255,blue:74/255,alpha:1);self.count.textAlignment = .right}
    override func layoutSubviews(){super.layoutSubviews();let top:CGFloat=detail.text == nil ? 40:32;heading.frame=CGRect(x:32,y:top,width:bounds.width-140,height:40);count.frame=CGRect(x:bounds.width-112,y:top,width:80,height:40);detail.frame=CGRect(x:32,y:top+48,width:bounds.width-64,height:56)}
}
