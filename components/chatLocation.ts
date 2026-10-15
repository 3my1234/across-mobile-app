export type ChatLocation={latitude:number;longitude:number;accuracy_m?:number};
export function validLocation(pin?:ChatLocation|null):pin is ChatLocation{return !!pin&&Number.isFinite(pin.latitude)&&Number.isFinite(pin.longitude)&&Math.abs(pin.latitude)<=90&&Math.abs(pin.longitude)<=180;}
export function locationMapURL(pin:ChatLocation){if(!validLocation(pin))return '';return `https://www.google.com/maps/search/?api=1&query=${pin.latitude},${pin.longitude}`;}
