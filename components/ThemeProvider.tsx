import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from "react";
import {Alert, Text as NativeText, TextInput as NativeTextInput, useColorScheme, type TextProps, type TextInputProps} from "react-native";
import {StatusBar} from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {themeColor, themeStyles} from "./theme";
import {compactTypography} from "./typography";

export type ThemePreference = "system" | "light" | "dark";
const KEY = "atl.appearance.v1";
const ThemeContext = createContext({dark:false, preference:"system" as ThemePreference, setPreference:(_value:ThemePreference)=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}) {
  const system = useColorScheme();
  const [preference,setChoice] = useState<ThemePreference>("system");
  const [ready,setReady] = useState(false);
  const revision=useRef(0);
  const writes=useRef(Promise.resolve());
  useEffect(()=>{let alive=true; void AsyncStorage.getItem(KEY).then(value=>{if(alive && (value==="light" || value==="dark" || value==="system"))setChoice(value);}).catch(()=>{}).finally(()=>{if(alive)setReady(true);});return()=>{alive=false;};},[]);
  const dark=preference==="dark" || (preference==="system" && system==="dark");
  useEffect(()=>{void SystemUI.setBackgroundColorAsync(dark ? "#111815" : "#F5F5F5").catch(()=>{});},[dark]);
  function setPreference(value:ThemePreference) {
    const previous=preference, version=++revision.current;
    setChoice(value);
    writes.current=writes.current.catch(()=>{}).then(()=>AsyncStorage.setItem(KEY,value)).catch(()=>{
      if(version===revision.current){setChoice(previous);Alert.alert("Appearance", "Your preference could not be saved. Please try again.");}
    });
  }
  // Hydrate the saved choice before rendering screens to avoid a light flash.
  return <ThemeContext.Provider value={{dark,preference,setPreference}}>{ready ? <><StatusBar style={dark ? "light" : "dark"}/>{children}</> : null}</ThemeContext.Provider>;
}
export function useTheme(){const theme=useContext(ThemeContext); return {...theme,color:(value:string,role="color")=>themeColor(value,role,theme.dark)};}
export function useThemedStyles<T>(styles:T):T {const {dark}=useContext(ThemeContext);return useMemo(()=>themeStyles(styles,dark),[styles,dark]);}
export function ThemedText(props:TextProps){const {dark}=useContext(ThemeContext);return <NativeText {...props} style={[{color:dark ? "#F1F4F3" : "#191919"},props.style,compactTypography(props.style)]}/>;}
export const ThemedTextInput=React.forwardRef<NativeTextInput,TextInputProps>(function ThemedTextInput(props,ref){const {dark}=useContext(ThemeContext);return <NativeTextInput ref={ref} placeholderTextColor={dark ? "#B5C0BC" : "#6F7975"} keyboardAppearance={dark ? "dark" : "light"} selectionColor="#FF4747" {...props} style={[{color:dark ? "#F1F4F3" : "#191919"},props.style,compactTypography(props.style)]}/>;});
