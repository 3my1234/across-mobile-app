import {KeyboardScrollView as ScrollView} from './KeyboardScroll';
import {ProviderPanel} from './ProviderPanel';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, Share, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAccountDesign} from './AccountDesign';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {chooseCustomReferralCode, loadReferralSummary, ReferralSummary} from './referralApi';

export function NativeReferrals({embedded = false, token, onClose, onOpenXP}: {embedded?: boolean; token: string; onClose: () => void; onOpenXP: () => void}) {
  const c = useAccountDesign(), safeInsets = useSafeAreaInsets(), insets = embedded ? {top: 0, bottom: 0} : safeInsets;
  const [summary, setSummary] = useState<ReferralSummary | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [custom,setCustom]=useState(''),[saving,setSaving]=useState(false),[recoveryRequired,setRecoveryRequired]=useState(false);
  const epoch = useRef(0), flight = useRef(false);
  const invalidate = useCallback(() => {epoch.current++; flight.current = false;}, []);
  const load = useCallback(async () => {
    if (flight.current) return; flight.current = true; const version = ++epoch.current; setLoading(true); setError('');
    try {const next = await loadReferralSummary(token); if (version === epoch.current) {setSummary(next);setRecoveryRequired(false);}}
    catch (failure) {if (version === epoch.current) setError(failure instanceof Error ? failure.message : 'Could not load referrals. Retry.');}
    finally {if (version === epoch.current) {flight.current = false; setLoading(false);}}
  }, [token]);
  useEffect(() => {void load(); return invalidate;}, [load, invalidate]);
  async function choose() {
    if (flight.current || !summary?.can_customize || recoveryRequired) return;
    const code=custom.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {setError('Use 4 to 20 letters or numbers without spaces.');return;}
    const expectedVersion=epoch.current;
    Alert.alert('Keep this referral code?', `${code} will be your permanent custom code. You can choose only once. Your original code will still work.`, [{text:'Cancel',style:'cancel'},{text:'Save code',onPress:()=>void saveCode(code,expectedVersion)}]);
  }
  async function saveCode(code:string,expectedVersion:number) {
    if (flight.current || expectedVersion!==epoch.current) return;
    flight.current=true;const version=++epoch.current;setSaving(true);setError('');
    try {const chosen=await chooseCustomReferralCode(token,code);if(version===epoch.current){setSummary(old=>old?{...old,custom_code:chosen,can_customize:false}:old);setCustom('');}}
    catch(failure) {
      if(version!==epoch.current)return;
      setRecoveryRequired(true);
      // A timeout may follow a successful save. Reconcile by GET, never replay POST.
      try {const next=await loadReferralSummary(token);if(version===epoch.current){setSummary(next);setRecoveryRequired(false);if(!next.custom_code)setError(failure instanceof Error?failure.message:'Could not save this code.');}}
      catch {if(version===epoch.current)setError('Could not confirm your saved code. Refresh referrals before trying again.');}
    } finally {if(version===epoch.current){flight.current=false;setSaving(false);}}
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled||saving} onPress={action} style={{padding: 14, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.soft}}><Text>{label}</Text></Pressable>;
  const share = () => {if (summary) void Share.share({message: `Join ATL Xpress as a customer or provider. Enter my referral code ${summary.custom_code||summary.code} when creating your new account, then verify your email. Visit https://atlxpres.com to learn about ATL Xpress.`}).catch(() => setError('Could not open sharing. You can select and copy your code instead.'));};
  return <ProviderPanel embedded={embedded} onClose={onClose}><View style={{flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: c.background}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, gap: 16}}>
    {button('Back', onClose)}<Text style={{fontSize: 24, fontWeight: '700'}}>Refer and earn XP</Text>
    {loading && <ActivityIndicator/>}{!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}
    {summary && <><Text>Your referral code</Text><Text selectable style={{fontSize: 23, fontWeight: '700', letterSpacing: 2}}>{summary.custom_code||summary.code}</Text>{button('Share invitation', share)}
      {!!summary.custom_code&&<><Text>Your custom code is permanent. Your original code also remains valid:</Text><Text selectable>{summary.code}</Text></>}
      {summary.custom_code_supported===true&&summary.can_customize&&<View style={{gap:10,padding:14,borderWidth:1,borderColor:c.line,borderRadius:12}}><Text style={{fontWeight:'700'}}>Choose your custom code once</Text><Text>Use 4 to 20 letters or numbers, such as SABINUS001. Codes are case-insensitive. Your existing invitations will still work.</Text><Input accessibilityLabel="Custom referral code" value={custom} onChangeText={setCustom} editable={!saving&&!loading&&!recoveryRequired} autoCapitalize="characters" autoCorrect={false} maxLength={20} placeholder="For example: SABIBOI" style={{padding:12,borderWidth:1,borderColor:c.line,borderRadius:10}}/>{button(saving?'Saving code...':'Choose permanent code',()=>void choose(),loading||recoveryRequired)}{recoveryRequired&&<Text>Refresh referrals to check your saved code first.</Text>}</View>}
      <Text>Earn {summary.signup_xp} XP when a new customer or provider signs up with your code and verifies their account.</Text>
      <Text>If they become a provider and make their first confirmed payment on a qualifying plan, earn another {summary.paid_provider_additional_xp} XP: {summary.paid_provider_total_xp} XP total for that person. Renewals and upgrades do not award another referral bonus. Free providers earn the signup reward only.</Text>
      <Text style={{fontWeight: '700'}}>Your referrals</Text><Text>{summary.pending_signups} awaiting verification</Text><Text>{summary.verified_signups} verified signups · {summary.paid_providers} paid providers</Text><Text>{summary.earned_xp} lifetime referral XP earned</Text>
      <Text>1 XP = ₦1. Withdrawal starts at {summary.minimum_withdrawal_xp.toLocaleString()} XP and requires admin review. Your available balance reflects previous withdrawals and is shown in your XP account.</Text>{button('View XP balance and withdrawals', onOpenXP)}<Text>Codes apply to new accounts only and must be entered during registration. Self-referrals are not permitted. Signup and payment must be confirmed by ATL Xpress before rewards appear.</Text>
    </>}{button('Refresh referrals', () => void load(), loading)}
  </ScrollView></View></ProviderPanel>;
}
