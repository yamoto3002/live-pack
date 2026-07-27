import {totalDuration,formatTime} from './time.js';
export function analyzeFlow(items,songs,live){
 const songItems=items.filter(i=>i.type==='song').map(i=>({...i,song:songs.find(s=>s.id===i.songId)})).filter(i=>i.song);
 const total=totalDuration(items),diff=live.timeLimitSec-total,good=[],warnings=[],suggestions=[];
 if(diff>=0)good.push(`合計 ${formatTime(total)}。持ち時間内に ${formatTime(diff)} の余白があります。`);else warnings.push(`持ち時間を ${formatTime(-diff)} オーバーしています。`);
 const first=songItems.slice(0,2);if(first.length===2&&first.every(x=>x.song.energy>=7))good.push('序盤のエネルギーが高く、入りが強いです。');
 const last=songItems.at(-1)?.song;if(last?.suitableFor.closer>=8)good.push('ラスト曲のクローザー適性が高いです。');else suggestions.push('ラスト向きスコアの高い曲で締めると印象が強まります。');
 if(songItems.filter(x=>x.song.suitableFor.firstTimeAudience>=8).length<2)warnings.push('初見向きの曲が少なめです。');else good.push('初見にも届きやすい曲が含まれています。');
 for(let i=1;i<songItems.length;i++){const a=songItems[i-1].song,b=songItems[i].song;if(a.rehearsalRisk>=6&&b.rehearsalRisk>=6)warnings.push(`${a.title} と ${b.title} でリハ不安度が続いています。`);if(a.moodTags.includes('dark')&&b.moodTags.includes('dark'))warnings.push('暗い曲が連続しています。');if(a.defaultDurationSec>=300&&b.defaultDurationSec>=300)warnings.push('長い曲が連続しています。')}
 let streak=0;items.forEach(i=>{if(i.type==='song')streak++;else{if(streak>=3)suggestions.push('3曲以上続く箇所に短いMCを入れると呼吸が作れます。');streak=0}});if(streak>=3)suggestions.push('連続する曲の間にMCを検討してください。');
 const swaps=songItems.filter((x,i)=>i&&x.song.equipment.guitar!==songItems[i-1].song.equipment.guitar);if(swaps.length)suggestions.push('ギター持ち替え箇所は45秒以上のMCまたは転換が安全です。');
 let score=100;if(diff<0)score-=20;if(diff>300)score-=8;score-=Math.min(30,warnings.length*7);score-=Math.min(15,suggestions.length*3);score=Math.max(45,score);
 return{score,total,diff,good,warnings,suggestions,energies:songItems.map(x=>({title:x.song.title,value:x.song.energy}))};
}
