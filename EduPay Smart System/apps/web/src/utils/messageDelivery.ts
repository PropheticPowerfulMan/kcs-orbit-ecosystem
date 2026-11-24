export function hasMessageDelivery(status:string,channel:'EMAIL'|'SMS') {
  return status.split(/\s*[|,;]\s*/).some(part=>part.trim()===`${channel}:SENT`);
}
