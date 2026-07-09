import { gsap } from 'gsap';

const originalTo = gsap.to.bind(gsap);
const originalTimeline = gsap.timeline.bind(gsap);

export const getOriginalGsapTo = () => originalTo;
export const getOriginalGsapTimeline = () => originalTimeline;
