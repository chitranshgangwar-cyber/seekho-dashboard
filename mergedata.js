// Static snapshot parsed from the "Seekho Merges" sheet · as of 23 Jun 2026.
// Not derived from the performance CSVs — refresh by re-pasting the sheet.
export const MERGE = {
  asOf: "23 Jun 2026",
  // ---- weekly merges (creatives merged / shipped) by week → agency → [category,count] ----
  weeks: [
    { label: "1–7 Jun", total: 37, agencies: [
      { name: "flamel", total: 22, cats: [["Share Market",4],["Utilise Time",4],["Business",3],["Sarkari Kaam",3],["Astrology",2],["Finance",2],["Life Hacks",2],["Part time income",2]] },
      { name: "LiveGenStudio", total: 8, cats: [["Business",4],["Astrology",1],["Life Hacks",1],["Share Market",1],["Utilise Time",1]] },
      { name: "Editstory", total: 4, cats: [["Business",4]] },
      { name: "(Unknown)", total: 3, cats: [["Business",3]] },
    ]},
    { label: "8–14 Jun", total: 79, agencies: [
      { name: "flamel", total: 50, cats: [["Share Market",14],["Life Hacks",11],["Utilise Time",9],["Business",5],["Instagram",5],["Finance",3],["Astrology",2],["Facebook",1]] },
      { name: "LiveGenStudio", total: 21, cats: [["Business",5],["English",5],["Life Hacks",5],["Share Market",4],["Astrology",1],["horxother",1]] },
      { name: "Seekho", total: 4, cats: [["Share Market",3],["Business",1]] },
      { name: "(Unknown)", total: 2, cats: [["Business",2]] },
      { name: "Editstory", total: 2, cats: [["Business",2]] },
    ]},
    { label: "15–21 Jun", total: 115, agencies: [
      { name: "flamel", total: 78, cats: [["Business",24],["Instagram",15],["horxother",10],["Utilise Time",9],["Finance",6],["Astrology",4],["Share Market",3],["Life Hacks",2],["Part time income",2],["Sarkari Kaam",2],["Career & Jobs",1]] },
      { name: "LiveGenStudio", total: 20, cats: [["Business",11],["Astrology",2],["English",2],["Share Market",2],["Utilise Time",2],["Life Hacks",1]] },
      { name: "(Unknown)", total: 10, cats: [["Business",10]] },
      { name: "Editstory", total: 5, cats: [["Business",5]] },
      { name: "Growzy", total: 1, cats: [["Business",1]] },
      { name: "Seekho", total: 1, cats: [["Life Hacks",1]] },
    ]},
    { label: "22–28 Jun", inProgress: true, total: 8, agencies: [
      { name: "flamel", total: 6, cats: [["Utilise Time",2],["Astrology",1],["Business",1],["Finance",1],["Instagram",1]] },
      { name: "(Unknown)", total: 1, cats: [["Business",1]] },
      { name: "LiveGenStudio", total: 1, cats: [["Share Market",1]] },
    ]},
  ],
  // ---- ads live, last 7 days (17–23 Jun), by category × day ----
  liveDays: ["17 Jun","18 Jun","19 Jun","20 Jun","21 Jun","22 Jun","23 Jun"],
  live: [
    ["Business",[30,28,23,17,7,11,35]],
    ["Share Market",[17,16,25,14,7,16,16]],
    ["Astrology",[20,9,7,18,8,5,14]],
    ["Utilise Time",[13,9,15,5,6,5,6]],
    ["English",[9,9,2,6,4,5,9]],
    ["Instagram",[9,10,2,9,4,3,2]],
    ["Life Hacks",[11,4,5,5,2,3,8]],
    ["Finance",[8,1,2,9,6,3,4]],
    ["Part time income",[5,5,1,2,2,1,2]],
    ["Career & Jobs",[2,0,2,5,0,0,1]],
    ["Sarkari Kaam",[1,2,0,0,0,0,0]],
    ["horxother",[0,0,0,0,0,0,2]],
    ["YouTube",[1,0,0,0,0,0,0]],
    ["horxcrisis",[0,0,0,0,0,0,1]],
  ],
  // ---- 7-day merge % (live dates 13–19 Jun): [category, live, merged] ----
  mergeRateWindow: "13–19 Jun",
  mergeRate: [
    ["Business",162,24],["Share Market",123,5],["Astrology",62,5],["Utilise Time",60,9],
    ["Instagram",31,10],["Life Hacks",30,4],["English",29,2],["Finance",23,1],
    ["Part time income",17,2],["Career & Jobs",13,1],["Sarkari Kaam",8,2],["Facebook",1,0],["YouTube",1,0],
  ],
  // ---- creative production by person — weekly & daily ----
  weekCols: ["1–7 Jun","8–14 Jun","15–21 Jun","22–28 Jun"],
  weekTotals: [376,487,465,117],
  byPersonWeekly: [
    { name:"Flamel", total:1030, series:[290,369,299,72], cats:[["Business",224],["Share Market",204],["Utilise Time",183],["Astrology",103],["Instagram",79],["Finance",69],["Life Hacks",66],["Part time income",52],["Career & Jobs",25],["Sarkari Kaam",15],["Facebook",6],["horxother",3],["horxcrisis",1]] },
    { name:"Kartik", total:269, series:[78,76,92,23], cats:[["Share Market",109],["Business",75],["Life Hacks",45],["Utilise Time",40]] },
    { name:"Akshat", total:78, series:[3,23,39,13], cats:[["English",78]] },
    { name:"Ram", total:68, series:[5,19,35,9], cats:[["Astrology",68]] },
  ],
  dayCols: ["17 Jun","18 Jun","19 Jun","20 Jun","21 Jun","22 Jun","23 Jun"],
  dayTotals: [103,76,72,53,46,46,71],
  byPersonDaily: [
    { name:"Flamel", total:312, series:[74,47,51,31,37,25,47], cats:[["Share Market",70],["Business",63],["Utilise Time",45],["Astrology",34],["Instagram",29],["Finance",23],["Life Hacks",23],["Part time income",17],["Career & Jobs",4],["Sarkari Kaam",2],["horxcrisis",1],["horxother",1]] },
    { name:"Kartik", total:75, series:[14,13,17,8,0,11,12], cats:[["Share Market",38],["Life Hacks",15],["Utilise Time",13],["Business",9]] },
    { name:"Akshat", total:43, series:[9,9,2,6,4,5,8], cats:[["English",43]] },
    { name:"Ram", total:37, series:[6,7,2,8,5,5,4], cats:[["Astrology",37]] },
  ],
};
