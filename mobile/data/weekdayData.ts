type MetaData = {
  timezone: string;
  caffeineCutoff: string;
  sleepTarget: string;
  proteinTarget: string;
  hydrationTarget: string;
};

type WeekdayData = {
  meta: MetaData;
};

export const DATA: WeekdayData = {
  meta: {
    timezone: "Europe/Belgrade",
    caffeineCutoff: "15:40",
    sleepTarget: "23:00",
    proteinTarget: "140-150 g/day",
    hydrationTarget: ">=2.5 L/day",
  },
};
