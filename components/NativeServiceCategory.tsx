import React, {useState} from 'react';
import {Pressable, View} from 'react-native';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {serviceCategoryGroups} from './serviceCategories';

const entries = serviceCategoryGroups.flatMap(group => group.services.map(name => ({name, group: group.name})));
export function serviceCategoryMatches(value: string, group = '', limit = 20, offset = 0) {
  let query = value.trim().toLowerCase();
  if (['uber', 'bolt', 'taxi', 'drop', 'lift', 'ride', 'drivers'].includes(query)) query = 'driver';
  return entries.filter(item => (!group || group === item.group) && (!query || `${item.name} ${item.group}`.toLowerCase().includes(query))).slice(offset, offset + limit);
}
export function serviceCategoryType(value: string) {
  return ({'Car rental': 'car_rental', 'Car washing': 'car_wash', 'Mobile car washing': 'car_wash', 'Auto mechanic services': 'mechanic', Plumbing: 'plumber', Carpentry: 'carpenter'} as Record<string, string>)[value] || 'artisan';
}
export function NativeServiceCategory({value, onChange, onChoose, disabled, error}: {value: string; onChange: (value: string) => void; onChoose: (value: string, type: string) => void; disabled: boolean; error?: string}) {
  const c = useAccountDesign(), [group, setGroup] = useState(''), [showGroups, setShowGroups] = useState(false), [suggest, setSuggest] = useState(false), [page, setPage] = useState(0);
  const choice = (label: string, action: () => void) => <Pressable key={label} disabled={disabled} accessibilityRole="button" onPress={action} style={({pressed}) => ({padding: 12, minHeight: 44, borderWidth: 1, borderColor: c.line, borderRadius: 10, backgroundColor: pressed ? c.soft : c.surface})}><Text>{label}</Text></Pressable>;
  return <View style={{gap: 8}}><Text style={{fontWeight: '700'}}>What service do you offer?</Text><Text>Search the full service list, or type your own service.</Text>
    {choice(group || 'Browse service groups', () => setShowGroups(!showGroups))}
    {showGroups && <>{choice('All service groups', () => {setGroup(''); setPage(0); setShowGroups(false); setSuggest(true);})}{serviceCategoryGroups.map(item => choice(item.name, () => {setGroup(item.name); setPage(0); setShowGroups(false); setSuggest(true);}))}</>}
    <Input accessibilityLabel="Service category" editable={!disabled} value={value} onFocus={() => setSuggest(true)} onChangeText={text => {onChange(text); setPage(0); setSuggest(true);}} placeholder="For example: tailoring, event staffing or plumbing" style={{borderWidth: 1, borderRadius: 12, borderColor: error ? c.danger : c.line, minHeight: 46, padding: 12}}/>
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}
    {suggest && <>{serviceCategoryMatches(value, group, 20, page * 20).map(item => choice(item.name, () => {onChoose(item.name, serviceCategoryType(item.name)); setSuggest(false);} ))}{page > 0 && choice('Previous services', () => setPage(page - 1))}{serviceCategoryMatches(value, group, 1, (page + 1) * 20).length > 0 && choice('More services', () => setPage(page + 1))}{choice('Use the service name I typed', () => setSuggest(false))}</>}
  </View>;
}
