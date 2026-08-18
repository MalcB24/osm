export interface TodayResult {
  date: string;
  timeZone: string;
  dayOfWeek: string;
  isoTimestamp: string;
}

export function getToday(
  timeZone = "Europe/Malta",
  now = new Date(),
): TodayResult {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const dayOfWeek = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
  }).format(now);

  const part = (type: string): string => {
    const value = dateParts.find(
      (datePart) => datePart.type === type,
    )?.value;

    if (!value) {
      throw new Error(`Unable to format current ${type}.`);
    }

    return value;
  };

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    timeZone,
    dayOfWeek,
    isoTimestamp: now.toISOString(),
  };
}
