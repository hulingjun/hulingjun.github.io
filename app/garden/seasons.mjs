export const SEASON_HOLD_SECONDS=18;
export const SEASON_TRANSITION_SECONDS=4;
export const SEASON_DURATION_SECONDS=22;
export const SEASON_CYCLE_SECONDS=88;
export const SEASONS=Object.freeze([
 Object.freeze({id:"spring",name:"春",en:"SPRING",note:"春雨润新芽"}),
 Object.freeze({id:"summer",name:"夏",en:"SUMMER",note:"日光穿过繁叶"}),
 Object.freeze({id:"autumn",name:"秋",en:"AUTUMN",note:"风起，金叶飘落"}),
 Object.freeze({id:"winter",name:"冬",en:"WINTER",note:"枝影映雪，静待新生"}),
]);
export function sampleSeason(elapsedSeconds){
 if(typeof elapsedSeconds!=="number"||!Number.isFinite(elapsedSeconds))throw new TypeError("elapsedSeconds must be a finite number");
 const remainder=elapsedSeconds%SEASON_CYCLE_SECONDS;
 const wrapped=remainder<0?remainder+SEASON_CYCLE_SECONDS:remainder;
 const time=wrapped>=SEASON_CYCLE_SECONDS||Object.is(wrapped,-0)?0:wrapped;
 const from=Math.floor(time/SEASON_DURATION_SECONDS),local=time-from*SEASON_DURATION_SECONDS;
 const transitioning=local>=SEASON_HOLD_SECONDS,to=transitioning?(from+1)%4:from;
 const progress=transitioning?Math.min(1,(local-SEASON_HOLD_SECONDS)/SEASON_TRANSITION_SECONDS):0;
 return {from,to,mix:progress*progress*(3-2*progress),transitioning,label:transitioning?SEASONS[from].name+" → "+SEASONS[to].name:SEASONS[from].name};
}
