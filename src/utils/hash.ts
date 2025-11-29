import crypto from "crypto";

export function hashObject<T extends object>(obj: T): string {
  const ordered = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      // @ts-ignore
      acc[key] = obj[key];
      return acc;
    }, {} as T);

  return crypto.createHash("sha256")
    .update(JSON.stringify(ordered))
    .digest("hex");
}