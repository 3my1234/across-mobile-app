export type TransportKind='all'|'passenger'|'courier'|'delivery';
export function transportServiceKind(category='',title=''):Exclude<TransportKind,'all'>|null {
 const text=`${category} ${title}`;
 if(/(?:^|[^a-z])(?:riders?|couriers?|dispatch|motorcycle[ -]+delivery)(?:[^a-z]|$)/i.test(text))return 'courier';
 if(/(?:^|[^a-z])(?:delivery|logistics|transport|trucking)(?:[^a-z]|$)/i.test(text))return 'delivery';
 if(/(?:^|[^a-z])(?:drivers?|chauffeurs?|taxi)(?:[^a-z]|$)/i.test(text))return 'passenger';
 return null;
}
export function nearbyFreshUntil(seconds:number,started:number,received=Date.now()) {
 return received+Math.max(0,Math.min(120,Number.isFinite(seconds)?seconds:0)*1000-Math.max(0,received-started));
}
