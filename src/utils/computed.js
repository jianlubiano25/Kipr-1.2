import { S } from '../state.js';
import { mk, curMk, dateOf, chartLbl, toStr } from './dateUtils.js';
import { isGroceryTx, isHomeCookedTx, expenseTotal } from './electricityUtils.js'; // Added expenseTotal
 
export function calc(){
  const data=S.data,now=new Date(),cm=curMk();
  const bills=data.bills||[];
  const bTotal=bills.reduce((s,b)=>s+(b.monthlyAmounts?.[cm]||0),0);
  const bUnpaid=bills.filter(b=>!b.paid?.[cm]).reduce((s,b)=>s+(b.monthlyAmounts?.[cm]||0),0);
  const d7=new Date(now.getTime()-7*86400000);
  const meals=(data.transactions||[]).filter(t=>!isGroceryTx(t));
  const groceries=(data.transactions||[]).filter(isGroceryTx);
  const rec=meals.filter(t=>new Date(t.date)>=d7);
  const avgD=rec.length?rec.reduce((s,t)=>s+t.amount,0)/7:data.dailyBudget;
  const groceryMonth=groceries.filter(t=>mk(t.date)===cm).reduce((s,t)=>s+t.amount,0);
  const avgByMonth=totals=>{const vals=Object.values(totals).filter(v=>v>0);return{avg:vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0,count:vals.length};};
  const foodMonths={},homeMonths={},billMonths={};
  (data.transactions||[]).forEach(t=>{const k=mk(t.date);foodMonths[k]=(foodMonths[k]||0)+(parseFloat(t.amount)||0);});
  (data.homeExpenses||[]).forEach(e=>{const k=mk(e.date);homeMonths[k]=(homeMonths[k]||0)+(parseFloat(e.amount)||0);});
  bills.forEach(b=>Object.entries(b.monthlyAmounts||{}).forEach(([k,v])=>{billMonths[k]=(billMonths[k]||0)+(parseFloat(v)||0);}));
  const foodAvg=avgByMonth(foodMonths),homeAvg=avgByMonth(homeMonths),billAvg=avgByMonth(billMonths);
  const historyMonths=[...new Set([...Object.keys(foodMonths),...Object.keys(homeMonths),...Object.keys(billMonths)])].length;
  const avgMonthlyExpense=(foodAvg.avg+homeAvg.avg+billAvg.avg)||(bTotal+avgD*30+groceryMonth);
  const runwayMonths=avgMonthlyExpense>0?data.balance/avgMonthlyExpense:9999;
  const mBurn=avgMonthlyExpense;
  const runway=Math.floor(runwayMonths*30);
  const todayS=meals.filter(t=>t.date===dateOf(new Date())).reduce((s,t)=>s+t.amount,0);
  const chart=Array.from({length:7},(_,i)=>{
    const dd=new Date(now.getTime()-(6-i)*86400000),ds=dateOf(dd);const dayMeals=meals.filter(t=>t.date===ds);
    const homeCookedCount = dayMeals.filter(isHomeCookedTx).length;
    return{label:chartLbl(dd),spend:dayMeals.reduce((s,t)=>s+t.amount,0),count:dayMeals.length,homeCookedCount,ds};
  });
  const maxS=Math.max(...chart.map(x=>x.spend),data.dailyBudget,1);
  return{bTotal,bUnpaid,avgD,mBurn,runway,runwayMonths,avgMonthlyExpense,historyMonths,todayS,groceryMonth,chart,maxS};
}
export function pGroups(){
  const f=(S.data.priceItems||[]).filter(p=>S.pCat==='All'||p.category===S.pCat);
  const g=f.reduce((acc,item)=>{const key=item.name.toLowerCase().trim();if(!acc[key])acc[key]={display:item.name,items:[]};acc[key].items.push(item);return acc;},{});
  Object.values(g).forEach(x=>x.items.sort((a,b)=>a.price-b.price));
  return Object.values(g).sort((a,b)=>a.display.localeCompare(b.display));
}
