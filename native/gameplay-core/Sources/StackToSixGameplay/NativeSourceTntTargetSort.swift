/*
 * Copyright (C) 2024 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import Foundation

/// Swift port of the iOS JSC comparator schedule. Selection must be called at
/// the genuine Source TNT target-selection endpoint, with the shared APP Math.
/// Array order and comparator draws are both observable gameplay behavior.
public enum NativeSourceTntTargetSort {
 private enum Cancelled:Error {case stale}
 public static func select(candidateIDs:[String],random:()->Double,current:()->Bool)->[String]? {
  guard current() else{return nil}
  // Native boards contain at most63 eligible targets. Refuse unsupported
  // sizes before consuming Math rather than guessing another sort recipe.
  guard candidateIDs.count<=63 else{return nil}
  var values=candidateIDs
  func less(_ left:String,_ right:String)throws->Bool {
   guard current() else{throw Cancelled.stale}
   let roll=random()
   guard current() else{throw Cancelled.stale}
   return roll-0.5<0
  }
  func insertion(_ begin:Int,_ length:Int,_ header:Int)throws {
   guard header+1<length else{return}
   for offset in (header+1)..<length {
    let i=begin+offset,value=values[i];var left=0,right=offset
    while left<right {let middle=(left+right)/2;if try less(value,values[begin+middle]){right=middle}else{left=middle+1}}
    if left<offset {for j in stride(from:i,through:begin+left+1,by:-1){values[j]=values[j-1]}}
    values[begin+left]=value
   }
  }
  func extend(_ begin:Int)throws->Int {
   var end=begin
   while end+1<values.count {if try less(values[end+1],values[end]){break};end+=1}
   return end
  }
  func merge(_ left:Int,_ middle:Int,_ end:Int)throws {
   let old=values;var a=left,b=middle
   for out in left...end {
    if b<=end {
     if a>=middle {values[out]=old[b];b+=1;continue}
     if try less(old[b],old[a]) {values[out]=old[b];b+=1;continue}
    }
    values[out]=old[a];a+=1
   }
  }
  func power(_ left:Int,_ middle:Int,_ right:Int)->Int {
   let n=values.count;var a=left+middle,b=middle+right+1
   // Integer long division gives exact leading differing bits of the JSC
   // UInt128 quotient without floating-point rounding or large intermediates.
   for bit in 1...63 {if a/n != b/n{return bit};a=(a%n)*2;b=(b%n)*2}
   return 64
  }
  do {
   let n=values.count
   if n<8 {try insertion(0,n,0)}
   else {
    var begin=0,end=try extend(0)
    if end-begin<8 {let size=min(64,n-begin);try insertion(begin,size,end-begin);end=begin+size-1}
    while end+1<n {if try less(values[end+1],values[end]){break};end+=1}
    var stack:[(begin:Int,end:Int,power:Int)]=[]
    while end+1<n {
     let nextBegin=end+1;var nextEnd=try extend(nextBegin)
     if nextEnd-nextBegin<8 {let size=min(64,n-nextBegin);try insertion(nextBegin,size,nextEnd-nextBegin);nextEnd=nextBegin+size-1}
     while nextEnd+1<n {if try less(values[nextEnd+1],values[nextEnd]){break};nextEnd+=1}
     let p=power(begin,nextBegin,nextEnd)
     while let last=stack.last,last.power>p {stack.removeLast();try merge(last.begin,begin,end);begin=last.begin}
     stack.append((begin,end,p));begin=nextBegin;end=nextEnd
    }
    while let last=stack.popLast(){try merge(last.begin,begin,end);begin=last.begin}
   }
   guard current() else{return nil}
   return Array(values.prefix(min(4,values.count)))
  }catch{return nil}
 }
}
