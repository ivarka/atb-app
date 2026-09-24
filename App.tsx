import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTravel } from './src/state/useTravel';
import { PlanningScreen } from './src/screens/PlanningScreen';
import { ActiveScreen } from './src/screens/ActiveScreen';
import { colors } from './src/ui/theme';

export default function App() {
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}><StatusBar style="dark" /><TravelApp /></SafeAreaView></SafeAreaProvider>;
}
function TravelApp() {
  const travel = useTravel();
  const [screen, setScreen] = useState<'planning' | 'active'>(travel.active ? 'active' : 'planning');
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'active') { setScreen('planning'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [screen]);
  return screen === 'active' && travel.active
    ? <ActiveScreen travel={travel} onBack={() => setScreen('planning')} />
    : <PlanningScreen key={travel.restartKey} travel={travel} onOpenActive={() => setScreen('active')} />;
}
