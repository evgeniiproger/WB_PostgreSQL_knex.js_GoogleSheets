export const getToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Almaty" });

export const getTime = () =>
  new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      timeZone: "Asia/Almaty",
  });