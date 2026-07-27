export const formatTime=(sec=0)=>`${Math.floor(sec/60)}:${String(Math.max(0,sec%60)).padStart(2,'0')}`;
export const totalDuration=items=>items.reduce((sum,i)=>sum+(Number(i.durationSec)||0),0);
