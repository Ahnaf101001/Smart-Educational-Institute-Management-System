function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function keysToCamel(value) {
  if (Array.isArray(value)) return value.map(keysToCamel);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [snakeToCamel(key), keysToCamel(child)]),
    );
  }
  return value;
}

function objectToSnake(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [camelToSnake(key), child]),
  );
}

module.exports = { camelToSnake, snakeToCamel, keysToCamel, objectToSnake };
