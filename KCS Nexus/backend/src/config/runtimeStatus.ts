let databaseReady = false

export function setDatabaseReady(value: boolean) {
  databaseReady = value
}

export function isDatabaseReady() {
  return databaseReady
}
